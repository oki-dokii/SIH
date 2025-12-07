"""
Sectional PDF Analysis Script
Processes stored PDF chunks in separate sections and merges LLM responses into JSON
Uses semantic search with vector embeddings (same as RAG engine)
"""
import json
import os
from typing import Dict, List, Optional
from langchain_ollama import ChatOllama, OllamaEmbeddings
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
from langchain_core.documents import Document
from langchain_community.vectorstores import Chroma
import db


class SectionalPDFAnalyzer:
    """Analyzes PDF chunks in separate sections with semantic search"""
    
    def __init__(self, db_path: str = "data/chat.db", model_name: str = "llama3.1:latest", 
                 persist_directory: str = "./sectional_chroma_db"):
        """
        Initialize the sectional analyzer with vector embeddings
        
        Args:
            db_path: Path to SQLite database containing chunks
            model_name: Ollama model name to use
            persist_directory: Directory for ChromaDB vector store
        """
        self.db_path = db_path
        self.persist_directory = persist_directory
        
        # Initialize LLM
        self.llm = ChatOllama(
            model=model_name, 
            temperature=0.3,
            num_ctx=16384,
            format="json"
        )
        
        # Embeddings will be initialized lazily when needed (same as RAG engine)
        print("🤖 Will use Ollama embeddings (nomic-embed-text) for semantic search")
        self.embedding_function = None
        self.use_semantic_search = False  # Will be set to True when embeddings work
        
        # Vector store will be created per PDF
        self.vector_store = None
        self.retriever = None
        
    def load_chunks(self, pdf_id: int) -> List[Dict]:
        """
        Load all chunks for a PDF from database
        
        Args:
            pdf_id: ID of the PDF to load chunks for
            
        Returns:
            List of chunk dictionaries with content and metadata
        """
        print(f"📚 Loading chunks from database for PDF {pdf_id}...")
        chunks = db.get_pdf_chunks(pdf_id, self.db_path)
        print(f"✓ Loaded {len(chunks)} chunks")
        return chunks
    
    def create_vector_store(self, chunks: List[Dict]) -> None:
        """
        Create vector embeddings for all chunks and store in ChromaDB
        (Same as RAG engine approach)
        
        Args:
            chunks: List of all chunks from PDF
        """
        # Initialize embeddings if not done yet (lazy initialization)
        if self.embedding_function is None:
            print("🤖 Initializing Ollama embeddings (nomic-embed-text)...")
            try:
                self.embedding_function = OllamaEmbeddings(model="nomic-embed-text")
                self.use_semantic_search = True
                print("✅ Embeddings initialized")
            except Exception as e:
                print(f"⚠️  Failed to initialize embeddings: {str(e)}")
                raise
        
        print(f"🧮 Creating vector embeddings for {len(chunks)} chunks...")
        
        # Convert chunks to LangChain Document objects
        documents = []
        for idx, chunk in enumerate(chunks):
            doc = Document(
                page_content=chunk.get('content', ''),
                metadata={
                    'chunk_id': chunk.get('id'),
                    'page': chunk.get('metadata', {}).get('page'),
                    'source': chunk.get('metadata', {}).get('source'),
                    'index': idx
                }
            )
            documents.append(doc)
        
        # Create ChromaDB vector store with embeddings
        self.vector_store = Chroma.from_documents(
            documents=documents,
            embedding=self.embedding_function,
            persist_directory=self.persist_directory
        )
        
        print(f"✅ Vector store created with {len(documents)} embeddings")
    
    def filter_chunks_semantic(self, chunks: List[Dict], section_query: str, 
                               first_n: int = 20, top_k: int = 30) -> List[Dict]:
        """
        Semantic chunk filtering using vector similarity (RAG engine approach)
        
        This uses:
        - First N chunks for project context
        - Top K semantically similar chunks based on vector embeddings
        - ChromaDB with cosine similarity (same as RAG engine)
        
        Args:
            chunks: List of all chunks
            section_query: Query/description of what to find for this section
            first_n: Number of first chunks to always include (default: 20)
            top_k: Number of semantically similar chunks to retrieve (default: 30)
            
        Returns:
            Combined and deduplicated list of relevant chunks
        """
        # Step 1: Take first N chunks (for project context)
        first_chunks = chunks[:first_n]
        
        # Step 2: Use semantic search to find top K relevant chunks
        if self.vector_store is None:
            print("⚠️  Vector store not initialized, creating now...")
            self.create_vector_store(chunks)
        
        # Create retriever for similarity search
        retriever = self.vector_store.as_retriever(
            search_type="similarity",
            search_kwargs={"k": top_k}
        )
        
        # Perform semantic search
        print(f"🔍 Performing semantic search: '{section_query[:50]}...'")
        relevant_docs = retriever.invoke(section_query)
        
        # Convert back to chunk format
        semantic_chunks = []
        for doc in relevant_docs:
            # Find original chunk by index
            chunk_idx = doc.metadata.get('index')
            if chunk_idx is not None and chunk_idx < len(chunks):
                semantic_chunks.append(chunks[chunk_idx])
        
        # Step 3: Combine first_chunks + semantic_chunks
        all_chunks = first_chunks + semantic_chunks
        
        # Step 4: Deduplicate based on content
        seen_contents = set()
        unique_chunks = []
        for chunk in all_chunks:
            content = chunk.get('content', '')
            if content not in seen_contents:
                seen_contents.add(content)
                unique_chunks.append(chunk)
        
        print(f"✅ Retrieved {len(unique_chunks)} unique chunks (semantic + first {first_n})")
        return unique_chunks
    
    def cleanup_vector_store(self) -> None:
        """Clean up vector store after analysis"""
        if self.vector_store:
            try:
                self.vector_store.delete_collection()
                print("🗑️  Vector store cleaned up")
            except:
                pass
            self.vector_store = None
            self.retriever = None
    
    def filter_chunks_keyword_fallback(self, chunks: List[Dict], semantic_query: str,
                                       first_n: int = 20, top_k: int = 30) -> List[Dict]:
        """
        Fallback keyword-based filtering when semantic search is unavailable
        
        Args:
            chunks: List of all chunks
            semantic_query: Query string (will extract keywords from it)
            first_n: Number of first chunks
            top_k: Number of keyword-matched chunks
            
        Returns:
            Combined list of chunks
        """
        # Extract keywords from semantic query
        keywords = [kw.strip().lower() for kw in semantic_query.split(',')]
        
        # First chunks
        first_chunks = chunks[:first_n]
        
        # Keyword matches
        keyword_matches = []
        for chunk in chunks:
            content = chunk.get('content', '').lower()
            if any(kw in content for kw in keywords):
                keyword_matches.append(chunk)
                if len(keyword_matches) >= top_k:
                    break
        
        # Combine and deduplicate
        all_chunks = first_chunks + keyword_matches
        seen = set()
        unique = []
        for chunk in all_chunks:
            content = chunk.get('content', '')
            if content not in seen:
                seen.add(content)
                unique.append(chunk)
        
        print(f"📌 Retrieved {len(unique)} chunks (keyword fallback: first {first_n} + top {len(keyword_matches)} matched)")
        return unique
    
    def analyze_section(self, chunks: List[Dict], section_name: str, query: str, system_prompt: str) -> Dict:
        """
        Analyze a specific section with filtered chunks
        
        Args:
            chunks: Filtered chunks for this section
            section_name: Name of the section (for logging)
            query: User query/instruction for this section
            system_prompt: System instruction for LLM
            
        Returns:
            Parsed JSON response from LLM
        """
        print(f"\n⏳ Analyzing {section_name} section with {len(chunks)} chunks...")
        
        # Combine chunk contents into context
        context = "\n\n".join([
            f"[Chunk {i+1} - Page {chunk.get('metadata', {}).get('page', '?')}]\n{chunk.get('content', '')}"
            for i, chunk in enumerate(chunks)
        ])
        
        # Create prompt template
        template = f"""{system_prompt}

Context from PDF:
{{context}}

Task: {{query}}

Respond ONLY with valid JSON, no additional text."""
        
        prompt = ChatPromptTemplate.from_template(template)
        
        # Create chain
        chain = prompt | self.llm | StrOutputParser()
        
        # Get response
        response = chain.invoke({"context": context, "query": query})
        
        # Parse JSON
        try:
            # Clean response (remove markdown if present)
            response_text = response.strip()
            if response_text.startswith('```json'):
                response_text = response_text[7:]
            elif response_text.startswith('```'):
                response_text = response_text[3:]
            if response_text.endswith('```'):
                response_text = response_text[:-3]
            response_text = response_text.strip()
            
            result = json.loads(response_text)
            print(f"✓ {section_name} analysis complete")
            return result
            
        except json.JSONDecodeError as e:
            print(f"✗ Failed to parse JSON for {section_name}: {e}")
            print(f"Raw response: {response[:200]}...")
            return {"error": f"JSON parsing failed: {str(e)}", "raw_response": response}
    
    def analyze_pdf(self, pdf_id: int) -> Dict:
        """
        Analyze PDF in sections and merge results
        
        Args:
            pdf_id: ID of the PDF to analyze
            
        Returns:
            Merged JSON with all section analyses
        """
        print(f"\n{'='*60}")
        print(f"Starting Sectional Analysis for PDF {pdf_id}")
        print(f"{'='*60}")
        
        # Load all chunks
        all_chunks = self.load_chunks(pdf_id)
        
        if not all_chunks:
            raise ValueError(f"No chunks found for PDF {pdf_id}")
        
        # Define sections with their configurations
        # Using semantic search with vector embeddings (same as RAG engine)
        sections = {
            "header": {
                "semantic_query": "project name, project title, location, state, district, sector, scheme name, implementing agency",
                "query": """Extract the header information including:
- Project name
- Project location (state, districts)
- Project sector
- Scheme name
Return as JSON with keys: projectName, projectLocation, projectSector, schemeName""",
                "system_prompt": "You are a data extraction assistant specialized in identifying project header information from DPR documents."
            },
            
            "overview": {
                "semantic_query": "executive summary, project overview, introduction, background, objectives, purpose, goals, scope, deliverables",
                "query": """Extract the project overview including:
- Executive summary
- Project objectives
- Scope and deliverables
- Key stakeholders
Return as JSON with keys: executiveSummary, objectives, scope, stakeholders""",
                "system_prompt": "You are a data extraction assistant specialized in summarizing project overviews from DPR documents."
            },
            
            "riskAssessment": {
                "semantic_query": "risks, challenges, threats, problems, issues, mitigation strategies, risk management, contingency plans",
                "query": """Identify and analyze project risks:
- List top risks with severity (HIGH/MEDIUM/LOW)
- Provide mitigation strategies for each risk
- Include evidence/page references
Return as JSON with key: risks (array of objects with: name, severity, mitigation, evidence)""",
                "system_prompt": "You are a risk assessment expert analyzing project risks from DPR documents."
            },
            
            "inconsistencies": {
                "semantic_query": "budget calculations, cost breakdown, financial totals, timeline schedule, beneficiary numbers, data inconsistencies, errors",
                "query": """Detect inconsistencies in the document:
- Financial calculation errors (sums not matching)
- Timeline conflicts
- Contradicting data between sections
- Missing critical information
Return as JSON with keys: hasInconsistencies (boolean), issues (array of objects with: category, severity, description, location, impact)""",
                "system_prompt": "You are a quality assurance expert detecting inconsistencies and errors in DPR documents."
            },
            
            "mdonerCompliance": {
                "semantic_query": "north eastern region, tribal communities, environmental clearance, compliance, land acquisition, beneficiary targeting, MDoNER guidelines",
                "query": """Assess MDoNER compliance:
- North Eastern focus (0-100 score)
- Beneficiary alignment (0-100 score)
- Environmental compliance (0-100 score)
- Land acquisition clarity (0-100 score)
- Documentation quality (0-100 score)
- Overall compliance score (weighted average)
- List gaps and strengths
Return as JSON with keys: scores (object), overallComplianceScore, gaps (array), strengths (array)""",
                "system_prompt": "You are a compliance expert assessing DPR documents against MDoNER guidelines."
            }
        }
        
        # Analyze each section
        results = {}
        
        for section_name, config in sections.items():
            print(f"\n{'─'*60}")
            print(f"Section: {section_name.upper()}")
            print(f"{'─'*60}")
            
            # Always try semantic search first, use keyword fallback if it fails
            try:
                filtered_chunks = self.filter_chunks_semantic(
                    all_chunks, 
                    config["semantic_query"],
                    first_n=20,
                    top_k=30
                )
            except Exception as e:
                print(f"⚠️  Semantic search failed: {str(e)}")
                print("⚠️  Using keyword fallback for this section")
                filtered_chunks = self.filter_chunks_keyword_fallback(
                    all_chunks,
                    config["semantic_query"],
                    first_n=20,
                    top_k=30
                )
            
            # Analyze section
            section_result = self.analyze_section(
                filtered_chunks,
                section_name,
                config["query"],
                config["system_prompt"]
            )
            
            results[section_name] = section_result
        
        # Clean up vector store
        if self.use_semantic_search:
            self.cleanup_vector_store()
        
        # Merge all results into final JSON
        final_json = self.merge_results(results)
        
        print(f"\n{'='*60}")
        print(f"✅ Sectional Analysis Complete")
        print(f"{'='*60}")
        
        return final_json
    
    def merge_results(self, results: Dict) -> Dict:
        """
        Merge section results into a single structured JSON
        
        Args:
            results: Dictionary with section names as keys and their analyses as values
            
        Returns:
            Merged JSON in the format expected by frontend
        """
        print(f"\n🔗 Merging {len(results)} section results...")
        
        merged = {
            # Header section
            "projectName": results.get("header", {}).get("projectName", "Unknown Project"),
            "projectLocation": results.get("header", {}).get("projectLocation", {}),
            "projectSector": results.get("header", {}).get("projectSector", ""),
            "schemeName": results.get("header", {}).get("schemeName", ""),
            
            # Overview section
            "executiveSummary": results.get("overview", {}).get("executiveSummary", ""),
            "scopeAndObjectives": {
                "objectives": results.get("overview", {}).get("objectives", []),
                "scope": results.get("overview", {}).get("scope", ""),
                "stakeholders": results.get("overview", {}).get("stakeholders", [])
            },
            
            # Risk assessment section
            "riskAssessment": results.get("riskAssessment", {}).get("risks", []),
            
            # Inconsistencies section
            "inconsistencyDetection": {
                "hasInconsistencies": results.get("inconsistencies", {}).get("hasInconsistencies", False),
                "totalInconsistencies": len(results.get("inconsistencies", {}).get("issues", [])),
                "issues": results.get("inconsistencies", {}).get("issues", [])
            },
            
            # MDoNER compliance section
            "mdonerComplianceScoring": {
                "scores": results.get("mdonerCompliance", {}).get("scores", {}),
                "overallComplianceScore": results.get("mdonerCompliance", {}).get("overallComplianceScore", 0),
                "complianceGaps": results.get("mdonerCompliance", {}).get("gaps", []),
                "complianceStrengths": results.get("mdonerCompliance", {}).get("strengths", [])
            },
            
            # Metadata
            "analysisMetadata": {
                "sectionalAnalysis": True,
                "sectionsAnalyzed": list(results.keys()),
                "timestamp": self._get_timestamp()
            }
        }
        
        print(f"✓ Results merged successfully")
        return merged
    
    def _get_timestamp(self) -> str:
        """Get current timestamp in ISO format"""
        from datetime import datetime
        return datetime.now().isoformat()
    
    def save_to_file(self, data: Dict, output_path: str) -> None:
        """
        Save JSON data to file
        
        Args:
            data: JSON data to save
            output_path: Path to output file
        """
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        print(f"💾 Saved analysis to: {output_path}")


# Example usage
if __name__ == "__main__":
    # Initialize analyzer
    analyzer = SectionalPDFAnalyzer(
        db_path="data/chat.db",
        model_name="llama3.1:latest"
    )
    
    # Analyze a PDF (replace with actual PDF ID)
    pdf_id = 1  # TODO: Replace with actual PDF ID
    
    try:
        # Run sectional analysis
        result = analyzer.analyze_pdf(pdf_id)
        
        # Save to file
        output_file = f"data/sectional_analysis_{pdf_id}.json"
        analyzer.save_to_file(result, output_file)
        
        print(f"\n✅ Analysis complete! Check {output_file}")
        
    except Exception as e:
        print(f"\n✗ Analysis failed: {str(e)}")
        import traceback
        traceback.print_exc()
