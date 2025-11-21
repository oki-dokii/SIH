// List page JavaScript

// DOM elements
const loadingSection = document.getElementById('loadingSection');
const errorMessage = document.getElementById('errorMessage');
const dprList = document.getElementById('dprList');
const emptyState = document.getElementById('emptyState');
const toggleCompareBtn = document.getElementById('toggleCompareBtn');
const compareActions = document.getElementById('compareActions');
const createComparisonBtn = document.getElementById('createComparisonBtn');
const cancelCompareBtn = document.getElementById('cancelCompareBtn');
const selectedCountSpan = document.getElementById('selectedCount');

// State
let compareMode = false;
let selectedDPRs = new Set();
let allDPRs = [];

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
        allDPRs = data.dprs;

        console.log('DPRs loaded:', data.dprs.length);
        console.log('Toggle button element:', toggleCompareBtn);

        if (data.dprs.length === 0) {
            emptyState.style.display = 'block';
            dprList.style.display = 'none';
            if (toggleCompareBtn) toggleCompareBtn.style.display = 'none';
        } else {
            displayDPRs(data.dprs);
            emptyState.style.display = 'none';
            dprList.style.display = 'grid';
            // Show compare button if 2+ DPRs
            if (data.dprs.length >= 2 && toggleCompareBtn) {
                console.log('Showing compare button!');
                toggleCompareBtn.style.display = 'inline-block';
            } else if (toggleCompareBtn) {
                console.log('Only 1 DPR, hiding button');
                toggleCompareBtn.style.display = 'none';
            }
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

    if (!compareMode) {
        // Add click handlers for navigation
        document.querySelectorAll('.dpr-card').forEach(card => {
            card.addEventListener('click', () => {
                const dprId = card.dataset.dprId;
                window.location.href = `/dpr/${dprId}/detail`;
            });
        });
    } else {
        // Add checkbox handlers
        document.querySelectorAll('.dpr-checkbox').forEach(checkbox => {
            checkbox.addEventListener('change', (e) => {
                e.stopPropagation();
                handleCheckboxChange(parseInt(e.target.dataset.dprId), e.target.checked);
            });
        });
    }
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

    const checkbox = compareMode ? `
        <input type="checkbox" class="dpr-checkbox" 
               data-dpr-id="${dpr.id}" 
               ${selectedDPRs.has(dpr.id) ? 'checked' : ''}
               style="position: absolute; top: 15px; right: 15px; width: 20px; height: 20px; cursor: pointer; z-index: 10;">
    ` : '';

    return `
        <div class="dpr-card" data-dpr-id="${dpr.id}" style="position: relative; ${compareMode ? 'cursor: default;' : ''}">
            ${checkbox}
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

function toggleCompareMode() {
    // Navigate to comparisons page
    window.location.href = '/comparisons';
}

// Event listeners
if (toggleCompareBtn) {
    console.log('Adding click listener to compare button');
    toggleCompareBtn.addEventListener('click', toggleCompareMode);
} else {
    console.error('Compare button not found!');
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
