const searchInput = document.getElementById('catalog-search');
const status = document.getElementById('catalog-status');
const results = document.getElementById('catalog-results');
const addItemButton = document.getElementById('open-add-item');

let currentUserEmail = '';

if (window.auth) {
  auth.requireLogin();
  currentUserEmail = String(auth.getAuthUser()?.email || '').toLowerCase();
}

let currentCatalog = [];
let activeModal = null;

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatServing(food) {
  const unit = food.serving_size_unit === 'unit' ? 'unit' : food.serving_size_unit;
  return `${food.serving_size} ${unit}${Number(food.serving_size) === 1 ? '' : ''}`;
}

function getDefaultQuantity(food) {
  return food.measurement_type === 'unit' ? 1 : Number(food.serving_size) || 1;
}

function getAllowedMealUnits(food) {
  if (food.measurement_type === 'unit') {
    return ['unit'];
  }
  return ['g', 'kg', 'oz'];
}

function renderEmpty(message) {
  results.innerHTML = `<div class="empty-state">${message}</div>`;
}

function showStatus(message, isError = false) {
  status.textContent = message;
  status.style.color = isError ? '#fca5a5' : '#cbd5e1';
}

function closeModal() {
  if (activeModal) {
    activeModal.remove();
    activeModal = null;
  }
}

function openModal(title, bodyHtml, submitLabel, onSubmit) {
  closeModal();

  const modal = document.createElement('div');
  modal.className = 'catalog-modal-overlay';
  modal.innerHTML = `
    <div class="catalog-modal">
      <div class="catalog-modal-header">
        <div>
          <p class="eyebrow">Catalog actions</p>
          <h2>${escapeHtml(title)}</h2>
        </div>
        <button type="button" class="icon-button" data-close-modal aria-label="Close modal">✕</button>
      </div>
      <form class="catalog-modal-form">
        ${bodyHtml}
        <div class="catalog-modal-actions">
          <button type="button" class="secondary-btn" data-close-modal>Cancel</button>
          <button type="submit" class="primary-btn">${escapeHtml(submitLabel)}</button>
        </div>
      </form>
    </div>
  `;

  modal.querySelectorAll('[data-close-modal]').forEach((el) => {
    el.addEventListener('click', closeModal);
  });

  modal.querySelector('.catalog-modal-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    await onSubmit(event.target);
  });

  document.body.appendChild(modal);
  activeModal = modal;
}

if (addItemButton) {
  addItemButton.addEventListener('click', (event) => {
    event.preventDefault();
    buildAddFoodModal();
  });
}

/* -------------------- EDIT FOOD -------------------- */

