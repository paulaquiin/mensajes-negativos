// State
let allMessages = []; // JSON Data
let customMessages = JSON.parse(localStorage.getItem('customMessages')) || [];
let displayedMessages = []; // Combined logic
let activeFilters = new Set(['all']); // Set for multiple filters (re-introducing this)
let favorites = JSON.parse(localStorage.getItem('favorites')) || [];
let selectedCategoriesForm = []; // Array for fresh tags
const itemsPerLoad = 20;
let currentPage = 1;
let isLoading = false;

// DOM Elements
const messagesGrid = document.getElementById('messages-grid');
const filterBtns = document.querySelectorAll('.filter-btn');
const customMsgForm = document.getElementById('custom-message-form');
const categoriesContainer = document.getElementById('selected-categories');
const categorySelect = document.getElementById('custom-category');
const themeToggleBtn = document.getElementById('theme-toggle');
let loadingIndicator = null;

// Theme Logic
const currentTheme = localStorage.getItem('theme') || 'dark';
document.documentElement.setAttribute('data-theme', currentTheme);
updateThemeIcon(currentTheme);

if (themeToggleBtn) {
    themeToggleBtn.addEventListener('click', () => {
        let theme = document.documentElement.getAttribute('data-theme');
        let newTheme = theme === 'dark' ? 'light' : 'dark';

        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
        updateThemeIcon(newTheme);
    });
}

function updateThemeIcon(theme) {
    if (!themeToggleBtn) return;
    const icon = themeToggleBtn.querySelector('i');
    if (theme === 'dark') {
        icon.className = 'fa-solid fa-sun';
    } else {
        icon.className = 'fa-solid fa-moon';
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    if (messagesGrid) {
        createLoadingIndicator();
        fetchMessages();
        setupEventListeners();
    }
});

// Create Loading Indicator
function createLoadingIndicator() {
    loadingIndicator = document.createElement('div');
    loadingIndicator.style.gridColumn = '1 / -1';
    loadingIndicator.style.textAlign = 'center';
    loadingIndicator.style.padding = '2rem';
    loadingIndicator.style.color = '#007bff';
    loadingIndicator.innerHTML = '<i class="fa-solid fa-spinner fa-spin fa-2x"></i>';
    loadingIndicator.style.display = 'none';
    messagesGrid.parentNode.appendChild(loadingIndicator);
}

// Fetch Data
async function fetchMessages() {
    try {
        const response = await fetch('data/messages.json');
        allMessages = await response.json();
        resetAndRender();
        setupIntersectionObserver();
    } catch (error) {
        console.error('Error loading messages:', error);
        messagesGrid.innerHTML = '<p style="text-align:center; color: red;">Error al cargar los mensajes.</p>';
    }
}

// Setup Event Listeners
function setupEventListeners() {
    // Filter Buttons Logic (Multi-Select)
    filterBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const category = btn.dataset.category;

            if (category === 'all') {
                activeFilters.clear();
                activeFilters.add('all');
            } else {
                if (activeFilters.has('all')) activeFilters.delete('all');

                if (activeFilters.has(category)) {
                    activeFilters.delete(category);
                    if (activeFilters.size === 0) activeFilters.add('all');
                } else {
                    activeFilters.add(category);
                }
            }
            updateFilterButtons();
            resetAndRender();
        });
    });

    // Custom Category Select Logic (Tags)
    if (categorySelect) {
        categorySelect.addEventListener('change', (e) => {
            const value = e.target.value;
            const text = e.target.options[e.target.selectedIndex].text;

            if (value) {
                // Add to array if not present
                if (!selectedCategoriesForm.some(c => c.value === value)) {
                    selectedCategoriesForm.push({ value, text });
                    renderCategoryTags();

                    // Hide option
                    e.target.options[e.target.selectedIndex].style.display = 'none';
                }

                // Reset select
                e.target.value = "";
            }
        });
    }

    // Form Submit
    if (customMsgForm) {
        customMsgForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const text = document.getElementById('custom-text').value;

            // Validate
            if (selectedCategoriesForm.length === 0) {
                alert("Por favor, selecciona al menos una categoría.");
                return;
            }

            const categories = selectedCategoriesForm.map(c => c.value);
            addCustomMessage(text, categories);

            customMsgForm.reset();
            // Reset categories
            selectedCategoriesForm = [];
            renderCategoryTags();
            // Reset options visibility
            Array.from(categorySelect.options).forEach(opt => opt.style.display = '');
        });
    }
}

