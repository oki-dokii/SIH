# Offline RAG PDF Chat System

## SYSTEM OVERVIEW

This is a fully offline Retrieval-Augmented Generation (RAG) system for conversational PDF analysis. All components run locally without internet connectivity after initial setup.

**Architecture Type**: RAG with context boosting via hybrid retrieval (semantic search + positional context)

**Core Components**:
1. PDF Parser (Docling) - GPU-accelerated layout analysis with table extraction
2. Vector Store (ChromaDB) - Persistent embedding database
3. Embedding Model (Ollama: nomic-embed-text) - 768-dimensional semantic vectors
4. LLM (Ollama: llama3.1:latest) - 8B parameter model with 16k context window
5. UI (Streamlit) - Web-based chat interface

---

## FILE STRUCTURE AND RESPONSIBILITIES

### `rag_engine.py` (Core Logic - 313 lines)

**Purpose**: Encapsulates all RAG pipeline logic in a single class

**Class**: `RAGEngine`

**Key Methods**:

1. `__init__(persist_directory="./chroma_db")`
   - Initializes Ollama embeddings (nomic-embed-text)
   - Initializes Ollama LLM (llama3.1, 16k context)
   - Loads existing vector store if present
   - Sets up retriever with k=20 similarity search

2. `process_pdf(file_path: str) -> int`
   - **Input**: Absolute path to PDF file
   - **Output**: Number of chunks created
   - **Process**:
     1. Calls `parse_pdf_with_docling()` to extract structured content
     2. Converts tables to Markdown format
     3. Chunks text using RecursiveCharacterTextSplitter (1000 chars, 200 overlap)
     4. Stores first 30 chunks in `self.first_30_chunks` for context boosting
     5. Generates embeddings via Ollama (GPU accelerated)
     6. Persists to ChromaDB
     7. **Critical**: Frees GPU memory after Docling processing (see Memory Management)

3. `chat(query: str) -> Tuple[str, List[str]]`
   - **Input**: User query string
   - **Output**: (answer, list of page citations)
   - **Retrieval Strategy**: Hybrid approach
     - Combines first 30 chunks (positional) + top 20 semantic matches (vector)
     - Deduplicates by content hash
     - Typical result: 30-50 unique chunks sent to LLM
   - **Prompt Template**: Instructs LLM to use context comprehensively

4. `clear_database()`
   - Deletes ChromaDB collection
   - Resets retriever to None
   - Called before processing new PDF to prevent cross-document contamination

**Helper Function**: `parse_pdf_with_docling(pdf_path: str) -> List[Dict]`
- Configures Docling pipeline (OCR=False, table_structure=True, images=False)
- Runs GPU-based layout analysis
- **Memory Management**: Explicitly deletes converter and clears CUDA cache after parsing
- Returns simplified list of text/table elements with page numbers

**Helper Function**: `simplify_docling_output(raw_data: dict) -> List[Dict]`
- Traverses Docling's hierarchical JSON structure
- Resolves `$ref` pointers to actual content
- Flattens to linear reading order
- Detects table headers vs data rows

**Helper Function**: `log_time(message: str)`
- Prints timestamped logs for performance profiling
- Format: `[HH:MM:SS.mmm] message`

---

### `app.py` (UI Layer - 90 lines)

**Purpose**: Streamlit web interface with session state management

**Key Components**:

1. **Cached Resource**: `get_engine()`
   - Uses `@st.cache_resource` to singleton the RAGEngine
   - Engine persists across Streamlit reruns
   - Critical for maintaining vector store connection

2. **Session State Variables**:
   - `messages`: List[Dict] - Chat history (role, content)
   - `processed_file`: str - Name of currently loaded PDF (prevents reprocessing)

3. **Sidebar Upload Logic**:
   - Detects new file uploads
   - Calls `engine.clear_database()` before processing
   - Uses `tempfile.NamedTemporaryFile` for safe file handling
   - Displays chunk count on success

