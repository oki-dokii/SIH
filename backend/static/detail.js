// Detail page JavaScript - adapted from main.js

// Get DPR ID from URL
const urlParts = window.location.pathname.split('/');
const dprId = parseInt(urlParts[2]);

// DOM elements
const loadingSection = document.getElementById('loadingSection');
const errorMessage = document.getElementById('errorMessage');
const resultSection = document.getElementById('resultSection');
const jsonOutput = document.getElementById('jsonOutput');
const startChatBtn = document.getElementById('startChatBtn');
const chatSection = document.getElementById('chatSection');
const chatMessages = document.getElementById('chatMessages');
const chatInput = document.getElementById('chatInput');
const sendChatBtn = document.getElementById('sendChatBtn');
const clearChatBtn = document.getElementById('clearChatBtn');
const dprTitle = document.getElementById('dprTitle');
const dprSubtitle = document.getElementById('dprSubtitle');

// Load DPR data on page load
document.addEventListener('DOMContentLoaded', loadDPR);

async function loadDPR() {
    loadingSection.classList.add('active');
    errorMessage.style.display = 'none';

    try {
        const response = await fetch(`/dpr/${dprId}`);

        if (!response.ok) {
            throw new Error('DPR not found');
        }

        const dpr = await response.json();

        // Update page title
        dprTitle.textContent = `📊 ${dpr.original_filename}`;
        dprSubtitle.textContent = dpr.summary_json.projectName || 'DPR Analysis';

        // Display analysis
        displayJSON(dpr.summary_json);
        resultSection.classList.add('active');

        // Auto-load chat history
        await loadChatHistory();

    } catch (error) {
        console.error('Error loading DPR:', error);
        showError(error.message);
    } finally {
        loadingSection.classList.remove('active');
    }
}

async function loadChatHistory() {
    try {
        const response = await fetch(`/dpr/${dprId}/chat/history`);
        if (!response.ok) return;

        const data = await response.json();

        if (data.messages && data.messages.length > 0) {
            chatMessages.innerHTML = '';
            data.messages.forEach(msg => {
                addMessageToChat(msg.role, msg.text);
            });
        }
    } catch (error) {
        console.error('Error loading chat history:', error);
    }
}