// Update Filter Buttons UI
function updateFilterButtons() {
    filterBtns.forEach(btn => {
        if (activeFilters.has(btn.dataset.category)) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
}

// Render Category Tags
function renderCategoryTags() {
    if (!categoriesContainer) return;
    categoriesContainer.innerHTML = '';

    selectedCategoriesForm.forEach(cat => {
        const tag = document.createElement('div');
        tag.className = 'category-tag';
        tag.dataset.category = cat.value; // For styling
        tag.innerHTML = `
            ${cat.text}
            <button type="button" onclick="removeCategoryTag('${cat.value}')"><i class="fa-solid fa-xmark"></i></button>
        `;
        categoriesContainer.appendChild(tag);
    });
}

// Remove Category Tag (Global)
window.removeCategoryTag = function (value) {
    selectedCategoriesForm = selectedCategoriesForm.filter(c => c.value !== value);
    renderCategoryTags();

    // Show option again
    if (categorySelect) {
        const option = Array.from(categorySelect.options).find(opt => opt.value === value);
        if (option) option.style.display = '';
    }
};

// Add Custom Message
function addCustomMessage(text, categories) {
    categories.forEach((cat, index) => {
        const newMessage = {
            id: Date.now() + index, // Ensure unique ID for each
            text: text,
            categories: [cat], // Store as single-item array for compatibility if needed, or just change schema. Keeping array for now to match card creation logic which expects array or falls back.
            category: cat, // Primary category
            isCustom: true
        };
        customMessages.unshift(newMessage);
    });

    localStorage.setItem('customMessages', JSON.stringify(customMessages));

    // Switch to custom view
    activeFilters.clear();
    activeFilters.add('custom');
    updateFilterButtons();
    resetAndRender();
}

// Delete Custom Message
// Delete Custom Message (Triggers Modal)
function deleteCustomMessage(id) {
    currentEditId = id;
    currentModalMode = 'delete';

    // UI Updates for Delete Mode
    const modalTitle = document.getElementById('modal-title');
    const editInput = document.getElementById('edit-message-input');
    const deleteContainer = document.getElementById('delete-message-container');
    const confirmBtn = document.getElementById('modal-confirm-btn');

    if (modalTitle) modalTitle.textContent = "Eliminar Mensaje";
    if (editInput) editInput.style.display = 'none';
    if (deleteContainer) deleteContainer.style.display = 'block';

    if (confirmBtn) {
        confirmBtn.textContent = "Eliminar";
        confirmBtn.classList.remove('btn-save');
        confirmBtn.classList.add('btn-delete-confirm');
    }

    if (editModal) editModal.showModal();
}

// Edit Custom Message


// Filter Logic
function getFilteredMessages() {
    let combined = [...customMessages, ...allMessages];

    if (activeFilters.has('all')) {
        return combined;
    }

    return combined.filter(msg => {
        // Handle both single category (old) and array (new)
        const msgCats = Array.isArray(msg.categories) ? msg.categories : [msg.category];

        // Favorites
        if (activeFilters.has('favorites') && favorites.includes(msg.id)) return true;

        // Custom
        if (activeFilters.has('custom') && msg.isCustom === true) return true;

        // Categories Intersection
        return msgCats.some(cat => activeFilters.has(cat));
    });
}

// Reset and Render
function resetAndRender() {
    currentPage = 1;
    messagesGrid.innerHTML = '';
    loadMoreMessages();
}

// Load More Messages
function loadMoreMessages() {
    if (isLoading) return;
    isLoading = true;
    if (loadingIndicator) loadingIndicator.style.display = 'block';

    setTimeout(() => {
        const filtered = getFilteredMessages();
        const start = (currentPage - 1) * itemsPerLoad;
        const end = start + itemsPerLoad;
        const pageItems = filtered.slice(start, end);

        if (pageItems.length === 0 && currentPage === 1) {
            messagesGrid.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: #888;">No hay mensajes en esta categoría... ¡por ahora!</p>';
            if (loadingIndicator) loadingIndicator.style.display = 'none';
            isLoading = false;
            return;
        }

        pageItems.forEach(msg => {
            const card = createMessageCard(msg);
            messagesGrid.appendChild(card);
        });

        if (loadingIndicator) loadingIndicator.style.display = 'none';

        // If we have more items to load, show spinner at bottom
        if (end < filtered.length) {
            if (loadingIndicator) loadingIndicator.style.display = 'block';
        }

        currentPage++;
        isLoading = false;
    }, 300);
}

// Setup Intersection Observer
function setupIntersectionObserver() {
    const options = {
        root: null,
        rootMargin: '100px',
        threshold: 0.1
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting && !isLoading) {
                const filtered = getFilteredMessages();
                if ((currentPage - 1) * itemsPerLoad < filtered.length) {
                    loadMoreMessages();
                }
            }
        });
    }, options);

    if (loadingIndicator) observer.observe(loadingIndicator);
}