4. **Chat Interface**:
   - Iterates `st.session_state.messages` for history display
   - `st.chat_input()` for user queries
   - Appends sources as formatted Markdown list

**Critical Flow**:
```
Upload PDF → Clear DB → Process → Store chunks → User query → Retrieve → LLM → Display
```

---

### `download_docling.py` (Setup Utility - 13 lines)

**Purpose**: Pre-cache Docling's layout models for offline use

**Process**:
1. Initializes `StandardPdfPipeline` with OCR disabled
2. Triggers first-time model download from HuggingFace
3. Models cached to `~/.cache/huggingface/`
4. Run once with internet, then fully offline

**Usage**: `python download_docling.py`

---

### `download_model.py` (Legacy Setup Utility - 15 lines)

**Purpose**: Originally used to download HuggingFace embeddings locally

**Status**: OBSOLETE (replaced by Ollama embeddings)

**Historical Context**: 
- Previous system used `HuggingFaceEmbeddings` with `all-MiniLM-L6-v2`
- Required local model cache to avoid HuggingFace API calls
- Switched to `OllamaEmbeddings(nomic-embed-text)` for unified stack

---

### `requirements.txt` (Dependency Manifest)

**Critical Dependencies**:

1. `streamlit` - Web UI framework
2. `langchain-community` - Vector store integrations (Chroma)
3. `langchain-ollama` - Ollama LLM/embedding wrappers
4. `chromadb` - Persistent vector database
5. `docling` - PDF parsing with layout analysis (requires PyTorch)
6. `sentence-transformers` - Transitive dependency of langchain-huggingface
7. `torch` - Required for Docling GPU acceleration

**Installation**: `pip install -r requirements.txt`

**Note**: User must install GPU-enabled PyTorch separately:
```bash
pip uninstall torch torchvision torchaudio
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu118
```

---

## DATA FLOW ARCHITECTURE

### PDF Processing Pipeline

```
PDF File
  ↓
[Docling Converter]
  ├─ GPU Layout Analysis (50-60s for 30-page PDF)
  ├─ Table Detection + Header Recognition
  └─ Reading Order Preservation
  ↓
[Raw Docling JSON]
  ├─ Hierarchical structure with $ref pointers
  └─ Contains: texts[], tables[], body.children[]
  ↓
[simplify_docling_output()]
  ├─ Flatten to linear list
  ├─ Resolve references
  └─ Convert tables to Markdown
  ↓
[List[Document]]
  ├─ Text blocks: {content, page, source, type="text"}
  └─ Tables: {markdown_table, page, source, type="table"}
  ↓
[RecursiveCharacterTextSplitter]
  ├─ chunk_size=1000 chars
  ├─ chunk_overlap=200 chars
  └─ Preserves metadata
  ↓
[Splits] (typically 100-300 chunks)
  ├─ First 30 → self.first_30_chunks (context boosting)
  └─ All chunks → ChromaDB
  ↓
[Ollama Embeddings]
  ├─ POST http://127.0.0.1:11434/api/embed
  ├─ Model: nomic-embed-text (768-dim vectors)
  └─ GPU accelerated if available
  ↓
[ChromaDB Collection]
  └─ Persisted to ./chroma_db/
```

### Query Pipeline

```
User Query (string)
  ↓
[combined_retriever()]
  ├─ Vector Search (k=20)
  │   └─ POST http://127.0.0.1:11434/api/embed (query)
  ├─ Positional Context (first 30 chunks)
  └─ Deduplication by content hash
  ↓
[Unique Chunks] (typically 30-50 chunks)
  ↓
[Prompt Template Assembly]
  ├─ System instructions
  ├─ Context: concatenated chunk content
  └─ User question
  ↓
[Ollama LLM - llama3.1]
  ├─ POST http://127.0.0.1:11434/api/chat
  ├─ num_ctx=16384 tokens
  ├─ temperature=0 (deterministic)
  └─ Streaming response
  ↓
[Answer String + Source Pages]
```

