// Get comparison ID from URL
const comparisonId = window.location.pathname.split('/')[2];

// DOM elements
const loadingSection = document.getElementById('loadingSection');
const resultSection = document.getElementById('resultSection');
const chatSection = document.getElementById('chatSection');
const errorMessage = document.getElementById('errorMessage');
const pdfList = document.getElementById('pdfList');
const chatMessages = document.getElementById('chatMessages');
const chatInput = document.getElementById('chatInput');
const sendChatBtn = document.getElementById('sendChatBtn');
const clearChatBtn = document.getElementById('clearChatBtn');

let comparisonData = null;

// Show error message
function showError(message) {
    errorMessage.textContent = message;
    errorMessage.style.display = 'block';
    loadingSection.style.display = 'none';
}

// Load comparison data
async function loadComparison() {
    try {
        loadingSection.style.display = 'flex';
        const response = await fetch(`/comparison-chat/${comparisonId}`);

        if (!response.ok) {
            throw new Error('Comparison not found');
        }

        comparisonData = await response.json();

        // Update header
        document.getElementById('comparisonTitle').textContent = `🔀 ${comparisonData.name}`;
        document.getElementById('comparisonSubtitle').textContent = `Comparing ${comparisonData.dprs.length} DPR documents`;

        // Display PDF list
        displayPDFList();

        // Load chat history
        await loadChatHistory();

        // Show sections
        loadingSection.style.display = 'none';
        resultSection.style.display = 'block';
        chatSection.style.display = 'block';

    } catch (error) {
        showError(`Failed to load comparison: ${error.message}`);
    }
}

// Display list of PDFs in the comparison
function displayPDFList() {
    pdfList.innerHTML = '';

    comparisonData.dprs.forEach((dpr, index) => {
        const pdfItem = document.createElement('div');
        pdfItem.style.cssText = `
            background: #2a2a2a;
            padding: 12px;
            border-radius: 6px;
            margin-bottom: 10px;
            border-left: 3px solid #00d4ff;
        `;

        const summary = dpr.summary_json;
        const score = summary.overallScore || 'N/A';
        const recommendation = summary.recommendation || 'N/A';

        pdfItem.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <div>
                    <strong style="color: #00d4ff;">Document ${index + 1}: ${summary.projectName || dpr.original_filename}</strong><br>
                    <small style="color: #999;">Uploaded: ${new Date(dpr.upload_ts).toLocaleDateString()}</small>
                </div>
                <div style="text-align: right;">
                    <div style="color: ${score >= 80 ? '#00ff88' : score >= 60 ? '#ffd700' : '#ff4444'}; font-weight: bold;">
                        Score: ${score}
                    </div>
                    <div style="color: #ccc; font-size: 0.9em;">
                        ${recommendation}
                    </div>
                </div>
            </div>
        `;

        pdfList.appendChild(pdfItem);
    });
}

// Load chat history
async function loadChatHistory() {
    try {
        const response = await fetch(`/comparison-chat/${comparisonId}/chat/history`);
        const data = await response.json();

        chatMessages.innerHTML = '';
        data.messages.forEach(msg => {
            addMessageToChat(msg.role, msg.text);
        });
    } catch (error) {
        console.error('Failed to load chat history:', error);
    }
}

// Helper function to escape HTML
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Add message to chat display
function addMessageToChat(role, text) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${role}`;
    messageDiv.innerHTML = `
        <div class="message-role">${role === 'user' ? '👤 You' : '🤖 AI Assistant'}</div>
        <div class="message-text">${escapeHtml(text).replace(/\n/g, '<br>')}</div>
    `;
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Send chat message
async function sendMessage() {
    const message = chatInput.value.trim();
    if (!message) return;

    // Disable input
    chatInput.disabled = true;
    sendChatBtn.disabled = true;

    // Add user message to chat
    addMessageToChat('user', message);
    chatInput.value = '';

    // Add waiting message
    const waitingMsg = document.createElement('div');
    waitingMsg.className = 'message assistant waiting';
    waitingMsg.innerHTML = `
        <div class="message-role">🤖 AI Assistant</div>
        <div class="message-text">⏳ The assistant is responding...</div>
    `;
    waitingMsg.id = 'waitingMessage';
    chatMessages.appendChild(waitingMsg);
    chatMessages.scrollTop = chatMessages.scrollHeight;

    try {
        const response = await fetch(`/comparison-chat/${comparisonId}/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message })
        });

        if (!response.ok) {
            throw new Error('Failed to send message');
        }

        const data = await response.json();
        // Remove waiting message
        const waiting = document.getElementById('waitingMessage');
        if (waiting) waiting.remove();
        // Add actual response
        addMessageToChat('assistant', data.reply);

    } catch (error) {
        // Remove waiting message
        const waiting = document.getElementById('waitingMessage');
        if (waiting) waiting.remove();
        addMessageToChat('assistant', `⚠️ Sorry, there was an error processing your message: ${error.message}`);
    } finally {
        chatInput.disabled = false;
        sendChatBtn.disabled = false;
        chatInput.focus();
    }
}

// Clear chat history
async function clearChat() {
    if (!confirm('Are you sure you want to clear all chat history for this comparison? This action cannot be undone.')) {
        return;
    }

    try {
        const response = await fetch(`/comparison-chat/${comparisonId}/chat`, {
            method: 'DELETE'
        });

        if (!response.ok) {
            throw new Error('Failed to clear chat');
        }

        chatMessages.innerHTML = '';

        // Show success message
        const successMsg = document.createElement('div');
        successMsg.className = 'chat-message assistant';
        successMsg.textContent = '✓ Chat history cleared successfully.';
        successMsg.style.background = '#00ff8822';
        successMsg.style.borderColor = '#00ff88';
        chatMessages.appendChild(successMsg);

    } catch (error) {
        alert(`Failed to clear chat: ${error.message}`);
    }
}

// Event listeners
sendChatBtn.addEventListener('click', sendMessage);
clearChatBtn.addEventListener('click', clearChat);

chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        sendMessage();
    }
});

// Initialize
loadComparison();
