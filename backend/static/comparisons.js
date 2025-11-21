// Comparisons page JavaScript

// DOM elements
const loadingSection = document.getElementById('loadingSection');
const errorMessage = document.getElementById('errorMessage');
const comparisonListSection = document.getElementById('comparisonListSection');
const comparisonList = document.getElementById('comparisonList');
const emptyComparisons = document.getElementById('emptyComparisons');
const selectionSection = document.getElementById('selectionSection');
const dprList = document.getElementById('dprList');
const createNewBtn = document.getElementById('createNewBtn');
const confirmSelectionBtn = document.getElementById('confirmSelectionBtn');
const cancelSelectionBtn = document.getElementById('cancelSelectionBtn');
const selectedCountSpan = document.getElementById('selectedCount');

// State
let selectedDPRs = new Set();
let allDPRs = [];
let allComparisons = [];

// Load comparisons on page load
document.addEventListener('DOMContentLoaded', loadComparisons);

async function loadComparisons() {
    loadingSection.style.display = 'flex';
    errorMessage.style.display = 'none';

    try {
        const response = await fetch('/comparison-chats');
        if (!response.ok) throw new Error('Failed to load comparisons');

        const data = await response.json();
        allComparisons = data.comparisons;

        displayComparisons();

    } catch (error) {
        console.error('Error loading comparisons:', error);
        showError(error.message);
    } finally {
        loadingSection.style.display = 'none';
    }
}

function displayComparisons() {
    comparisonListSection.style.display = 'block';

    if (allComparisons.length === 0) {
        comparisonList.style.display = 'none';
        emptyComparisons.style.display = 'block';
        return;
    }

    emptyComparisons.style.display = 'none';
    comparisonList.style.display = 'grid';
    comparisonList.innerHTML = allComparisons.map(comp => createComparisonCard(comp)).join('');

    // Add click handlers
    document.querySelectorAll('.comparison-card').forEach(card => {
        card.addEventListener('click', () => {
            const compId = card.dataset.comparisonId;
            window.location.href = `/comparison-chat/${compId}/detail`;
        });
    });
}

function createComparisonCard(comparison) {
    const date = new Date(comparison.created_ts).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });

    return `
        <div class="comparison-card dpr-card" data-comparison-id="${comparison.id}">
            <div class="dpr-card-header">
                <div>
                    <div class="dpr-filename">🔀 ${escapeHtml(comparison.name)}</div>
                    <div class="dpr-date">📅 ${date}</div>
                </div>
            </div>
            
            <div class="dpr-stats">
                <div class="dpr-stat">
                    <div class="stat-label">DPRs Compared</div>
                    <div class="stat-value">
                        <span style="color: #00d4ff; font-weight: bold;">${comparison.pdf_count}</span> documents
                    </div>
                </div>
                <div class="dpr-stat">
                    <div class="stat-label">Messages</div>
                    <div class="stat-value">${comparison.message_count || 0}</div>
                </div>
            </div>
        </div>
    `;
}

// Show PDF selection UI
async function showPDFSelection() {
    try {
        loadingSection.style.display = 'flex';

        // Load all DPRs
        const response = await fetch('/dprs');
        if (!response.ok) throw new Error('Failed to load DPRs');

        const data = await response.json();
        allDPRs = data.dprs;

        if (allDPRs.length < 2) {
            alert('You need at least 2 DPRs to create a comparison. Please upload more DPR documents first.');
            return;
        }

        selectedDPRs.clear();
        displayDPRsForSelection();

        comparisonListSection.style.display = 'none';
        selectionSection.style.display = 'block';

    } catch (error) {
        showError(error.message);
    } finally {
        loadingSection.style.display = 'none';
    }
}

function displayDPRsForSelection() {
    dprList.innerHTML = allDPRs.map(dpr => createSelectableDPRCard(dpr)).join('');

    // Add checkbox handlers
    document.querySelectorAll('.dpr-checkbox').forEach(checkbox => {
        checkbox.addEventListener('change', (e) => {
            e.stopPropagation();
            handleCheckboxChange(parseInt(e.target.dataset.dprId), e.target.checked);
        });
    });

    updateSelectionUI();
}

function createSelectableDPRCard(dpr) {
    const summary = dpr.summary_json;
    const score = summary.overallScore || 0;
    const scoreClass = score >= 75 ? 'score-high' : score >= 50 ? 'score-medium' : 'score-low';

    const uploadDate = new Date(dpr.upload_ts).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });

    return `
        <div class="dpr-card" style="position: relative; cursor: default;">
            <input type="checkbox" class="dpr-checkbox" 
                   data-dpr-id="${dpr.id}" 
                   ${selectedDPRs.has(dpr.id) ? 'checked' : ''}
                   style="position: absolute; top: 15px; right: 15px; width: 20px; height: 20px; cursor: pointer; z-index: 10;">
            
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
                    <div class="stat-label">Project</div>
                    <div class="stat-value" style="font-size: 0.9em;">${escapeHtml(summary.projectName || 'N/A')}</div>
                </div>
            </div>
        </div>
    `;
}

function handleCheckboxChange(dprId, checked) {
    if (checked) {
        selectedDPRs.add(dprId);
    } else {
        selectedDPRs.delete(dprId);
    }
    updateSelectionUI();
}

function updateSelectionUI() {
    const count = selectedDPRs.size;
    selectedCountSpan.textContent = count;
    confirmSelectionBtn.disabled = count < 2;

    if (count < 2) {
        confirmSelectionBtn.style.opacity = '0.5';
        confirmSelectionBtn.style.cursor = 'not-allowed';
    } else {
        confirmSelectionBtn.style.opacity = '1';
        confirmSelectionBtn.style.cursor = 'pointer';
    }
}

async function createComparison() {
    if (selectedDPRs.size < 2) {
        alert('Please select at least 2 DPRs to compare');
        return;
    }

    const name = prompt('Enter a name for this comparison:');
    if (!name || !name.trim()) return;

    try {
        confirmSelectionBtn.disabled = true;
        confirmSelectionBtn.textContent = 'Creating...';

        const response = await fetch('/comparison-chats', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: name.trim(),
                dpr_ids: Array.from(selectedDPRs)
            })
        });

        if (!response.ok) throw new Error('Failed to create comparison');

        const data = await response.json();
        window.location.href = `/comparison-chat/${data.comparison_id}/detail`;

    } catch (error) {
        alert(`Error: ${error.message}`);
        confirmSelectionBtn.disabled = false;
        confirmSelectionBtn.textContent = '✓ Create Comparison';
    }
}

function cancelSelection() {
    selectedDPRs.clear();
    selectionSection.style.display = 'none';
    comparisonListSection.style.display = 'block';
}

// Event listeners
createNewBtn.addEventListener('click', showPDFSelection);
confirmSelectionBtn.addEventListener('click', createComparison);
cancelSelectionBtn.addEventListener('click', cancelSelection);

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