---

## MEMORY MANAGEMENT STRATEGY

### Problem
Docling loads GPU models (~2GB VRAM) and keeps them resident. When LLM tries to load with large context, GPU runs out of memory.

### Solution (Implemented in `parse_pdf_with_docling()`)

**After Docling Completes**:
```python
# 1. Delete converter object
del converter

# 2. Force Python garbage collection
gc.collect()

# 3. Clear CUDA cache
if torch.cuda.is_available():
    torch.cuda.empty_cache()
```

**Result**: 
- Docling models unloaded
- GPU memory freed (~2GB)
- LLM can load with full context window

**Timing**:
```
[HH:MM:SS] ✅ Docling conversion complete in 51.67s
[HH:MM:SS] 🧹 Freeing GPU memory (clearing Docling models)...
[HH:MM:SS] ✅ GPU memory freed
```

---

## CONFIGURATION PARAMETERS

### Chunking Strategy
```python
chunk_size = 1000      # Characters per chunk
chunk_overlap = 200    # Overlap to preserve context
```

**Rationale**: 1000 chars ≈ 250 tokens. With 50 chunks, total ≈ 12.5k tokens, fits in 16k window.

### Context Window
```python
num_ctx = 16384  # Tokens
```

**Trade-off**: 
- 8192: Stable, low memory, fewer chunks
- 16384: More chunks, better accuracy, requires more RAM (3.9GB)
- 32768: Native llama3.1 max, but crashes on typical hardware

### Retrieval Count
```python
k = 20                        # Semantic search results
first_30_chunks = splits[:30] # Positional context
```

**Hybrid Retrieval Logic**: 
- Semantic (k=20): Finds topically relevant chunks
- Positional (first 30): Ensures intro/abstract/summary included
- Total unique: Typically 30-50 after deduplication

### Docling Pipeline
```python
pipeline_options.generate_picture_images = False  # Ignore images
pipeline_options.do_picture_description = False   # No image captioning
pipeline_options.do_ocr = False                   # Skip OCR
pipeline_options.do_table_structure = True        # Parse table layout
```

**Performance Impact**:
- OCR=False: Saves 50% time on scanned PDFs
- table_structure=True: Critical for extracting tabular data

---

## EXTENSION POINTS FOR AI AGENTS

### 1. Alternative PDF Parsers

**Current**: Docling (GPU-heavy, table-aware)

**Alternatives**:
- PyMuPDF (fitz): Fast, CPU-only, no table detection
  ```python
  import fitz
  doc = fitz.open(pdf_path)
  for page in doc:
      text = page.get_text()
  ```
- Unstructured.io: Another layout-aware parser
  ```python
  from unstructured.partition.pdf import partition_pdf
  elements = partition_pdf(pdf_path)
  ```

**Swap Point**: Replace `parse_pdf_with_docling()` function in `rag_engine.py`

### 2. Embedding Model Swap

**Current**: `OllamaEmbeddings(model="nomic-embed-text")`

**Alternatives**:
- `OllamaEmbeddings(model="mxbai-embed-large")` - Higher dimensional (1024)
- `HuggingFaceEmbeddings(model_name="bge-large-en-v1.5")` - State-of-art (1024 dim)

**Swap Point**: Line 178 in `rag_engine.py`
```python
self.embedding_function = OllamaEmbeddings(model="<MODEL_NAME>")
```

**Critical**: Must re-embed all documents if model changes (different vector spaces)

### 3. LLM Model Swap

**Current**: `ChatOllama(model="llama3.1:latest")`

**Alternatives**:
- `llama3.2:3b` - Smaller, faster, less accurate
- `mistral:latest` - Different instruction format
- `qwen2.5:14b` - Larger, more capable

**Swap Point**: Line 184 in `rag_engine.py`
```python
self.llm = ChatOllama(model="<MODEL_NAME>", temperature=0, num_ctx=<WINDOW>)
```

