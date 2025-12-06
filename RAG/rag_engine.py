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


    def chat(self, query):
        """Answers a query using the RAG pipeline."""
        if not self.retriever:
            return "Please upload a PDF first.", []

        log_time(f"💬 Processing query: {query[:50]}...")
        query_start = time.time()

        # Define prompt
        template = """You are a data extraction assistant. You MUST respond ONLY with valid JSON. Do not include any explanations before or after the JSON.

Context:
{context}

Task: {question}

Output ONLY the JSON object, nothing else."""
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

    def clear_database(self):
        """Clears the vector database."""
        log_time("🗑️  Clearing vector database...")
        if self.vector_store:
            self.vector_store.delete_collection()
            self.vector_store = None
            self.retriever = None
            log_time("✅ Database cleared")