// Display JSON in a structured, readable format
function displayJSON(data) {
    const sections = [];

    // Project Overview
    sections.push(`
        <div class="section-card">
            <h3 class="section-title">📋 Project Overview</h3>
            <div class="info-grid">
                <div class="info-item">
                    <div class="info-label">Project Name</div>
                    <div class="info-value">${escapeHtml(data.projectName || 'N/A')}</div>
                </div>
                <div class="info-item">
                    <div class="info-label">Sector</div>
                    <div class="info-value">${escapeHtml(data.projectSector || 'N/A')}</div>
                </div>
                <div class="info-item">
                    <div class="info-label">State</div>
                    <div class="info-value">${escapeHtml(data.projectLocation?.state || 'N/A')}</div>
                </div>
                <div class="info-item">
                    <div class="info-label">Districts</div>
                    <div class="info-value">${data.projectLocation?.districts?.join(', ') || 'N/A'}</div>
                </div>
            </div>
        </div>
    `);

    // Scores and Recommendation
    const score = data.overallScore || 0;
    const scoreClass = score >= 75 ? 'score-high' : score >= 50 ? 'score-medium' : 'score-low';

    sections.push(`
        <div class="section-card">
            <h3 class="section-title">⭐ Assessment</h3>
            <div style="display: flex; gap: 30px; align-items: center; flex-wrap: wrap;">
                <div>
                    <div class="info-label">Overall Score</div>
                    <span class="score-badge ${scoreClass}">${score}/100</span>
                </div>
                <div>
                    <div class="info-label">Recommendation</div>
                    <div class="info-value">${escapeHtml(data.recommendation || 'N/A')}</div>
                </div>
            </div>
            ${data.executiveSummary ? `
                <div style="margin-top: 20px;">
                    <div class="info-label">Executive Summary</div>
                    <p style="color: #e0e0e0; line-height: 1.6; margin-top: 10px;">${escapeHtml(data.executiveSummary)}</p>
                </div>
            ` : ''}
        </div>
    `);

    // Financial Analysis
    if (data.financialAnalysis) {
        const fa = data.financialAnalysis;
        sections.push(`
            <div class="section-card">
                <h3 class="section-title">💰 Financial Analysis</h3>
                ${fa.projectCost ? `
                    <div style="margin-bottom: 20px;">
                        <h4 style="color: #00d4ff; margin-bottom: 10px;">Project Cost</h4>
                        <div class="info-grid">
                            ${formatFinancialItem('Total Investment', fa.projectCost.totalInitialInvestmentLakhINR)}
                            ${formatFinancialItem('Capital Expenditure', fa.projectCost.capitalExpenditureLakhINR)}
                            ${formatFinancialItem('Working Capital', fa.projectCost.workingCapitalLakhINR)}
                        </div>
                    </div>
                ` : ''}
                ${fa.returnsAndCoverage ? `
                    <div>
                        <h4 style="color: #00d4ff; margin-bottom: 10px;">Returns & Coverage</h4>
                        <div class="info-grid">
                            ${formatFinancialItem('IRR', fa.returnsAndCoverage.IRRPercent, '%')}
                            ${formatFinancialItem('Avg DSCR', fa.returnsAndCoverage.avgDSCR)}
                        </div>
                    </div>
                ` : ''}
            </div>
        `);
    }

    // Timeline
    if (data.timelineAnalysis) {
        const ta = data.timelineAnalysis;
        sections.push(`
            <div class="section-card">
                <h3 class="section-title">📅 Timeline Analysis</h3>
                <div class="info-item">
                    <div class="info-label">Implementation Duration</div>
                    <div class="info-value">${ta.implementationDurationMonths || 'N/A'} months</div>
                </div>
                ${ta.milestones && ta.milestones.length > 0 ? `
                    <div style="margin-top: 15px;">
                        <div class="info-label">Key Milestones</div>
                        <ul style="margin-top: 10px; padding-left: 20px; color: #e0e0e0;">
                            ${ta.milestones.map(m => `<li style="margin: 8px 0;">${escapeHtml(m)}</li>`).join('')}
                        </ul>
                    </div>
                ` : ''}
            </div>
        `);
    }

    // Risk Assessment
    if (data.riskAssessment && data.riskAssessment.length > 0) {
        sections.push(`
            <div class="section-card">
                <h3 class="section-title">⚠️ Risk Assessment</h3>
                ${data.riskAssessment.map(risk => {
            const severityClass = risk.severity?.toLowerCase() || 'medium';
            return `
                        <div class="risk-item risk-${severityClass}">
                            <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
                                <strong style="color: #00d4ff;">${escapeHtml(risk.riskCategory || 'Unknown')}</strong>
                                <span style="color: #ffb86c; font-weight: 600;">Severity: ${escapeHtml(risk.severity || 'N/A')}</span>
                            </div>
                            <p style="color: #e0e0e0; margin: 8px 0;">${escapeHtml(risk.description || '')}</p>
                            ${risk.evidence ? `<p style="color: #b0b0b0; font-size: 0.9em; margin-top: 8px;"><em>Evidence: ${escapeHtml(risk.evidence)}</em></p>` : ''}
                        </div>
                    `;
        }).join('')}
            </div>
        `);
    }

    // Scope and Objectives
    if (data.scopeAndObjectives) {
        const so = data.scopeAndObjectives;
        sections.push(`
            <div class="section-card">
                <h3 class="section-title">🎯 Scope & Objectives</h3>
                ${so.vision ? `
                    <div style="margin-bottom: 15px;">
                        <div class="info-label">Vision</div>
                        <p style="color: #e0e0e0; margin-top: 5px;">${escapeHtml(so.vision)}</p>
                    </div>
                ` : ''}
                ${so.objectives && so.objectives.length > 0 ? `
                    <div>
                        <div class="info-label">Key Objectives</div>
                        <ul style="margin-top: 10px; padding-left: 20px; color: #e0e0e0;">
                            ${so.objectives.map(obj => `<li style="margin: 8px 0;">${escapeHtml(obj)}</li>`).join('')}
                        </ul>
                    </div>
                ` : ''}
            </div>
        `);
    }

    // Compliance Check
    if (data.complianceCheck) {
        const cc = data.complianceCheck;
        sections.push(`
            <div class="section-card">
                <h3 class="section-title">✅ Compliance Check</h3>
                ${cc.statutoryAndPermits && cc.statutoryAndPermits.length > 0 ? `
                    <div style="margin-bottom: 15px;">
                        <div class="info-label">Statutory & Permits</div>
                        <ul style="margin-top: 10px; padding-left: 20px; color: #e0e0e0;">
                            ${cc.statutoryAndPermits.map(item => `<li style="margin: 8px 0;">${escapeHtml(item)}</li>`).join('')}
                        </ul>
                    </div>
                ` : ''}
                ${cc.gapsOrUnknowns && cc.gapsOrUnknowns.length > 0 ? `
                    <div>
                        <div class="info-label">Gaps or Unknowns</div>
                        <ul style="margin-top: 10px; padding-left: 20px; color: #ffb86c;">
                            ${cc.gapsOrUnknowns.map(item => `<li style="margin: 8px 0;">${escapeHtml(item)}</li>`).join('')}
                        </ul>
                    </div>
                ` : ''}
            </div>
        `);
    }

    // Raw JSON toggle
    sections.push(`
        <div class="section-card">
            <details>
                <summary style="cursor: pointer; color: #00d4ff; font-weight: 600;">🔍 View Raw JSON</summary>
                <pre style="margin-top: 15px;"><code>${JSON.stringify(data, null, 2)}</code></pre>
            </details>
        </div>
    `);

    jsonOutput.innerHTML = sections.join('');
}