### 4. Retrieval Strategy

**Current**: Hybrid (semantic + positional)

**Alternative A - Pure Semantic**:
```python
def pure_semantic_retriever(q):
    return self.retriever.invoke(q)  # Just top-k
```

**Alternative B - MMR (Maximal Marginal Relevance)**:
```python
self.retriever = self.vector_store.as_retriever(
    search_type="mmr",
    search_kwargs={"k": 20, "fetch_k": 50, "lambda_mult": 0.5}
)
```

**Alternative C - Re-ranking**:
Add a cross-encoder after retrieval to re-score results

### 5. Prompt Engineering

**Current Template** (line 297-307 in `rag_engine.py`):
```python
template = """You are a helpful and knowledgeable assistant.
Use the following context to answer the question.
..."""
```

**Extension**: Add few-shot examples, chain-of-thought prompting, or JSON output formatting

### 6. Multi-PDF Support

**Current**: Single PDF at a time (cleared on new upload)

**To Extend**:
1. Add `collection_name` parameter to `Chroma()`
2. Store multiple collections (one per PDF)
3. Add dropdown in UI to select active PDF
4. Modify retriever to query specific collection

### 7. Chat Memory

**Current**: No conversation context (each query is independent)

**To Add**:
```python
from langchain.memory import ConversationBufferMemory

memory = ConversationBufferMemory(return_messages=True)
# Modify retrieval_chain to include memory
```

---

## PERFORMANCE BENCHMARKS

**Hardware**: NVIDIA GPU, 16GB RAM

**PDF Processing** (30-page document):
- Docling conversion: 50-60s
- Chunking: <1s
- Embedding generation: 15-25s
- **Total**: ~70-90s

**Query Response**:
- Retrieval (embedding query + vector search): 1-2s
- LLM generation (streaming): 5-15s (depends on answer length)
- **Total**: ~6-17s

**Memory Usage**:
- Docling (during processing): ~2GB GPU
- LLM (during inference): ~4GB GPU (with 16k context)
- ChromaDB: ~50MB per 1000 chunks

---

## TROUBLESHOOTING GUIDE FOR AI AGENTS

### Error: "model requires more system memory (3.9 GiB) than is available"

**Cause**: LLM context window too large for available GPU memory

**Solutions**:
1. Reduce `num_ctx` from 16384 to 8192
2. Reduce retrieval count (`k` and `first_30_chunks`)
3. Ensure GPU memory freed after Docling (check `torch.cuda.empty_cache()` is called)
4. Switch to smaller LLM (llama3.2:3b instead of llama3.1:8b)

### Error: "LocalEntryNotFoundError" (HuggingFace)

**Cause**: Docling trying to download models but no internet

**Solution**: Run `python download_docling.py` once with internet before going offline

### Error: "Chroma deprecated" warning

**Cause**: Using old `langchain-community` Chroma import

**Solution**: Install and switch to `langchain-chroma`:
```bash
pip install -U langchain-chroma
```
```python
from langchain_chroma import Chroma  # New import
```

### Slow PDF Processing

**Cause**: Docling running on CPU instead of GPU

**Diagnosis**: Check logs for "Accelerator device: 'cuda:0'" vs "'cpu'"

**Solution**: Install CUDA-enabled PyTorch (see requirements section)

### Empty or Poor Quality Responses

**Causes**:
1. **No chunks retrieved** - Vector store not populated (check `process_pdf` return value)
2. **Irrelevant chunks** - Embedding model mismatch or poor chunking
3. **LLM ignoring context** - Adjust prompt template to be more strict

**Debug**:
```python
# Add to chat() method after retrieval
print(f"Retrieved {len(unique_docs)} chunks")
for doc in unique_docs[:3]:
    print(f"Page {doc.metadata['page']}: {doc.page_content[:100]}")
```

---

## OFFLINE SETUP CHECKLIST

