// Project Tracker - Minimal Kanban Board
// Data stored in localStorage

const STORAGE_KEY = 'project-tracker-cards';

// State
let cards = [];
let editingCardId = null;

// DOM refs
const board = document.querySelector('.board');
const modal = document.getElementById('card-modal');
const form = document.getElementById('card-form');
const modalTitle = document.getElementById('modal-title');
const deleteBtn = document.getElementById('delete-card-btn');
const projectFilter = document.getElementById('project-filter');
const addCardBtn = document.getElementById('add-card-btn');
const exportBtn = document.getElementById('export-btn');
const importBtn = document.getElementById('import-btn');
const importFile = document.getElementById('import-file');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    loadCards();
    render();
    setupEventListeners();
});

// Storage
function loadCards() {
    try {
        cards = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
    } catch {
        cards = [];
    }
}

function saveCards() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cards));
}

// Rendering
function render() {
    const filter = projectFilter.value;

    ['backlog', 'in-progress', 'done'].forEach(status => {
        const list = document.querySelector(`.card-list[data-status="${status}"]`);
        const count = document.querySelector(`[data-count="${status}"]`);

        const filtered = cards
            .filter(c => c.status === status)
            .filter(c => filter === 'all' || c.project === filter);

        list.innerHTML = filtered.map(card => createCardHTML(card)).join('');
        count.textContent = filtered.length;
    });

    updateProjectFilter();
    setupDragAndDrop();
}

function createCardHTML(card) {
    const deadlineClass = getDeadlineClass(card.deadline);
    const deadlineText = card.deadline ? formatDeadline(card.deadline) : '';

    return `
        <div class="card" draggable="true" data-id="${card.id}" onclick="openEditModal('${card.id}')">
            <div class="card-title">${escapeHtml(card.title)}</div>
            ${card.description ? `<div class="card-description">${escapeHtml(card.description)}</div>` : ''}
            <div class="card-meta">
                ${card.project ? `<span class="card-project">${escapeHtml(card.project)}</span>` : ''}
                ${deadlineText ? `<span class="card-deadline ${deadlineClass}">${deadlineText}</span>` : ''}
            </div>
        </div>
    `;
}

function getDeadlineClass(deadline) {
    if (!deadline) return '';
    const now = new Date();
    const dl = new Date(deadline + 'T23:59:59');
    const diff = (dl - now) / (1000 * 60 * 60 * 24);
    if (diff < 0) return 'overdue';
    if (diff <= 3) return 'soon';
    return '';
}