// Helper function to format financial items
function formatFinancialItem(label, value, suffix = ' Lakh INR') {
    if (value === null || value === undefined) return '';
    return `
        <div class="info-item">
            <div class="info-label">${label}</div>
            <div class="info-value">${value}${suffix}</div>
        </div>
    `;
}

// Helper function to escape HTML
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Start chat button handler
startChatBtn.addEventListener('click', () => {
    chatSection.classList.add('active');
    chatMessages.scrollTop = chatMessages.scrollHeight;
    chatInput.focus();
});

// Send chat message
async function sendChatMessage() {
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
        const response = await fetch(`/dpr/${dprId}/chat`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ message })
        });

        if (!response.ok) {
            throw new Error('Chat request failed');
        }

        const data = await response.json();
        // Remove waiting message
        const waiting = document.getElementById('waitingMessage');
        if (waiting) waiting.remove();
        // Add actual response
        addMessageToChat('assistant', data.reply);

    } catch (error) {
        console.error('Chat error:', error);
        // Remove waiting message
        const waiting = document.getElementById('waitingMessage');
        if (waiting) waiting.remove();
        addMessageToChat('assistant', '⚠️ Sorry, there was an error processing your message.');
    } finally {
        chatInput.disabled = false;
        sendChatBtn.disabled = false;
        chatInput.focus();
    }
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

// Send chat button click
sendChatBtn.addEventListener('click', sendChatMessage);

// Chat input enter key
chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendChatMessage();
    }
});

// Clear chat button handler
clearChatBtn.addEventListener('click', async () => {
    if (!confirm('Are you sure you want to clear all chat history? This cannot be undone.')) {
        return;
    }

    try {
        const response = await fetch(`/dpr/${dprId}/chat`, {
            method: 'DELETE'
        });

        if (!response.ok) {
            throw new Error('Failed to clear chat');
        }

        const data = await response.json();
        chatMessages.innerHTML = '';
        alert(`Chat cleared! ${data.deleted_count} messages removed.`);

    } catch (error) {
        console.error('Clear chat error:', error);
        alert('Failed to clear chat. Please try again.');
    }
});

function showError(message) {
    errorMessage.textContent = `⚠️ Error: ${message}`;
    errorMessage.style.display = 'block';
}
