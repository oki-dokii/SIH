import os
import json
import traceback
import time
import gc
from datetime import datetime
import torch
from docling.document_converter import DocumentConverter, PdfFormatOption
from docling.datamodel.base_models import InputFormat
from docling.datamodel.pipeline_options import PdfPipelineOptions
from docling.datamodel.accelerator_options import AcceleratorOptions

from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_community.vectorstores import Chroma
from langchain_ollama import ChatOllama, OllamaEmbeddings
from langchain_core.documents import Document
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.runnables import RunnablePassthrough
from langchain_core.output_parsers import StrOutputParser

def log_time(message):
    """Print timestamped log message."""
    timestamp = datetime.now().strftime("%H:%M:%S.%f")[:-3]
    print(f"[{timestamp}] {message}")

def simplify_docling_output(raw_data: dict) -> list:
    """
    Simplifies the raw Docling JSON output to a flat list of text and tables.
    Preserves reading order by following body -> children.
    Enhanced with table header detection.
    """
    simplified_elements = []
    
    # Helper to resolve $ref
    def resolve_ref(ref_str):
        if not ref_str or not isinstance(ref_str, str) or not ref_str.startswith('#/'):
            return None
        parts = ref_str.split('/')
        # e.g. #/texts/0 -> parts=['#', 'texts', '0']
        if len(parts) == 3:
            section = parts[1]
            try:
                idx = int(parts[2])
                if section in raw_data and isinstance(raw_data[section], list) and 0 <= idx < len(raw_data[section]):
                    return raw_data[section][idx]
            except ValueError:
                pass
        return None

    # Helper to process a group or item
    def process_item(item_ref):
        ref_str = item_ref.get('$ref')
        item = resolve_ref(ref_str)
        
        if not item:
            return

        # 1. Extract Text content (if present)
        if 'text' in item: 
            text_content = item.get('text', '').strip()
            if text_content:
                simplified_elements.append({
                    "type": "text",
                    "content": text_content,
                    "label": item.get('label', 'text'),
                    "page": item.get('prov', [{}])[0].get('page_no')
                })

        # 2. Extract Table content (if present)
        elif 'data' in item and 'grid' in item['data']:
            grid = item['data']['grid']
            
            # Extract text from grid cells
            table_data = []
            for row in grid:
                row_data = []
                for cell in row:
                    cell_text = cell.get('text', '').strip()
                    row_data.append(cell_text)
                table_data.append(row_data)
            
            if table_data:
                # Detect headers: first row is typically headers if it has content
                # and subsequent rows exist
                headers = []
                rows = []
                
                if len(table_data) > 1:
                    # Check if first row looks like headers
                    first_row = table_data[0]
                    # Use first row as headers if it's not empty
                    if any(cell.strip() for cell in first_row):
                        headers = first_row
                        rows = table_data[1:]
                    else:
                        rows = table_data
                else:
                    rows = table_data
                
                table_obj = {
                    "type": "table",
                    "page": item.get('prov', [{}])[0].get('page_no')
                }
                
                if headers:
                    table_obj["headers"] = headers
                    table_obj["rows"] = rows
                else:
                    table_obj["data"] = rows
                
                simplified_elements.append(table_obj)

        # 3. Recurse into Children (if present and non-empty)
        if 'children' in item and item['children']:
            for child_ref in item['children']:
                process_item(child_ref)

    # Start processing from body
    if 'body' in raw_data and 'children' in raw_data['body']:
        for child_ref in raw_data['body']['children']:
            process_item(child_ref)
            
    return simplified_elements