function formatDeadline(deadline) {
    const date = new Date(deadline + 'T00:00:00');
    const now = new Date();
    const diff = Math.ceil((date - now) / (1000 * 60 * 60 * 24));

    if (diff < 0) return `${Math.abs(diff)}d overdue`;
    if (diff === 0) return 'Today';
    if (diff === 1) return 'Tomorrow';
    if (diff <= 7) return `${diff}d left`;

    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function updateProjectFilter() {
    const current = projectFilter.value;
    const projects = [...new Set(cards.map(c => c.project).filter(Boolean))].sort();

    // Update filter dropdown
    projectFilter.innerHTML = '<option value="all">All Projects</option>';
    projects.forEach(p => {
        const opt = document.createElement('option');
        opt.value = p;
        opt.textContent = p;
        projectFilter.appendChild(opt);
    });
    projectFilter.value = current;

    // Update datalist suggestions
    const datalist = document.getElementById('project-suggestions');
    datalist.innerHTML = '';
    projects.forEach(p => {
        const opt = document.createElement('option');
        opt.value = p;
        datalist.appendChild(opt);
    });
}

// Modal
function openAddModal() {
    editingCardId = null;
    modalTitle.textContent = 'Add Card';
    deleteBtn.classList.add('hidden');
    form.reset();
    document.getElementById('card-status').value = 'backlog';
    modal.classList.remove('hidden');
    document.getElementById('card-title').focus();
}

function openEditModal(id) {
    const card = cards.find(c => c.id === id);
    if (!card) return;

    editingCardId = id;
    modalTitle.textContent = 'Edit Card';
    deleteBtn.classList.remove('hidden');

    document.getElementById('card-id').value = card.id;
    document.getElementById('card-title').value = card.title;
    document.getElementById('card-description').value = card.description || '';
    document.getElementById('card-project').value = card.project || '';
    document.getElementById('card-deadline').value = card.deadline || '';
    document.getElementById('card-status').value = card.status;

    modal.classList.remove('hidden');
}

function closeModal() {
    modal.classList.add('hidden');
    editingCardId = null;
    form.reset();
}

function handleSubmit(e) {
    e.preventDefault();

    const title = document.getElementById('card-title').value.trim();
    if (!title) return;

    const cardData = {
        title,
        description: document.getElementById('card-description').value.trim(),
        project: document.getElementById('card-project').value.trim(),
        deadline: document.getElementById('card-deadline').value || null,
        status: document.getElementById('card-status').value,
    };

    if (editingCardId) {
        const idx = cards.findIndex(c => c.id === editingCardId);
        if (idx !== -1) {
            cards[idx] = { ...cards[idx], ...cardData, updatedAt: new Date().toISOString() };
        }
    } else {
        cards.push({
            id: crypto.randomUUID(),
            ...cardData,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        });
    }

    saveCards();
    render();
    closeModal();
}

function deleteCard() {
    if (!editingCardId) return;
    if (!confirm('Delete this card?')) return;

    cards = cards.filter(c => c.id !== editingCardId);
    saveCards();
    render();
    closeModal();
}

// Drag and Drop
function setupDragAndDrop() {
    document.querySelectorAll('.card[draggable]').forEach(card => {
        card.addEventListener('dragstart', handleDragStart);
        card.addEventListener('dragend', handleDragEnd);
    });

    document.querySelectorAll('.card-list').forEach(list => {
        list.addEventListener('dragover', handleDragOver);
        list.addEventListener('dragleave', handleDragLeave);
        list.addEventListener('drop', handleDrop);
    });
}

let draggedCardId = null;

function handleDragStart(e) {
    draggedCardId = e.target.dataset.id;
    e.target.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
}

function handleDragEnd(e) {
    e.target.classList.remove('dragging');
    document.querySelectorAll('.card-list').forEach(l => l.classList.remove('drag-over'));
}

function handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    e.currentTarget.classList.add('drag-over');
}

function handleDragLeave(e) {
    e.currentTarget.classList.remove('drag-over');
}

function handleDrop(e) {
    e.preventDefault();
    e.currentTarget.classList.remove('drag-over');

    const newStatus = e.currentTarget.dataset.status;
    if (!draggedCardId || !newStatus) return;

    const card = cards.find(c => c.id === draggedCardId);
    if (card && card.status !== newStatus) {
        card.status = newStatus;
        card.updatedAt = new Date().toISOString();
        saveCards();
        render();
    }

    draggedCardId = null;
}

// Export / Import
function exportData() {
    const data = JSON.stringify(cards, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `project-tracker-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
}

function importData(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
        try {
            const imported = JSON.parse(event.target.result);
            if (!Array.isArray(imported)) throw new Error('Invalid format');
            if (!confirm(`Import ${imported.length} cards? This will replace all current data.`)) return;
            cards = imported;
            saveCards();
            render();
        } catch {
            alert('Invalid file format. Expected a JSON array of cards.');
        }
    };
    reader.readAsText(file);
    importFile.value = '';
}

// Event Listeners
function setupEventListeners() {
    addCardBtn.addEventListener('click', openAddModal);
    form.addEventListener('submit', handleSubmit);
    deleteBtn.addEventListener('click', deleteCard);
    projectFilter.addEventListener('change', render);
    exportBtn.addEventListener('click', exportData);
    importBtn.addEventListener('click', () => importFile.click());
    importFile.addEventListener('change', importData);

    // Close modal
    document.querySelector('.modal-close').addEventListener('click', closeModal);
    document.querySelector('.modal-cancel').addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });

    // Keyboard
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !modal.classList.contains('hidden')) {
            closeModal();
        }
    });
}

// Utils
function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

// Make openEditModal available globally for onclick handlers
window.openEditModal = openEditModal;
