
import os
import json
import traceback
import time
import gc
from datetime import datetime
from typing import Dict, List, Optional, Callable
import torch

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
                headers = []
                rows = []
                
                if len(table_data) > 1:
                    first_row = table_data[0]
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
    IMPORTANT: GPU memory is freed after processing to allow LLM to use GPU.
    """
    # Import here to avoid DLL conflicts
    from docling.document_converter import DocumentConverter, PdfFormatOption
    from docling.datamodel.base_models import InputFormat
    from docling.datamodel.pipeline_options import PdfPipelineOptions

    log_time("🔧 Configuring Docling pipeline...")
    # Configure pipeline to skip image processing
    pipeline_options = PdfPipelineOptions()
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
    
    log_time("📄 Starting Docling conversion (this uses GPU for layout analysis)...")
    start_convert = time.time()
    
    # Convert the document
    result = converter.convert(pdf_path)
    doc = result.document
    
    elapsed_convert = time.time() - start_convert
    log_time(f"✅ Docling conversion complete in {elapsed_convert:.2f}s")
    
    # FREE GPU MEMORY: Delete converter and clear CUDA cache
    log_time("🧹 Freeing GPU memory (clearing Docling models)...")
    del converter
    gc.collect()  # Force Python garbage collection
    if torch.cuda.is_available():
        torch.cuda.empty_cache()  # Clear CUDA cache
    log_time("✅ GPU memory freed")
    
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


class OfflineAnalyzer:
    """
    Offline DPR analysis engine using local LLM.
    Provides modular analysis with progress tracking.
    """
    
    def __init__(self, persist_directory="./chroma_db"):
        self.persist_directory = persist_directory
        log_time("🤖 Initializing Ollama embeddings (nomic-embed-text)...")
        self.embedding_function = OllamaEmbeddings(model="nomic-embed-text")
        self.vector_store = None
        self.retriever = None
        log_time("🤖 Initializing Ollama LLM (llama3.1:latest)...")
        self.llm = ChatOllama(model="llama3.1:latest", temperature=0, num_ctx=16384)
        self.first_30_chunks = []
        self.all_chunks = []
        
    def process_pdf_offline(
        self, 
        file_path: str, 
        dpr_id: int,
        progress_callback: Optional[Callable[[str, Dict], None]] = None
    ) -> Dict:
        """
        Process PDF and generate offline analysis in stages.
        
        Args:
            file_path: Path to PDF file
            dpr_id: DPR ID for tracking
            progress_callback: Function to call with progress updates (status, partial_data)
            
        Returns:
            Complete analysis JSON
        """
        log_time(f"🚀 Starting offline PDF processing: {os.path.basename(file_path)}")
        
        # Stage 1: Parse PDF
        if progress_callback:
            progress_callback("Parsing PDF with Docling...", {})
        
        parsed_elements = parse_pdf_with_docling(file_path)
        
        # Stage 2: Create documents
        if progress_callback:
            progress_callback("Converting elements to documents...", {})
        
        docs = []
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
        
        # Stage 3: Chunk documents
        if progress_callback:
            progress_callback("Chunking text...", {})
        
        text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=1000,
            chunk_overlap=200,
            add_start_index=True
        )
        
        splits = text_splitter.split_documents(docs)
        self.all_chunks = splits
        self.first_30_chunks = splits[:30]
        
        # Stage 4: Create vector store
        if progress_callback:
            progress_callback("Creating vector embeddings...", {})
        
        self.vector_store = Chroma.from_documents(
            documents=splits,
            embedding=self.embedding_function,
            persist_directory=self.persist_directory
        )
        
        self.retriever = self.vector_store.as_retriever(
            search_type="similarity",
            search_kwargs={"k": 20}
        )
        
        # Now run modular analysis
        analysis = {}
        
        # Stage 5: Risk Analysis
        if progress_callback:
            progress_callback("Analyzing risks...", {})
        
        risk_data = self.analyze_risk()
        analysis['riskAssessment'] = risk_data
        if progress_callback:
            progress_callback("Risk analysis complete", {"riskAssessment": risk_data})
        
        # Stage 6: Compliance Check
        if progress_callback:
            progress_callback("Checking compliance...", {})
        
        compliance_data = self.analyze_compliance()
        analysis['complianceCheck'] = compliance_data
        if progress_callback:
            progress_callback("Compliance check complete", {"complianceCheck": compliance_data})
        
        # Stage 7: Financial Analysis
        if progress_callback:
            progress_callback("Analyzing financials...", {})
        
        financial_data = self.analyze_financials()
        analysis['financialAnalysis'] = financial_data
        if progress_callback:
            progress_callback("Financial analysis complete", {"financialAnalysis": financial_data})
        
        # Stage 8: Summary
        if progress_callback:
            progress_callback("Generating summary...", {})
        
        summary_data = self.generate_summary()
        analysis.update(summary_data)
        if progress_callback:
            progress_callback("Analysis complete", analysis)
        
        return analysis
    
    def analyze_risk(self) -> List[Dict]:
        """Analyze risks from the document."""
        log_time("🔍 Analyzing risks...")
        
        # Retrieve risk-related chunks
        risk_queries = [
            "risks challenges threats problems issues",
            "risk mitigation risk management",
            "uncertainties vulnerabilities"
        ]
        
        relevant_chunks = []
        for query in risk_queries:
            chunks = self.retriever.invoke(query)
            relevant_chunks.extend(chunks)
        
        # Deduplicate
        seen = set()
        unique_chunks = []
        for chunk in relevant_chunks[:10]:  # Top 10
            if chunk.page_content not in seen:
                seen.add(chunk.page_content)
                unique_chunks.append(chunk)
        
        context = "\n\n".join([c.page_content for c in unique_chunks])
        
        prompt = f"""Based on the following text from a project report, identify the top 3-5 risks.