// Create Card
function createMessageCard(msg) {
    const isFav = favorites.includes(msg.id);
    const isSelected = selectedMessages.has(msg.id);
    const card = document.createElement('article');
    card.className = `message-card ${isSelected ? 'selected' : ''}`;
    card.dataset.category = Array.isArray(msg.categories) ? msg.categories[0] : msg.category;
    card.dataset.id = msg.id; // Crucial for selection logic
    card.onclick = () => window.toggleSelection(msg.id);

    // Badges HTML (Show all categories)
    const msgCats = Array.isArray(msg.categories) ? msg.categories : [msg.category];
    const badgesHtml = msgCats.map(cat => `<span class="category-badge">${cat}</span>`).join('');

    card.style.animation = 'fadeIn 0.5s ease-out';

    let deleteBtnHtml = '';
    if (msg.isCustom) {
        deleteBtnHtml = `
            <button class="edit-btn" data-id="${msg.id}" title="Editar" onclick="event.stopPropagation(); editCustomMessage(${msg.id})"><i class="fa-solid fa-pen"></i></button>
            <button class="delete-btn" data-id="${msg.id}" title="Borrar" onclick="event.stopPropagation(); deleteCustomMessage(${msg.id})"><i class="fa-solid fa-trash"></i></button>
        `;
    }

    card.innerHTML = `
        <div class="card-header">
            <div class="tags-container" style="display:flex;gap:5px;flex-wrap:wrap;">
                ${badgesHtml}
            </div>
            <div class="header-actions">
                ${deleteBtnHtml}
                <button class="favorite-btn ${isFav ? 'active' : ''}" data-id="${msg.id}" onclick="event.stopPropagation(); toggleFavorite(${msg.id})">
                    <i class="${isFav ? 'fa-solid' : 'fa-regular'} fa-heart"></i>
                </button>
            </div>
        </div>
        <div class="message-content">
            <p class="message-text" ${msg.isCustom ? `ondblclick="event.stopPropagation(); editCustomMessage(${msg.id})"` : ''} title="${msg.isCustom ? 'Doble clic para editar' : ''}">"${msg.text}"</p>
        </div>
        <div class="card-footer">
            <small>#${card.dataset.category}</small>
        </div>
    `;

    return card;
}

// Toggle Favorite (Global)
window.toggleFavorite = function (id) {
    const index = favorites.indexOf(id);
    if (index === -1) {
        favorites.push(id);
    } else {
        favorites.splice(index, 1);
    }
    localStorage.setItem('favorites', JSON.stringify(favorites));

    // Select buttons by data-id attribute -> Robust against onclick changes
    const btns = document.querySelectorAll(`.favorite-btn[data-id="${id}"]`);
    btns.forEach(btn => {
        btn.classList.toggle('active');
        const icon = btn.querySelector('i');
        if (favorites.includes(id)) {
            icon.classList.remove('fa-regular');
            icon.classList.add('fa-solid');
        } else {
            icon.classList.remove('fa-solid');
            icon.classList.add('fa-regular');
        }
    });

    // If currently viewing favorites, remove the card if unfavorited (and it's the only filter)
    if (activeFilters.has('favorites') && activeFilters.size === 1 && !favorites.includes(id)) {
        resetAndRender();
    }
};

// CSS Animation (appended once)
if (!document.getElementById('dynamic-styles')) {
    const styleSheet = document.createElement("style");
    styleSheet.id = 'dynamic-styles';
    styleSheet.innerText = `
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(20px); }
      to { opacity: 1; transform: translateY(0); }
    }
    `;
    document.head.appendChild(styleSheet);
}

// Custom Edit Modal Logic
const editModal = document.getElementById('edit-modal');
const editMessageInput = document.getElementById('edit-message-input');
let currentEditId = null;
let currentModalMode = 'edit';

// Expose to window to ensure global access
window.editCustomMessage = function (id) {
    const msg = customMessages.find(m => m.id === id);
    if (msg) {
        currentEditId = id;
        currentModalMode = 'edit';

        // UI Updates for Edit Mode
        const modalTitle = document.getElementById('modal-title');
        const editInput = document.getElementById('edit-message-input');
        const deleteContainer = document.getElementById('delete-message-container');
        const confirmBtn = document.getElementById('modal-confirm-btn');

        if (modalTitle) modalTitle.textContent = "Editar Mensaje";
        if (editInput) editInput.style.display = 'block';
        if (deleteContainer) deleteContainer.style.display = 'none';

        if (confirmBtn) {
            confirmBtn.textContent = "Guardar Cambios";
            confirmBtn.classList.remove('btn-delete-confirm');
            confirmBtn.classList.add('btn-save');
        }

        if (editInput) editInput.value = msg.text;
        if (editModal) editModal.showModal(); // Use Native Dialog API
        if (editInput) editInput.focus();
    }
};

