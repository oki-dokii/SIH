// List page JavaScript

// DOM elements
const loadingSection = document.getElementById('loadingSection');
const errorMessage = document.getElementById('errorMessage');
const dprList = document.getElementById('dprList');
const emptyState = document.getElementById('emptyState');

// Load DPRs on page load
document.addEventListener('DOMContentLoaded', loadDPRs);

async function loadDPRs() {
    loadingSection.classList.add('active');
    errorMessage.style.display = 'none';

    try {
        const response = await fetch('/dprs');

        if (!response.ok) {
            throw new Error('Failed to load DPRs');
        }

        const data = await response.json();

        if (data.dprs.length === 0) {
            emptyState.style.display = 'block';
            dprList.style.display = 'none';
        } else {
            displayDPRs(data.dprs);
            emptyState.style.display = 'none';
            dprList.style.display = 'grid';
        }

    } catch (error) {
        console.error('Error loading DPRs:', error);
        showError(error.message);
    } finally {
        loadingSection.classList.remove('active');
    }
}

function displayDPRs(dprs) {
    dprList.innerHTML = dprs.map(dpr => createDPRCard(dpr)).join('');

    // Add click handlers
    document.querySelectorAll('.dpr-card').forEach(card => {
        card.addEventListener('click', () => {
            const dprId = card.dataset.dprId;
            window.location.href = `/dpr/${dprId}/detail`;
        });
    });
}

function createDPRCard(dpr) {
    const summary = dpr.summary_json;
    const score = summary.overallScore || 0;
    const scoreClass = score >= 75 ? 'score-high' : score >= 50 ? 'score-medium' : 'score-low';
    const uploadDate = new Date(dpr.upload_ts).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });

    return `
        <div class="dpr-card" data-dpr-id="${dpr.id}">
            <div class="dpr-card-header">
                <div>
                    <div class="dpr-filename">${escapeHtml(dpr.original_filename)}</div>
                    <div class="dpr-date">📅 ${uploadDate}</div>
                </div>
            </div>
            
            <div class="dpr-stats">
                <div class="dpr-stat">
                    <div class="stat-label">Overall Score</div>
                    <div class="stat-value">
                        <span class="score-badge ${scoreClass}">${score}/100</span>
                    </div>
                </div>
                <div class="dpr-stat">
                    <div class="stat-label">Recommendation</div>
                    <div class="stat-value">${escapeHtml(summary.recommendation || 'N/A')}</div>
                </div>
            </div>
            
            <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #0f3460;">
                <div class="stat-label">Project</div>
                <div class="stat-value" style="font-size: 0.95em;">${escapeHtml(summary.projectName || 'N/A')}</div>
            </div>
        </div>
    `;
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function showError(message) {
    errorMessage.textContent = `⚠️ Error: ${message}`;
    errorMessage.style.display = 'block';
}