function buildEditModal(food) {
  const body = `
    <label>
      <span>Food name</span>
      <input type="text" name="food_name" value="${escapeHtml(food.food_name)}" required />
    </label>
    <label>
      <span>Measurement type</span>
      <select name="measurement_type" id="edit-measurement-type" required>
        <option value="g" ${food.measurement_type === 'g' ? 'selected' : ''}>Weight-based (grams)</option>
        <option value="unit" ${food.measurement_type === 'unit' ? 'selected' : ''}>Quantity-based (units)</option>
      </select>
    </label>
    <div class="form-row">
      <label>
        <span>Serving size</span>
        <input type="number" name="serving_size" id="edit-serving-size" min="1" step="0.1" value="${escapeHtml(food.serving_size)}" required />
      </label>
      <label>
        <span>Serving size unit</span>
        <select name="serving_size_unit" id="edit-serving-size-unit" required>
          <option value="g" ${food.serving_size_unit === 'g' ? 'selected' : ''}>grams</option>
          <option value="unit" ${food.serving_size_unit === 'unit' ? 'selected' : ''}>units</option>
        </select>
      </label>
    </div>
    <div class="macro-grid modal-macro-grid">
      <label>
        <span>Calories per serving</span>
        <input type="number" name="calories_per_serving" min="0" step="0.1" value="${escapeHtml(food.calories_per_serving)}" required />
      </label>
      <label>
        <span>Protein per serving</span>
        <input type="number" name="protein_per_serving" min="0" step="0.1" value="${escapeHtml(food.protein_per_serving)}" required />
      </label>
      <label>
        <span>Carbs per serving</span>
        <input type="number" name="carbs_per_serving" min="0" step="0.1" value="${escapeHtml(food.carbs_per_serving)}" required />
      </label>
      <label>
        <span>Fat per serving</span>
        <input type="number" name="fat_per_serving" min="0" step="0.1" value="${escapeHtml(food.fat_per_serving)}" required />
      </label>
    </div>
    <label>
      <span>Notes</span>
      <textarea name="notes" rows="4">${escapeHtml(food.notes || '')}</textarea>
    </label>
  `;

  openModal(`Edit ${food.food_name}`, body, 'Save changes', async (form) => {
    const formData = new FormData(form);
    const payload = {
      food_name: formData.get('food_name'),
      measurement_type: formData.get('measurement_type'),
      serving_size: formData.get('serving_size'),
      serving_size_unit: formData.get('serving_size_unit'),
      calories_per_serving: formData.get('calories_per_serving'),
      protein_per_serving: formData.get('protein_per_serving'),
      carbs_per_serving: formData.get('carbs_per_serving'),
      fat_per_serving: formData.get('fat_per_serving'),
      notes: formData.get('notes') || ''
    };

      try {
        const response = await auth.authFetch(
          `${API_BASE_URL}/api/food-catalog/${food.food_id}`,
          {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          }
        );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Unable to update food entry.');
      }

      showStatus(`Updated ${payload.food_name}.`);
      closeModal();
      await loadCatalog(searchInput.value.trim());
    } catch (error) {
      showStatus(error.message, true);
    }
  });
  const typeField = activeModal.querySelector('#edit-measurement-type');
  const servingInput = activeModal.querySelector('#edit-serving-size');
  const servingUnitField = activeModal.querySelector('#edit-serving-size-unit');

  function syncServingDefaults() {
    if (typeField.value === 'unit') {
      servingInput.value = '1';
      servingUnitField.value = 'unit';
      return;
    }

    servingInput.value = '100';
    servingUnitField.value = 'g';
  }

  typeField.addEventListener('change', syncServingDefaults);
  syncServingDefaults();
}
function buildMealModal(food) {
  const today = new Date().toISOString().slice(0, 10);
  const defaultQuantity = getDefaultQuantity(food);
  const mealUnits = getAllowedMealUnits(food);
  const unitOptions = mealUnits.map((unit) => `<option value="${unit}" ${unit === food.serving_size_unit ? 'selected' : ''}>${unit}</option>`).join('');

  const body = `
    <label>
      <span>Date</span>
      <input type="date" name="trackDate" value="${today}" required />
    </label>
    <label>
      <span>Meal</span>
      <select name="mealName" required>
        <option value="morning drink">Morning Drink</option>
        <option value="breakfast">Breakfast</option>
        <option value="1st snack">1st Snack</option>
        <option value="lunch">Lunch</option>
        <option value="2nd snack">2nd Snack</option>
        <option value="dinner">Dinner</option>
      </select>
    </label>
    <div class="form-row">
      <label>
        <span>Quantity</span>
        <input type="number" name="quantity" min="0.1" step="0.1" value="${defaultQuantity}" required />
      </label>
      <label>
        <span>Unit</span>
        <select name="unit">${unitOptions}</select>
      </label>
    </div>
    <label>
      <span>Notes</span>
      <textarea name="notes" rows="4" placeholder="Optional note for this meal entry"></textarea>
    </label>
  `;

  openModal(`Add ${food.food_name} to a meal`, body, 'Add to meal', async (form) => {
    const formData = new FormData(form);

    const payload = {
      food_id: food.food_id,
      track_date: formData.get('trackDate'),
      meal_name: formData.get('mealName'),
      quantity: formData.get('quantity'),
      unit: formData.get('unit'),
      notes: formData.get('notes') || ''
    };

    try {
      const response = await auth.authFetch(`${API_BASE_URL}/api/meal-log`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Unable to add item to meal.');
      }

      showStatus(`Added ${food.food_name} to ${payload.mealName} on ${payload.trackDate}.`);
      closeModal();
      await loadCatalog(searchInput.value.trim());
    } catch (error) {
      showStatus(error.message, true);
    }
  });
}

