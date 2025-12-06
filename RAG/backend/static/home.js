// Home page JavaScript

// DOM elements
const uploadForm = document.getElementById('uploadForm');
const fileInput = document.getElementById('fileInput');
const fileName = document.getElementById('fileName');
const uploadBtn = document.getElementById('uploadBtn');
const loadingSection = document.getElementById('loadingSection');
const errorMessage = document.getElementById('errorMessage');

// File input change handler
fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        fileName.textContent = `Selected: ${file.name}`;
    }
});

// Upload form submit handler
uploadForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const file = fileInput.files[0];
    if (!file) {
        showError('Please select a PDF file');
        return;
    }

    // Show loading, hide error
    loadingSection.classList.add('active');
    errorMessage.style.display = 'none';
    uploadBtn.disabled = true;

    try {
        // Create form data
        const formData = new FormData();
        formData.append('file', file);

        // Upload and process
        const response = await fetch('/upload-dpr', {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || 'Upload failed');
        }

        const data = await response.json();
        
        // Show message if PDF already exists
        if (data.existing) {
            alert(`This PDF has already been analyzed! Redirecting to the existing analysis...`);
        }
        
        // Redirect to detail page
        window.location.href = `/dpr/${data.dpr_id}/detail`;

    } catch (error) {
        console.error('Upload error:', error);
        showError(error.message);
    } finally {
        loadingSection.classList.remove('active');
        uploadBtn.disabled = false;
    }
});

function showError(message) {
    errorMessage.textContent = `⚠️ Error: ${message}`;
    errorMessage.style.display = 'block';
}