def parse_pdf_with_docling(pdf_path: str):
    """
    Parse PDF using Docling, extracting only text and tables (no images).
    """
    log_time("🔧 Configuring Docling pipeline...")
    
    # Detect GPU availability
    device = "cuda" if torch.cuda.is_available() else "cpu"
    log_time(f"🎮 Using device: {device}")
    if device == "cuda":
        log_time(f"   GPU: {torch.cuda.get_device_name(0)}")
    
    # Configure pipeline to skip image processing and use GPU
    pipeline_options = PdfPipelineOptions()
    pipeline_options.accelerator_options = AcceleratorOptions(device=device)  # Correct way to set GPU
    pipeline_options.generate_picture_images = False  # Don't extract images
    pipeline_options.do_picture_description = False   # Don't describe images
    pipeline_options.do_ocr = False                   # Skip OCR for images
    pipeline_options.do_table_structure = True        # Enable for better table extraction

    # Create converter with custom options
    converter = DocumentConverter(
        format_options={
            InputFormat.PDF: PdfFormatOption(
                pipeline_options=pipeline_options
            )
        }
    )
    
    log_time(f"📄 Starting Docling conversion (using {device.upper()} accelerator)...")
    start_convert = time.time()
    
    # Convert the document
    result = converter.convert(pdf_path)
    doc = result.document
    
    elapsed_convert = time.time() - start_convert
    log_time(f"✅ Docling conversion complete in {elapsed_convert:.2f}s")
    
    # FREE GPU MEMORY: Delete converter and clear CUDA cache
    log_time(f"🧹 Freeing {device.upper()} memory (clearing Docling models)...")
    del converter
    gc.collect()  # Force Python garbage collection
    if torch.cuda.is_available():
        torch.cuda.empty_cache()  # Clear CUDA cache
    log_time(f"✅ {device.upper()} memory freed")
    
    # Export to dictionary
    log_time("📤 Exporting parsed data...")
    try:
        raw_output = doc.export_to_dict()
    except AttributeError:
        if hasattr(doc, 'dict'):
             raw_output = doc.dict()
        else:
             raise

    log_time("🔍 Simplifying structure...")
    # Simplify the output
    simplified = simplify_docling_output(raw_output)
    log_time(f"✅ Extracted {len(simplified)} elements")
    
    return simplified