function buildAddFoodModal() {
  const body = `
    <label>
      <span>Food name</span>
      <input type="text" name="food_name" placeholder="e.g. White rice" required />
    </label>
    <label>
      <span>Measurement type</span>
      <select name="measurement_type" id="add-measurement-type" required>
        <option value="g">Weight-based (grams)</option>
        <option value="unit">Quantity-based (units)</option>
      </select>
    </label>
    <div class="form-row">
      <label>
        <span>Serving size</span>
        <input type="number" name="serving_size" id="add-serving-size" min="1" step="0.1" value="100" required />
      </label>
      <label>
        <span>Serving size unit</span>
        <select name="serving_size_unit" id="add-serving-size-unit" required>
          <option value="g">grams</option>
          <option value="ml">ml</option>
          <option value="kg">kg</option>
          <option value="oz">oz</option>
          <option value="unit">units</option>
        </select>
      </label>
    </div>
    <div class="macro-grid modal-macro-grid">
      <label>
        <span>Calories per serving</span>
        <input type="number" name="calories_per_serving" min="0" step="0.1" value="0" required />
      </label>
      <label>
        <span>Protein per serving</span>
        <input type="number" name="protein_per_serving" min="0" step="0.1" value="0" required />
      </label>
      <label>
        <span>Carbs per serving</span>
        <input type="number" name="carbs_per_serving" min="0" step="0.1" value="0" required />
      </label>
      <label>
        <span>Fat per serving</span>
        <input type="number" name="fat_per_serving" min="0" step="0.1" value="0" required />
      </label>
    </div>
    <label>
      <span>Notes</span>
      <textarea name="notes" rows="4" placeholder="Optional notes about this food entry"></textarea>
    </label>
  `;

  openModal('Add new food item', body, 'Save food', async (form) => {
    const formData = new FormData(form);

    const payload = {
      food_name: formData.get('food_name'),
      measurement_type: formData.get('measurement_type'),
      serving_size: formData.get('serving_size'),
      serving_size_unit: formData.get('serving_size_unit'),
      calories_per_serving: formData.get('calories_per_serving'),
      protein_per_serving: formData.get('protein_per_serving'),
      carbs_per_serving: formData.get('carbs_per_serving'),
      fat_per_serving: formData.get('fat_per_serving'),
      notes: formData.get('notes') || ''
    };

    try {
      const response = await auth.authFetch(`${API_BASE_URL}/api/food-catalog`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Unable to save food entry.');
      }

      showStatus(`Added ${payload.food_name} to your catalog.`);
      closeModal();
      await loadCatalog(searchInput.value.trim());
    } catch (error) {
      showStatus(error.message, true);
    }
  });

  const typeField = activeModal.querySelector('#add-measurement-type');
  const servingInput = activeModal.querySelector('#add-serving-size');
  const servingUnitField = activeModal.querySelector('#add-serving-size-unit');

  function syncServingDefaults() {
    if (typeField.value === 'unit') {
      servingInput.value = '1';
      servingUnitField.value = 'unit';
      return;
    }

    servingInput.value = '100';
    servingUnitField.value = 'g';
  }

  typeField.addEventListener('change', syncServingDefaults);
  syncServingDefaults();
}

/* -------------------- RENDER -------------------- */

function attachActionHandlers() {
  document.querySelectorAll('[data-edit-food]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const food = currentCatalog.find(
        (f) => String(f.food_id) === btn.dataset.foodId
      );
      if (food) buildEditModal(food);
    });
  });

  document.querySelectorAll('[data-delete-food]').forEach((button) => {
    button.addEventListener('click', async () => {
      const food = currentCatalog.find((item) => String(item.food_id) === button.dataset.foodId);
      if (!food) {
        return;
      }

      if (!window.confirm(`Delete ${food.food_name}? This cannot be undone.`)) {
        return;
      }

      try {
        const response = await auth.authFetch(`${API_BASE_URL}/api/food-catalog/${food.food_id}`, {
          method: 'DELETE'
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Unable to delete food entry.');
        }

        showStatus(`Deleted ${food.food_name}.`);
        await loadCatalog(searchInput.value.trim());
      } catch (error) {
        showStatus(error.message, true);
      }
    });
  });

  document.querySelectorAll('[data-add-meal]').forEach((button) => {
    button.addEventListener('click', () => {
      const food = currentCatalog.find((item) => String(item.food_id) === button.dataset.foodId);
      if (food) {
        buildMealModal(food);
      }
    });
  });
}