window.closeEditModal = function () {
    editModal.close(); // Use Native Dialog API
    currentEditId = null;
};

window.handleModalConfirm = function () {
    if (currentEditId === null) return;

    if (currentModalMode === 'delete') {
        // Delete Logic
        customMessages = customMessages.filter(msg => msg.id !== currentEditId);
        localStorage.setItem('customMessages', JSON.stringify(customMessages));

        // Remove from favorites if present (cleanup)
        if (favorites.includes(currentEditId)) {
            favorites = favorites.filter(favId => favId !== currentEditId);
            localStorage.setItem('favorites', JSON.stringify(favorites));
        }

        resetAndRender();
        closeEditModal();

    } else {
        // Edit Logic
        const newText = editMessageInput.value.trim();
        if (newText) {
            const msgIndex = customMessages.findIndex(m => m.id === currentEditId);
            if (msgIndex !== -1) {
                customMessages[msgIndex].text = newText;
                localStorage.setItem('customMessages', JSON.stringify(customMessages));

                resetAndRender();
                closeEditModal();
            }
        } else {
            alert("El mensaje no puede estar vacío.");
        }
    }
};

// Close modal on backdrop click
if (editModal) {
    editModal.addEventListener('click', (e) => {
        const rect = editModal.getBoundingClientRect();
        const isInDialog = (rect.top <= e.clientY && e.clientY <= rect.top + rect.height && rect.left <= e.clientX && e.clientX <= rect.left + rect.width);
        if (!isInDialog) {
            editModal.close();
        }
    });
}

// Multi-Selection Logic
const selectedMessages = new Set();
const bulkActionsBar = document.getElementById('bulk-actions-bar');
const selectedCountSpan = document.getElementById('selected-count');

window.toggleSelection = function (id) {
    if (selectedMessages.has(id)) {
        selectedMessages.delete(id);
    } else {
        selectedMessages.add(id);
    }

    // Update UI for this card
    // We search for the card in DOM to avoid full re-render
    // Note: This relies on createMessageCard adding the onclick with ID, 
    // but better to find by some attribute if we added one. 
    // Since we re-render often, let's just re-render or toggle class manually.
    // Finding card by content or ID would be ideal.
    // Let's assume createMessageCard adds an ID or data attribute or we just toggle properties if we have the element. 
    // Actually, createMessageCard is called on render. 
    // Let's trigger a UI update for the specific element if found.

    const card = Array.from(messagesGrid.children).find(c => {
        // This is a bit hacky without a data-id on the card. 
        // Let's add data-id to createMessageCard first.
        return c.dataset.id == id;
    });

    if (card) {
        if (selectedMessages.has(id)) {
            card.classList.add('selected');
        } else {
            card.classList.remove('selected');
        }
    }

    updateBulkActionsUI();
};

function updateBulkActionsUI() {
    selectedCountSpan.textContent = selectedMessages.size;
    if (selectedMessages.size > 0) {
        bulkActionsBar.classList.add('visible');
    } else {
        bulkActionsBar.classList.remove('visible');
    }
}

window.clearSelection = function () {
    selectedMessages.clear();
    updateBulkActionsUI();
    document.querySelectorAll('.message-card.selected').forEach(card => card.classList.remove('selected'));
};

window.bulkFavorite = function () {
    selectedMessages.forEach(id => {
        if (!favorites.includes(id)) {
            favorites.push(id);
        }
    });
    localStorage.setItem('favorites', JSON.stringify(favorites));

    // Update UI
    // If we are in "favorites" view, we might need to add them, but usually we just update buttons.
    // Simplest is to just re-render to update hearts.
    resetAndRender();
    clearSelection();
};

window.bulkDelete = function () {
    // Only custom messages can be deleted
    const customIdsToDelete = Array.from(selectedMessages).filter(id => {
        return customMessages.some(m => m.id === id);
    });

    if (customIdsToDelete.length === 0) {
        alert("Ninguno de los mensajes seleccionados se puede borrar (son predefinidos).");
        return;
    }

    if (confirm(`¿Borrar ${customIdsToDelete.length} mensajes seleccionados?`)) {
        customMessages = customMessages.filter(m => !customIdsToDelete.includes(m.id));
        localStorage.setItem('customMessages', JSON.stringify(customMessages));

        // Also remove from favorites if present
        favorites = favorites.filter(id => !customIdsToDelete.includes(id));
        localStorage.setItem('favorites', JSON.stringify(favorites));

        resetAndRender();
        clearSelection();
    }
};