**With Internet**:
1. `pip install -r requirements.txt`
2. Install GPU PyTorch: `pip install torch --index-url https://download.pytorch.org/whl/cu118`
3. Install Ollama: `https://ollama.com/download`
4. Pull LLM: `ollama pull llama3.1:latest`
5. Pull embeddings: `ollama pull nomic-embed-text`
6. Cache Docling models: `python download_docling.py`

**Without Internet**:
1. Verify Ollama running: `ollama list` should show both models
2. Run app: `python -m streamlit run app.py`
3. Upload PDF and test query

---

## API ENDPOINTS (Ollama)

**Embeddings**:
```
POST http://127.0.0.1:11434/api/embed
Body: {"model": "nomic-embed-text", "input": "text to embed"}
Response: {"embeddings": [[0.1, 0.2, ...]]}
```

**Chat Completion**:
```
POST http://127.0.0.1:11434/api/chat
Body: {
  "model": "llama3.1:latest",
  "messages": [{"role": "user", "content": "..."}],
  "stream": true,
  "options": {"num_ctx": 16384, "temperature": 0}
}
Response: Stream of {"message": {"content": "..."}, "done": false}
```

---

## DESIGN RATIONALE

**Why Hybrid Retrieval?**
- Semantic search alone misses document structure (abstract, intro, conclusion)
- First 30 chunks ensure these sections always included
- Improves answer quality for high-level "summarize" questions

**Why Ollama over OpenAI?**
- Fully offline
- No API costs
- Privacy: data never leaves machine

**Why Docling over PyMuPDF?**
- Tables: Docling understands structure, PyMuPDF dumps garbled text
- Layout: Multi-column PDFs correctly parsed in reading order
- Trade-off: 50x slower, but quality gain justifies for complex documents

**Why ChromaDB over FAISS?**
- Persistence: FAISS requires manual save/load
- Metadata filtering: ChromaDB supports where clauses
- Simplicity: Less boilerplate code

**Why RecursiveCharacterTextSplitter?**
- Preserves semantic boundaries (paragraphs, sentences)
- Better than fixed-size splitting which can break mid-sentence
- Overlap prevents information loss at chunk boundaries

---

## FUTURE ENHANCEMENT IDEAS

1. **Multi-modal**: Add vision model to process images/charts from PDFs
2. **Streaming UI**: Show LLM response token-by-token instead of blocking
3. **Batch processing**: Upload multiple PDFs and search across all
4. **Export**: Save Q&A pairs to JSON or Markdown
5. **Analytics**: Track query types, response times, chunk utilization
6. **Feedback loop**: Let user flag bad answers to improve retrieval
7. **Summarization**: Auto-generate PDF summary on upload
8. **Citations**: Link to exact text location in PDF viewer

---

## LOGGING AND DEBUGGING

**Timestamp Logs** (format: `[HH:MM:SS.mmm] emoji message`):
- 🔧 Configuration steps
- 📄 PDF parsing stages
- 📝 Document conversion
- ✂️ Chunking progress
- 🧮 Embedding generation  
- 💬 Query processing
- 🔍 Retrieval stats
- 🤖 LLM invocation
- ✅ Completion markers
- ❌ Error states
- 🧹 Memory cleanup

**Performance Profiling**:
Every major operation logs duration (e.g., "complete in 51.67s")

**To Add Verbose Logging**:
```python
import logging
logging.basicConfig(level=logging.DEBUG)
```

---

## LICENSE AND USAGE NOTES

This system is designed for:
- Research document analysis
- Legal document review
- Technical manual Q&A
- Educational material exploration

**Limitations**:
- Single-user (no concurrent sessions)
- No authentication/authorization
- Stores all data locally (no cloud sync)
- GPU required for optimal performance

**Model Licenses**:
- llama3.1: Meta Llama 3.1 Community License
- nomic-embed-text: Apache 2.0
- Docling: MIT License