function renderCatalog(items) {
  currentCatalog = items;

  if (!items.length) {
    renderEmpty('No foods matched your search. Try another keyword or add a new entry from the Food Catalog page.');
    return;
  }

  results.innerHTML = items.map((food) => {
    const isOwner = String(food.user_id || '').toLowerCase() === currentUserEmail;

    return `
      <article class="catalog-card">
        <div class="catalog-card-top">
          <div class="catalog-card-title-section">
            <h2 class="catalog-card-title">${escapeHtml(food.food_name)}</h2>
          </div>
          <button type="button" class="action-icon-btn action-add" data-add-meal data-food-id="${escapeHtml(food.food_id)}" aria-label="Add ${escapeHtml(food.food_name)} to meal" title="Add to meal">🍽</button>
        </div>
        <div class="catalog-macros-grid">
          <div class="macro-item"><span class="macro-icon">⚡</span><span class="macro-value">${escapeHtml(food.calories_per_serving)}</span></div>
          <div class="macro-item"><span class="macro-icon">🥩</span><span class="macro-value">${escapeHtml(food.protein_per_serving)}g</span></div>
          <div class="macro-item"><span class="macro-icon">🍞</span><span class="macro-value">${escapeHtml(food.carbs_per_serving)}g</span></div>
          <div class="macro-item"><span class="macro-icon">🥑</span><span class="macro-value">${escapeHtml(food.fat_per_serving)}g</span></div>
        </div>
        ${isOwner ? `
          <div class="catalog-actions">
            <button type="button" class="action-icon-btn action-edit" data-edit-food data-food-id="${escapeHtml(food.food_id)}" aria-label="Edit ${escapeHtml(food.food_name)}" title="Edit">✎</button>
            <button type="button" class="action-icon-btn action-delete" data-delete-food data-food-id="${escapeHtml(food.food_id)}" aria-label="Delete ${escapeHtml(food.food_name)}" title="Delete">🗑</button>
          </div>
        ` : ''}
      </article>
    `;
  }).join('');

  attachActionHandlers();
}

/* -------------------- LOAD -------------------- */

async function loadCatalog(searchTerm = '') {
  showStatus('Loading catalog...');

  try {
    const response = await auth.authFetch(
      `${API_BASE_URL}/api/food-catalog${searchTerm ? `?search=${encodeURIComponent(searchTerm)}` : ''}`
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(`Unable to load catalog (${response.status})`);
    }

    renderCatalog(data);
    showStatus(`Showing ${data.length} food${data.length === 1 ? '' : 's'}.`);
  } catch (error) {
    console.error(error);
    renderEmpty('Unable to load food catalog right now.');
    showStatus(error.message, true);
  }
}

/* -------------------- EXPORT/DOWNLOAD -------------------- */

async function fetchAllCatalogItems() {
  try {
    const response = await auth.authFetch(`${API_BASE_URL}/api/food-catalog`);
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || 'Unable to fetch catalog');
    }
    
    return data;
  } catch (error) {
    console.error('Failed to fetch catalog:', error);
    showStatus('Failed to download catalog: ' + error.message, true);
    return [];
  }
}

function exportToExcel(catalogData) {
  if (!catalogData || catalogData.length === 0) {
    showStatus('No catalog items to export', true);
    return;
  }

  // Prepare data for Excel
  const worksheetData = [
    ['Food Name', 'Calories', 'Protein (g)', 'Carbs (g)', 'Fat (g)', 'Serving Size', 'Serving Unit'],
    ...catalogData.map(food => [
      food.food_name,
      food.calories_per_serving,
      food.protein_per_serving,
      food.carbs_per_serving,
      food.fat_per_serving,
      food.serving_size,
      food.serving_size_unit
    ])
  ];

  // Create workbook and worksheet
  const wb = window.XLSX.utils.book_new();
  const ws = window.XLSX.utils.aoa_to_sheet(worksheetData);
  
  // Set column widths
  ws['!cols'] = [
    { wch: 25 }, // Food Name
    { wch: 12 }, // Calories
    { wch: 14 }, // Protein
    { wch: 12 }, // Carbs
    { wch: 10 }, // Fat
    { wch: 14 }, // Serving Size
    { wch: 14 }  // Serving Unit
  ];

  window.XLSX.utils.book_append_sheet(wb, ws, 'Food Catalog');
  
  // Generate filename with current date
  const dateStr = new Date().toISOString().split('T')[0];
  window.XLSX.writeFile(wb, `Food_Catalog_${dateStr}.xlsx`);
  
  showStatus(`Downloaded Excel report with ${catalogData.length} food items.`);
}