For each risk, provide:
- riskCategory: Brief category name
- severity: HIGH, MEDIUM, or LOW
- description: Brief description of the risk
- evidence: Where you found this (page number if available)

Return ONLY a JSON array of risk objects.

Context:
{context}

JSON Array:"""

        response = self.llm.invoke(prompt)
        
        try:
            # Clean response
            text = response.content.strip()
            if text.startswith('```json'):
                text = text[7:]
            elif text.startswith('```'):
                text = text[3:]
            if text.endswith('```'):
                text = text[:-3]
            text = text.strip()
            
            risks = json.loads(text)
            if not isinstance(risks, list):
                risks = [risks]
            
            log_time(f"✅ Identified {len(risks)} risks")
            return risks
        except Exception as e:
            log_time(f"⚠️ Risk parsing failed: {e}")
            return [{
                "riskCategory": "Analysis Error",
                "severity": "MEDIUM",
                "description": "Unable to parse risk analysis",
                "evidence": "Offline mode"
            }]
    
    def analyze_compliance(self) -> Dict:
        """Analyze compliance requirements."""
        log_time("🔍 Checking compliance...")
        
        # Retrieve compliance-related chunks
        compliance_queries = [
            "compliance statutory permits clearances approvals",
            "environmental clearance forest clearance",
            "legal requirements regulations"
        ]
        
        relevant_chunks = []
        for query in compliance_queries:
            chunks = self.retriever.invoke(query)
            relevant_chunks.extend(chunks)
        
        # Deduplicate
        seen = set()
        unique_chunks = []
        for chunk in relevant_chunks[:10]:
            if chunk.page_content not in seen:
                seen.add(chunk.page_content)
                unique_chunks.append(chunk)
        
        context = "\n\n".join([c.page_content for c in unique_chunks])
        
        prompt = f"""Based on the following text from a project report, identify compliance requirements.
Return a JSON object with:
- statutoryAndPermits: array of required permits/clearances
- EHS: array of environmental, health, safety requirements
- labour: string describing labour compliance
- gapsOrUnknowns: array of missing or unclear compliance items

Return ONLY the JSON object.

Context:
{context}

JSON Object:"""

        response = self.llm.invoke(prompt)
        
        try:
            text = response.content.strip()
            if text.startswith('```json'):
                text = text[7:]
            elif text.startswith('```'):
                text = text[3:]
            if text.endswith('```'):
                text = text[:-3]
            text = text.strip()
            
            compliance = json.loads(text)
            log_time(f"✅ Compliance analysis complete")
            return compliance
        except Exception as e:
            log_time(f"⚠️ Compliance parsing failed: {e}")
            return {
                "statutoryAndPermits": ["Unable to parse"],
                "EHS": ["Unable to parse"],
                "labour": "Unable to parse",
                "gapsOrUnknowns": ["Analysis error in offline mode"]
            }
    
    def analyze_financials(self) -> Dict:
        """Analyze financial data from tables and text."""
        log_time("🔍 Analyzing financials...")
        
        # Retrieve financial chunks (prioritize tables)
        financial_queries = [
            "cost budget investment capital expenditure",
            "revenue income profit",
            "financial analysis IRR DSCR"
        ]
        
        relevant_chunks = []
        for query in financial_queries:
            chunks = self.retriever.invoke(query)
            relevant_chunks.extend(chunks)
        
        # Prioritize table chunks
        table_chunks = [c for c in relevant_chunks if c.metadata.get('type') == 'table']
        text_chunks = [c for c in relevant_chunks if c.metadata.get('type') == 'text']
        
        # Use tables first, then text
        priority_chunks = (table_chunks + text_chunks)[:10]
        
        context = "\n\n".join([c.page_content for c in priority_chunks])
        
        prompt = f"""Based on the following text and tables from a project report, extract financial information.
