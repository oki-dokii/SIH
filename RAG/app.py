import streamlit as st
import os
import tempfile
from rag_engine import RAGEngine

# Page config
st.set_page_config(
    page_title="Offline PDF Chat",
    page_icon="📚",
    layout="centered"
)

# Initialize RAG Engine
@st.cache_resource
def get_engine():
    return RAGEngine()

engine = get_engine()

# Session state for chat history
if "messages" not in st.session_state:
    st.session_state.messages = []

if "processed_file" not in st.session_state:
    st.session_state.processed_file = None

# Sidebar for upload
with st.sidebar:
    st.header("Upload Document")
    uploaded_file = st.file_uploader("Choose a PDF file", type="pdf")
    
    if uploaded_file is not None:
        # Check if this file is already processed
        if st.session_state.processed_file != uploaded_file.name:
            with st.spinner("Processing PDF... This may take a moment."):
                # Save to temp file
                with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp_file:
                    tmp_file.write(uploaded_file.getvalue())
                    tmp_path = tmp_file.name
                
                # Process
                try:
                    engine.clear_database() # Clear previous context for new file
                    num_chunks = engine.process_pdf(tmp_path)
                    st.session_state.processed_file = uploaded_file.name
                    st.success(f"Processed {num_chunks} chunks!")
                except Exception as e:
                    st.error(f"Error processing file: {e}")
                finally:
                    os.unlink(tmp_path)
        else:
            st.info("File already processed.")

    if st.button("Clear Chat"):
        st.session_state.messages = []
        st.rerun()

# Main chat interface
st.title("📚 Chat with your PDF")

# Display chat messages
for message in st.session_state.messages:
    with st.chat_message(message["role"]):
        st.markdown(message["content"])

# Chat input
if prompt := st.chat_input("Ask a question about the PDF..."):
    # Add user message to chat history
    st.session_state.messages.append({"role": "user", "content": prompt})
    with st.chat_message("user"):
        st.markdown(prompt)

    # Generate response
    with st.chat_message("assistant"):
        if not st.session_state.processed_file:
            response = "Please upload a PDF first."
            st.markdown(response)
            st.session_state.messages.append({"role": "assistant", "content": response})
        else:
            with st.spinner("Thinking..."):
                answer, sources = engine.chat(prompt)
                
                # Format response with sources
                full_response = answer
                if sources:
                    full_response += "\n\n**Sources:**\n" + "\n".join([f"- {s}" for s in sources])
                
                st.markdown(full_response)
                st.session_state.messages.append({"role": "assistant", "content": full_response})