function exportToPDF(catalogData) {
  if (!catalogData || catalogData.length === 0) {
    showStatus('No catalog items to export', true);
    return;
  }

  const doc = new window.jspdf.jsPDF();
  console.log(window.jspdf);
  
  // Set title
  doc.setFontSize(16);
  doc.text('Food Catalog Report', 14, 22);
  
  // Add date
  doc.setFontSize(10);
  const dateStr = new Date().toLocaleDateString();
  doc.text(`Generated: ${dateStr}`, 14, 30);
  
  // Create table data
  const tableData = catalogData.map(food => [
    food.food_name,
    food.calories_per_serving,
    food.protein_per_serving,
    food.carbs_per_serving,
    food.fat_per_serving,
    food.serving_size,
    food.serving_size_unit
  ]);

  console.log(typeof doc.autoTable);
  if (typeof doc.autoTable !== 'function') {
    alert('AutoTable plugin not loaded');
    return;
  }
  // Add table to PDF
  doc.autoTable({
    head: [['Food Name', 'Calories', 'Protein (g)', 'Carbs (g)', 'Fat (g)', 'Serving Size', 'Serving Unit']],
    body: tableData,
    startY: 38,
    theme: 'grid',
    styles: {
      fontSize: 9,
      halign: 'center',
      valign: 'middle'
    },
    headStyles: {
      fillColor: [66, 133, 244],
      textColor: [255, 255, 255],
      fontStyle: 'bold'
    },
    margin: { top: 10, right: 10, bottom: 10, left: 10 }
  });

  // Save PDF
  const dateStr2 = new Date().toISOString().split('T')[0];
  doc.save(`Food_Catalog_${dateStr2}.pdf`);
  
  showStatus(`Downloaded PDF report with ${catalogData.length} food items.`);
}

async function handleDownloadClick() {
  showStatus('Preparing catalog for download...');
  
  const catalogData = await fetchAllCatalogItems();
  
  if (!catalogData || catalogData.length === 0) {
    return;
  }

  // Create a modal with format options
  const formatModal = document.createElement('div');
  formatModal.className = 'catalog-modal-overlay';
  formatModal.innerHTML = `
    <div class="catalog-modal">
      <div class="catalog-modal-header">
        <div>
          <p class="eyebrow">Download Options</p>
          <h2>Select Report Format</h2>
        </div>
        <button type="button" class="icon-button" data-close-format-modal aria-label="Close modal">✕</button>
      </div>
      <div class="catalog-modal-body" style="padding: 24px;">
        <p style="margin-bottom: 20px;">Choose the format for your food catalog report:</p>
        <div style="display: flex; gap: 12px;">
          <button type="button" id="export-excel-btn" class="primary-btn" style="flex: 1;">📊 Export as Excel</button>
          <button type="button" id="export-pdf-btn" class="primary-btn" style="flex: 1;">📄 Export as PDF</button>
        </div>
      </div>
    </div>
  `;

  const closeModal = () => {
    formatModal.remove();
  };

  formatModal.querySelector('[data-close-format-modal]').addEventListener('click', closeModal);
  
  formatModal.querySelector('#export-excel-btn').addEventListener('click', () => {
    exportToExcel(catalogData);
    closeModal();
  });
  
  formatModal.querySelector('#export-pdf-btn').addEventListener('click', () => {
    exportToPDF(catalogData);
    closeModal();
  });

  document.body.appendChild(formatModal);
}

/* -------------------- EVENTS -------------------- */

searchInput.addEventListener('input', (e) => {
  loadCatalog(e.target.value.trim());
});

const downloadButton = document.getElementById('download-catalog');
if (downloadButton) {
  downloadButton.addEventListener('click', (event) => {
    event.preventDefault();
    handleDownloadClick();
  });
}

loadCatalog();