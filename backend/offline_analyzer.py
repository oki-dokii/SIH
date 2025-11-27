"""
Offline DPR Analyzer using RAG Pipeline

This module wraps the RAG engine to provide offline analysis capabilities.
It uses Docling for PDF parsing, ChromaDB for vector storage, and Ollama for LLM operations.

IMPORTANT: GPU memory is carefully managed - Docling resources are freed before Ollama operations.
"""

import os
import sys
import json
import gc
import torch
from pathlib import Path

# Add RAG directory to path for imports
RAG_PATH = Path(__file__).parent.parent / "RAG"
sys.path.insert(0, str(RAG_PATH))

from rag_engine import RAGEngine, log_time


class OfflineAnalyzer:
    """
    Offline DPR analyzer using local LLM and RAG pipeline.
    
    This class orchestrates the following workflow:
    1. Parse PDF with Docling (GPU-accelerated)
    2. Free GPU memory from Docling
    3. Generate embeddings and build vector store (ChromaDB)
    4. Run 4 sequential prompts using Ollama (llama3.1:latest)
    5. Combine results into local_json schema
    """
    
    def __init__(self, persist_directory: str = "./data/chroma_db"):
        """
        Initialize the offline analyzer.
        
        Args:
            persist_directory: Directory to persist the ChromaDB vector store
        """
        self.persist_directory = persist_directory
        self.rag_engine = None
        
    def analyze_dpr(self, pdf_path: str) -> dict:
        """
        Analyze a DPR PDF using the local RAG pipeline.
        
        Args:
            pdf_path: Path to the PDF file
            
        Returns:
            Dictionary containing the 4-section analysis
        """
        log_time(f"Starting offline analysis for: {os.path.basename(pdf_path)}")
        
        try:
            # Initialize RAG engine
            log_time("Initializing RAG engine...")
            self.rag_engine = RAGEngine(persist_directory=self.persist_directory)
            
            # Process PDF (Docling -> Embeddings -> Chroma)
            log_time("Processing PDF with Docling...")
            chunk_count = self.rag_engine.process_pdf(pdf_path)
            log_time(f"PDF processed: {chunk_count} chunks created")
            
            # CRITICAL: Ensure GPU memory is freed after Docling
            # (This is already handled in rag_engine.py's parse_pdf_with_docling)
            
            # Run 4 sequential prompts to generate analysis sections
            log_time("Starting sequential analysis (4 sections)...")
            analysis_result = {}
            
            # Placeholder structure for 4 prompts (to be filled by user)
            prompts = [
                {"section": "section1", "query": ""},  # TBD
                {"section": "section2", "query": ""},  # TBD
                {"section": "section3", "query": ""},  # TBD
                {"section": "section4", "query": ""},  # TBD
            ]
            
            for i, prompt_config in enumerate(prompts, 1):
                section_name = prompt_config["section"]
                query = prompt_config["query"]
                
                if not query:
                    # Placeholder: Keep section empty if no query defined
                    log_time(f"Skipping {section_name} (no query defined)")
                    analysis_result[section_name] = {}
                    continue
                
                log_time(f"Generating {section_name}...")
                answer, sources = self.rag_engine.chat(query)
                
                # Store result (structure TBD based on user's schema)
                analysis_result[section_name] = {
                    "answer": answer,
                    "sources": sources
                }
                log_time(f"{section_name} complete")
            
            log_time("Offline analysis complete!")
            return analysis_result
            
        except Exception as e:
            log_time(f"Offline analysis failed: {str(e)}")
            raise
        finally:
            # Clean up
            if self.rag_engine:
                self.rag_engine.clear_database()
                # Force garbage collection to free memory
                del self.rag_engine
                self.rag_engine = None
                gc.collect()
                if torch.cuda.is_available():
                    torch.cuda.empty_cache()
                log_time("Cleanup complete")


def test_offline_analyzer():
    """Test function for offline analyzer."""
    import argparse
    
    parser = argparse.ArgumentParser(description="Test Offline DPR Analyzer")
    parser.add_argument("pdf_path", help="Path to PDF file to analyze")
    args = parser.parse_args()
    
    analyzer = OfflineAnalyzer()
    result = analyzer.analyze_dpr(args.pdf_path)
    
    print("\n\n=== ANALYSIS RESULT ===")
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    test_offline_analyzer()