class RAGEngine:
    def __init__(self, persist_directory="./chroma_db"):
        self.persist_directory = persist_directory
        log_time("🤖 Initializing Ollama embeddings (nomic-embed-text)...")
        self.embedding_function = OllamaEmbeddings(model="nomic-embed-text")
        self.vector_store = None
        self.retriever = None
        log_time("🤖 Initializing Ollama LLM (llama3.1)...")
        self.llm = ChatOllama(model="llama3.1:latest", temperature=0, num_ctx=16384, format="json")
        self.first_30_chunks = []
        
        # Initialize vector store if it exists
        if os.path.exists(self.persist_directory):
            log_time("📚 Loading existing vector database...")
            self.vector_store = Chroma(
                persist_directory=self.persist_directory,
                embedding_function=self.embedding_function
            )
            self.retriever = self.vector_store.as_retriever(
                search_type="similarity",
                search_kwargs={"k": 20}
            )
            log_time("✅ Vector database loaded")

    def process_pdf(self, file_path):
        """Extracts text from PDF using Docling, chunks it, and adds to vector store."""
        log_time(f"🚀 Starting PDF processing: {os.path.basename(file_path)}")
        total_start = time.time()
        
        docs = []
        
        try:
            parsed_elements = parse_pdf_with_docling(file_path)
            
            log_time("📝 Converting elements to documents...")
            text_count = 0
            table_count = 0
            
            for element in parsed_elements:
                page_num = element.get('page', 1)
                source = os.path.basename(file_path)
                
                if element['type'] == 'text':
                    text = element['content']
                    if text.strip():
                        docs.append(Document(
                            page_content=text,
                            metadata={"page": page_num, "source": source, "type": "text"}
                        ))
                        text_count += 1
                
                elif element['type'] == 'table':
                    # Convert table to markdown format
                    table_md = ""
                    if 'headers' in element:
                        headers = element['headers']
                        table_md += "| " + " | ".join(headers) + " |\n"
                        table_md += "| " + " | ".join(["---"] * len(headers)) + " |\n"
                        rows = element.get('rows', [])
                    else:
                        rows = element.get('data', [])
                    
                    for row in rows:
                        table_md += "| " + " | ".join(row) + " |\n"
                    
                    if table_md.strip():
                        docs.append(Document(
                            page_content=table_md,
                            metadata={"page": page_num, "source": source, "type": "table"}
                        ))
                        table_count += 1
            
            log_time(f"✅ Created {len(docs)} documents ({text_count} text, {table_count} tables)")
                        
        except Exception as e:
            log_time(f"❌ Error parsing PDF with Docling: {e}")
            traceback.print_exc()
            return 0
        
        log_time("✂️  Starting text chunking...")
        chunk_start = time.time()
        
        text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=1000,
            chunk_overlap=200,
            add_start_index=True
        )
        
        splits = text_splitter.split_documents(docs)
        chunk_elapsed = time.time() - chunk_start
        log_time(f"✅ Chunking complete: {len(splits)} chunks in {chunk_elapsed:.2f}s")
        
        if not splits:
            return 0

        # Store first 30 chunks for context
        self.first_30_chunks = splits[:30]
        log_time(f"💾 Stored first 30 chunks for context boosting")
        
        log_time("🧮 Starting embedding generation (GPU accelerated)...")
        embed_start = time.time()
        
        # Create or update vector store
        if self.vector_store is None:
            self.vector_store = Chroma.from_documents(
                documents=splits,
                embedding=self.embedding_function,
                persist_directory=self.persist_directory
            )
        else:
            self.vector_store.add_documents(splits)
        
        embed_elapsed = time.time() - embed_start
        log_time(f"✅ Embeddings generated and stored in {embed_elapsed:.2f}s")
            
        self.retriever = self.vector_store.as_retriever(
            search_type="similarity",
            search_kwargs={"k": 20}
        )
        
        total_elapsed = time.time() - total_start
        log_time(f"🎉 PDF processing complete! Total time: {total_elapsed:.2f}s")
        
        return len(splits)

    def process_and_store_chunks(self, pdf_id, file_path, db_path="data/chat.db"):
        """
        Process PDF and store chunks in database for persistence.
        Returns number of chunks processed.
        """
        import db  # Import db module for database operations
        
        log_time(f"🚀 Starting PDF processing with chunk storage: {os.path.basename(file_path)}")
        total_start = time.time()
        
        docs = []
        
        try:
            parsed_elements = parse_pdf_with_docling(file_path)
            
            log_time("📝 Converting elements to documents...")
            text_count = 0
            table_count = 0
            
            for element in parsed_elements:
                page_num = element.get('page', 1)
                source = os.path.basename(file_path)
                
                if element['type'] == 'text':
                    text = element['content']
                    if text.strip():
                        docs.append(Document(
                            page_content=text,
                            metadata={"page": page_num, "source": source, "type": "text"}
                        ))
                        text_count += 1
                
                elif element['type'] == 'table':
                    # Convert table to markdown format
                    table_md = ""
                    if 'headers' in element:
                        headers = element['headers']
                        table_md += "| " + " | ".join(headers) + " |\n"
                        table_md += "| " + " | ".join(["---"] * len(headers)) + " |\n"
                        rows = element.get('rows', [])
                    else:
                        rows = element.get('data', [])
                    
                    for row in rows:
                        table_md += "| " + " | ".join(row) + " |\n"
                    
                    if table_md.strip():
                        docs.append(Document(
                            page_content=table_md,
                            metadata={"page": page_num, "source": source, "type": "table"}
                        ))
                        table_count += 1
            
            log_time(f"✅ Created {len(docs)} documents ({text_count} text, {table_count} tables)")
                        
        except Exception as e:
            log_time(f"❌ Error parsing PDF with Docling: {e}")
            traceback.print_exc()
            return 0
        
        log_time("✂️  Starting text chunking...")
        chunk_start = time.time()
        
        text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=1000,
            chunk_overlap=200,
            add_start_index=True
        )
        
        splits = text_splitter.split_documents(docs)
        chunk_elapsed = time.time() - chunk_start
        log_time(f"✅ Chunking complete: {len(splits)} chunks in {chunk_elapsed:.2f}s")
        
        if not splits:
            return 0

        # Store chunks in database
        log_time("💾 Storing chunks in database...")
        for idx, chunk in enumerate(splits):
            metadata = {
                "page": chunk.metadata.get("page"),
                "source": chunk.metadata.get("source"),
                "type": chunk.metadata.get("type"),
                "start_index": chunk.metadata.get("start_index")
            }
            db.insert_chunk(pdf_id, idx, chunk.page_content, metadata, db_path)
        
        log_time(f"✅ Stored {len(splits)} chunks in database")
        
        # Mark PDF as having chunks stored
        db.update_pdf_chunks_stored(pdf_id, len(splits), db_path)

        # Store first 30 chunks for context
        self.first_30_chunks = splits[:30]
        log_time(f"💾 Stored first 30 chunks for context boosting")
        
        log_time("🧮 Starting embedding generation (GPU accelerated)...")
        embed_start = time.time()
        
        # Create or update vector store
        if self.vector_store is None:
            self.vector_store = Chroma.from_documents(
                documents=splits,
                embedding=self.embedding_function,
                persist_directory=self.persist_directory
            )
        else:
            self.vector_store.add_documents(splits)
        
        embed_elapsed = time.time() - embed_start
        log_time(f"✅ Embeddings generated and stored in {embed_elapsed:.2f}s")
            
        self.retriever = self.vector_store.as_retriever(
            search_type="similarity",
            search_kwargs={"k": 20}
        )
        
        total_elapsed = time.time() - total_start
        log_time(f"🎉 PDF processing complete! Total time: {total_elapsed:.2f}s")
        
        return len(splits)

    def load_chunks_from_db(self, pdf_id, db_path="data/chat.db"):
        """
        Load previously processed chunks from database and add to vector store.
        Avoids reprocessing the PDF.
        Returns number of chunks loaded.
        """
        import db
        
        log_time(f"📚 Loading chunks from database for PDF {pdf_id}...")
        load_start = time.time()
        
        # Get chunks from database
        chunks_data = db.get_pdf_chunks(pdf_id, db_path)
        
        if not chunks_data:
            log_time("⚠️  No chunks found in database")
            return 0
        
        log_time(f"✅ Found {len(chunks_data)} chunks in database")
        
        # Convert to Document objects
        docs = []
        for chunk_data in chunks_data:
            metadata = chunk_data.get('metadata', {})
            if metadata is None:
                metadata = {}
            
            doc = Document(
                page_content=chunk_data['content'],
                metadata=metadata
            )
            docs.append(doc)
        
        # Store first 30 chunks for context
        self.first_30_chunks = docs[:30]
        log_time(f"💾 Loaded first 30 chunks for context boosting")
        
        log_time("🧮 Adding chunks to vector store...")
        embed_start = time.time()
        
        # Create or update vector store
        if self.vector_store is None:
            self.vector_store = Chroma.from_documents(
                documents=docs,
                embedding=self.embedding_function,
                persist_directory=self.persist_directory
            )
        else:
            self.vector_store.add_documents(docs)
        
        embed_elapsed = time.time() - embed_start
        log_time(f"✅ Chunks added to vector store in {embed_elapsed:.2f}s")
            
        self.retriever = self.vector_store.as_retriever(
            search_type="similarity",
            search_kwargs={"k": 20}
        )
        
        total_elapsed = time.time() - load_start
        log_time(f"🎉 Chunks loaded from database! Total time: {total_elapsed:.2f}s")
        
        return len(docs)


    def chat(self, query, json_mode=False):
        """
        Answers a query using the RAG pipeline.
        
        Args:
            query: User's question
            json_mode: If True, returns JSON format. If False, returns conversational text.
        """
        if not self.retriever:
            return "Please upload a PDF first.", []

        log_time(f"💬 Processing query: {query[:50]}...")
        query_start = time.time()

        # Define prompt based on mode
        if json_mode:
            template = """You are a data extraction assistant. You MUST respond ONLY with valid JSON. Do not include any explanations before or after the JSON.

Context:
{context}

Task: {question}

Output ONLY the JSON object, nothing else."""
        else:
            # Conversational mode for natural chat
            template = """You are a helpful PDF analysis assistant. Use the provided context to answer the user's question in a clear, conversational way.

Context from the PDF:
{context}

User Question: {question}

Instructions:
- Answer in a natural, conversational tone
- Be concise but comprehensive
- Use bullet points or numbered lists when appropriate  
- If the context doesn't contain the answer, say so politely
- Cite specific details from the document when relevant

Answer:"""
        
        prompt = ChatPromptTemplate.from_template(template)

        # Custom retrieval logic to combine first 30 chunks + vector search
        def combined_retriever(q):
            log_time("🔍 Retrieving relevant chunks...")
            relevant_docs = self.retriever.invoke(q)
            # Combine and deduplicate based on page content
            all_docs = self.first_30_chunks + relevant_docs
            seen = set()
            unique_docs = []
            for d in all_docs:
                if d.page_content not in seen:
                    seen.add(d.page_content)
                    unique_docs.append(d)
            log_time(f"✅ Retrieved {len(unique_docs)} unique chunks")
            return unique_docs

        # Retrieval chain
        retrieval_chain = (
            {"context": combined_retriever, "question": RunnablePassthrough()}
            | prompt
            | self.llm
            | StrOutputParser()
        )

        log_time("🤖 Generating answer with LLM...")
        # Get answer
        answer = retrieval_chain.invoke(query)
        
        # Get sources
        source_docs = combined_retriever(query)
        sources = []
        for doc in source_docs:
            sources.append(f"Page {doc.metadata.get('page', '?')}")
        
        query_elapsed = time.time() - query_start
        log_time(f"✅ Query complete in {query_elapsed:.2f}s")
        
        return answer, list(set(sources))
    
    def generate_sectional_analysis(self, pdf_id: int, db_path: str = "data/chat.db") -> dict:
        """
        Generate sectional analysis for a PDF using its stored chunks.
        Reuses existing LLM infrastructure for 5-section analysis.
        
        Args:
            pdf_id: ID of the PDF to analyze
            db_path: Path to database
            
        Returns:
            Complete analysis JSON with all 5 sections merged
        """
        import db as db_module
        
        log_time(f"📊 Starting sectional analysis for PDF {pdf_id}")
        
        # Load all chunks from database
        chunks = db_module.get_pdf_chunks(pdf_id, db_path)
        if not chunks:
            raise ValueError(f"No chunks found for PDF {pdf_id}")
        
        log_time(f"✓ Loaded {len(chunks)} chunks")
        
        # Define sections with search queries for semantic similarity
        sections = {
            "header": {
                "search_query": "What is the project name, location, state, district, sector, scheme name, total cost, investment, budget, project duration, timeline, implementation period?",
                "query": """Extract header information from the document.

Return EXACTLY this JSON structure:
{
  "projectName": "<extracted project name>",
  "projectLocation": {
    "state": "<state name>",
    "districts": "<comma separated districts or empty string>"
  },
  "projectSector": "<sector like Agriculture, Banking, Infrastructure>",
  "schemeName": "<scheme name or empty string>",
  "totalInvestment": "<total project cost with currency symbol, e.g., ₹40.60 cr or ₹28.75L>",
  "implementationDuration": "<project duration/timeline, e.g., 1 year, 2 months, 6 months>"
}

Instructions:
- For totalInvestment: Extract the total project cost/budget with proper formatting (₹ symbol, cr/L suffix)
- For implementationDuration: Extract the project implementation period/timeline
- If information is not found, use empty string ""

Return ONLY the JSON, no other text.""",
                "system_prompt": "You are a data extraction assistant. Extract project header information including financial and timeline details, and return ONLY valid JSON matching the exact structure provided."
            },
            
            "overview": {
                "search_query": "What is the executive summary, project overview, objectives, purpose, scope, and deliverables?",
                "query": """Extract project overview information.

Return EXACTLY this JSON structure:
{
  "executiveSummary": "<2-3 sentence summary>",
  "objectives": ["<objective 1>", "<objective 2>"],
  "scope": ["<scope item 1>", "<scope item 2>"],
  "stakeholders": ["<stakeholder 1>", "<stakeholder 2>"]
}

Return ONLY the JSON, no other text.""",
                "system_prompt": "You are a data extraction assistant. Summarize project overview and return ONLY valid JSON matching the exact structure provided."
            },
            
            "riskAssessment": {
                "search_query": "What are the project risks, challenges, threats, mitigation strategies, and risk management plans?",
                "query": """Identify and analyze project risks.

Return EXACTLY this JSON structure:
{
  "risks": [
    {
      "name": "<risk name>",
      "severity": "HIGH",
      "mitigation": "<mitigation strategy>",
      "evidence": "<evidence from document>"
    }
  ]
}

Severity must be: HIGH, MEDIUM, or LOW.
Return ONLY the JSON, no other text.""",
                "system_prompt": "You are a risk assessment expert. Analyze risks and return ONLY valid JSON matching the exact structure provided."
            },
            
            "inconsistencies": {
                "search_query": "Are there any budget errors, cost calculation mistakes, timeline conflicts, or data inconsistencies?",
                "query": """Detect inconsistencies in the document.

Return EXACTLY this JSON structure:
{
  "hasInconsistencies": true,
  "issues": [
    {
      "category": "<Budget/Timeline/Data/Missing info>",
      "severity": "High",
      "description": "<what is inconsistent>",
      "location": "<where found>",
      "impact": "<potential impact>"
    }
  ]
}

If no inconsistencies found, set hasInconsistencies to false and issues to [].
Return ONLY the JSON, no other text.""",
                "system_prompt": "You are a quality assurance expert. Detect errors and return ONLY valid JSON matching the exact structure provided."
            },
            
            "mdonerCompliance": {
                "search_query": "How does the project comply with MDoNER guidelines for North Eastern region, tribal communities, environmental clearance, and land acquisition?",
                "query": """Assess MDoNER compliance scores (0-100 for each criterion).

Return EXACTLY this JSON structure:
{
  "scores": {
    "North Eastern focus": 80,
    "Beneficiary alignment": 70,
    "Environmental compliance": 60,
    "Land acquisition clarity": 50,
    "Documentation quality": 90
  },
  "overallComplianceScore": 70,
  "gaps": ["<gap 1>", "<gap 2>"],
  "strengths": ["<strength 1>", "<strength 2>"]
}

Scores must be 0-100. OverallComplianceScore should be average of all scores.
Return ONLY the JSON, no other text.""",
                "system_prompt": "You are a compliance expert. Assess compliance and return ONLY valid JSON matching the exact structure provided with numeric scores 0-100."
            }
        }
        
        # Analyze each section
        results = {}
        for section_name, config in sections.items():
            log_time(f"📝 Analyzing: {section_name}")
            
            # Filter chunks using semantic search
            filtered_chunks = self._filter_chunks_for_section(chunks, config["search_query"])
            log_time(f"  → Using {len(filtered_chunks)} chunks")
            
            # Analyze with LLM
            section_result = self._analyze_section_with_llm(
                filtered_chunks, config["query"], config["system_prompt"]
            )
            results[section_name] = section_result
        
        # Merge results
        final_json = self._merge_section_results(results)
        log_time(f"✅ Sectional analysis complete")
        
        return final_json
    
    def _filter_chunks_for_section(self, chunks: list, search_query: str, first_n: int = 20, top_k: int = 20) -> list:
        """
        Filter chunks using existing RAG engine vector similarity search.
        Reuses self.retriever for semantic search.
        
        Args:
            chunks: All chunks
            search_query: Query string for similarity search
            first_n: Number of first chunks to include
            top_k: Number of semantically similar chunks to retrieve
        """
        # First N chunks for project context
        first_chunks = chunks[:first_n]
        
        # Use existing retriever for semantic search
        if self.retriever:
            try:
                log_time(f"  🔍 Using semantic similarity search (retriever)")
                
                # Semantic search using existing vector store (request more to ensure we get top_k)
                similar_docs = self.retriever.invoke(search_query)
                
                log_time(f"  ✓ Retrieved {len(similar_docs)} similar documents from vector store")
                
                # Convert back to chunk format by matching content
                semantic_chunks = []
                for doc in similar_docs:
                    # Find matching chunk by content
                    for chunk in chunks:
                        if chunk.get('content', '') == doc.page_content:
                            semantic_chunks.append(chunk)
                            if len(semantic_chunks) >= top_k:
                                break
                    if len(semantic_chunks) >= top_k:
                        break
                
                log_time(f"  ✓ Matched {len(semantic_chunks)} semantic chunks")
                
                # Combine and deduplicate
                all_chunks = first_chunks + semantic_chunks
                seen = set()
                unique = []
                for chunk in all_chunks:
                    content = chunk.get('content', '')
                    if content not in seen:
                        seen.add(content)
                        unique.append(chunk)
                
                log_time(f"  ✓ Total unique chunks: {len(unique)} (first {first_n} + semantic {len(semantic_chunks)})")
                return unique
            except Exception as e:
                log_time(f"⚠️  Similarity search failed: {str(e)}, using fallback (first {first_n} chunks)")
                return first_chunks
        else:
            log_time(f"  ⚠️  Retriever not available, using fallback (first {first_n} chunks)")
            return first_chunks
    
    def _analyze_section_with_llm(self, chunks: list, query: str, system_prompt: str) -> dict:
        """Analyze section using LLM"""
        context = "\n\n".join([
            f"[Chunk {i+1}]\n{chunk.get('content', '')}"
            for i, chunk in enumerate(chunks)
        ])
        
        template = f"""{system_prompt}

Context: {{context}}

Task: {{query}}

Respond ONLY with valid JSON."""
        
        prompt = ChatPromptTemplate.from_template(template)
        chain = prompt | self.llm | StrOutputParser()
        response = chain.invoke({"context": context, "query": query})
        
        try:
            response_text = response.strip()
            if response_text.startswith('```'):
                response_text = response_text.split('```')[1]
                if response_text.startswith('json'):
                    response_text = response_text[4:]
            response_text = response_text.strip()
            return json.loads(response_text)
        except:
            return {}
    
    def _merge_section_results(self, results: dict) -> dict:
        """Merge section results into final JSON"""
        return {
            "projectName": results.get("header", {}).get("projectName", "Unknown"),
            "projectLocation": results.get("header", {}).get("projectLocation", {}),
            "projectSector": results.get("header", {}).get("projectSector", ""),
            "schemeName": results.get("header", {}).get("schemeName", ""),
            "executiveSummary": results.get("overview", {}).get("executiveSummary", ""),
            "scopeAndObjectives": {
                "objectives": results.get("overview", {}).get("objectives", []),
                "scope": results.get("overview", {}).get("scope", ""),
                "stakeholders": results.get("overview", {}).get("stakeholders", [])
            },
            "riskAssessment": results.get("riskAssessment", {}).get("risks", []),
            "inconsistencyDetection": {
                "hasInconsistencies": results.get("inconsistencies", {}).get("hasInconsistencies", False),
                "totalInconsistencies": len(results.get("inconsistencies", {}).get("issues", [])),
                "issues": results.get("inconsistencies", {}).get("issues", [])
            },
            "mdonerComplianceScoring": {
                "scores": results.get("mdonerCompliance", {}).get("scores", {}),
                "overallComplianceScore": results.get("mdonerCompliance", {}).get("overallComplianceScore", 0),
                "complianceGaps": results.get("mdonerCompliance", {}).get("gaps", []),
                "complianceStrengths": results.get("mdonerCompliance", {}).get("strengths", [])
            },
            "analysisMetadata": {
                "sectionalAnalysis": True,
                "sectionsAnalyzed": list(results.keys()),
                "timestamp": datetime.now().isoformat()
            }
        }

    def clear_database(self):
        """Clears the vector database."""
        log_time("🗑️  Clearing vector database...")
        if self.vector_store:
            self.vector_store.delete_collection()
            self.vector_store = None
            self.retriever = None
            log_time("✅ Database cleared")