Return a JSON object with:
- totalProjectCostLakh: total project cost in lakhs (number or null)
- capitalExpenditureLakh: capital expenditure in lakhs (number or null)
- workingCapitalLakh: working capital in lakhs (number or null)
- subsidyLakh: subsidy amount in lakhs (number or null)
- loanLakh: loan amount in lakhs (number or null)
- irrPercent: Internal Rate of Return in percent (number or null)
- dscrAvg: Debt Service Coverage Ratio (number or null)
- summary: brief summary of financial status

Return ONLY the JSON object. Use null for unavailable values.

Context:
{context}

JSON Object:"""

        response = self.llm.invoke(prompt)
        
        try:
            text = response.content.strip()
            if text.startswith('```json'):
                text = text[7:]
            elif text.startswith('```'):
                text = text[3:]
            if text.endswith('```'):
                text = text[:-3]
            text = text.strip()
            
            financials = json.loads(text)
            log_time(f"✅ Financial analysis complete")
            return financials
        except Exception as e:
            log_time(f"⚠️ Financial parsing failed: {e}")
            return {
                "totalProjectCostLakh": None,
                "summary": "Unable to parse financial data in offline mode"
            }
    
    def generate_summary(self) -> Dict:
        """Generate overall summary and basic fields."""
        log_time("🔍 Generating summary...")
        
        # Use first 30 chunks for context
        context = "\n\n".join([c.page_content for c in self.first_30_chunks[:10]])
        
        prompt = f"""Based on the following text from a project report, extract basic information.
Return a JSON object with:
- projectName: name of the project
- projectLocation: object with state and districts (can be null)
- projectSector: sector (e.g., Agriculture, Infrastructure)
- executiveSummary: 2-3 sentence summary
- recommendation: one of ["Approved", "Approved with Conditions", "Needs Review", "Rejected"]
- overallScore: score from 0-100 (your assessment)

Return ONLY the JSON object.

Context:
{context}

JSON Object:"""

        response = self.llm.invoke(prompt)
        
        try:
            text = response.content.strip()
            if text.startswith('```json'):
                text = text[7:]
            elif text.startswith('```'):
                text = text[3:]
            if text.endswith('```'):
                text = text[:-3]
            text = text.strip()
            
            summary = json.loads(text)
            log_time(f"✅ Summary generation complete")
            return summary
        except Exception as e:
            log_time(f"⚠️ Summary parsing failed: {e}")
            return {
                "projectName": "Unknown Project",
                "projectLocation": {"state": "Unknown", "districts": []},
                "projectSector": "Unknown",
                "executiveSummary": "Unable to generate summary in offline mode",
                "recommendation": "Needs Review",
                "overallScore": 50
            }
    
    def chat(self, query: str):
        """Answer a query using the RAG pipeline."""
        if not self.retriever:
            return "Please process a PDF first.", []

        log_time(f"💬 Processing query: {query[:50]}...")

        # Define prompt
        template = """You are a helpful assistant analyzing a project report.
Use the following context to answer the question.
Provide a clear, well-structured answer.

Context:
{context}

Question: {question}
"""
        prompt = ChatPromptTemplate.from_template(template)

        # Custom retrieval logic to combine first 30 chunks + vector search
        def combined_retriever(q):
            log_time("🔍 Retrieving relevant chunks...")
            relevant_docs = self.retriever.invoke(q)
            # Combine and deduplicate
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
        answer = retrieval_chain.invoke(query)
        
        # Get sources
        source_docs = combined_retriever(query)
        sources = []
        for doc in source_docs:
            sources.append(f"Page {doc.metadata.get('page', '?')}")
        
        log_time(f"✅ Query complete")
        
        return answer, list(set(sources))
    
    def clear_database(self):
        """Clear the vector database."""
        log_time("🗑️  Clearing vector database...")
        if self.vector_store:
            self.vector_store.delete_collection()
            self.vector_store = None
            self.retriever = None
            log_time("✅ Database cleared")
