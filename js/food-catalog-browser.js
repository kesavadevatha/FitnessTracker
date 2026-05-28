const searchInput = document.getElementById('catalog-search');
const status = document.getElementById('catalog-status');
const results = document.getElementById('catalog-results');

if (window.auth) {
  auth.requireLogin();
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
  const unit = food.SERVING_SIZE_UNIT === 'unit' ? 'unit' : food.SERVING_SIZE_UNIT;
  return `${food.SERVING_SIZE} ${unit}${Number(food.SERVING_SIZE) === 1 ? '' : ''}`;
}

function getDefaultQuantity(food) {
  return food.MEASUREMENT_TYPE === 'unit' ? 1 : Number(food.SERVING_SIZE) || 1;
}

function getAllowedMealUnits(food) {
  if (food.MEASUREMENT_TYPE === 'unit') {
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

  modal.querySelectorAll('[data-close-modal]').forEach((element) => {
    element.addEventListener('click', closeModal);
  });
  modal.querySelector('.catalog-modal-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    await onSubmit(event.target);
  });

  document.body.appendChild(modal);
  activeModal = modal;
}

function buildEditModal(food) {
  const body = `
    <label>
      <span>Food name</span>
      <input type="text" name="foodName" value="${escapeHtml(food.FOOD_NAME)}" required />
    </label>
    <label>
      <span>Measurement type</span>
      <select name="measurementType" id="edit-measurement-type" required>
        <option value="g" ${food.MEASUREMENT_TYPE === 'g' ? 'selected' : ''}>Weight-based (grams)</option>
        <option value="unit" ${food.MEASUREMENT_TYPE === 'unit' ? 'selected' : ''}>Quantity-based (units)</option>
      </select>
    </label>
    <div class="form-row">
      <label>
        <span>Serving size</span>
        <input type="number" name="servingSize" id="edit-serving-size" min="1" step="0.1" value="${escapeHtml(food.SERVING_SIZE)}" required />
      </label>
      <label>
        <span>Serving size unit</span>
        <select name="servingSizeUnit" id="edit-serving-size-unit" required>
          <option value="g" ${food.SERVING_SIZE_UNIT === 'g' ? 'selected' : ''}>grams</option>
          <option value="unit" ${food.SERVING_SIZE_UNIT === 'unit' ? 'selected' : ''}>units</option>
        </select>
      </label>
    </div>
    <div class="macro-grid modal-macro-grid">
      <label>
        <span>Calories per serving</span>
        <input type="number" name="caloriesPerServing" min="0" step="0.1" value="${escapeHtml(food.CALORIES_PER_SERVING)}" required />
      </label>
      <label>
        <span>Protein per serving</span>
        <input type="number" name="proteinPerServing" min="0" step="0.1" value="${escapeHtml(food.PROTEIN_PER_SERVING)}" required />
      </label>
      <label>
        <span>Carbs per serving</span>
        <input type="number" name="carbsPerServing" min="0" step="0.1" value="${escapeHtml(food.CARBS_PER_SERVING)}" required />
      </label>
      <label>
        <span>Fat per serving</span>
        <input type="number" name="fatPerServing" min="0" step="0.1" value="${escapeHtml(food.FAT_PER_SERVING)}" required />
      </label>
    </div>
    <label>
      <span>Notes</span>
      <textarea name="notes" rows="4">${escapeHtml(food.NOTES || '')}</textarea>
    </label>
  `;

  openModal(`Edit ${food.FOOD_NAME}`, body, 'Save changes', async (form) => {
    const formData = new FormData(form);
    const payload = {
      foodName: formData.get('foodName'),
      measurementType: formData.get('measurementType'),
      servingSize: formData.get('servingSize'),
      servingSizeUnit: formData.get('servingSizeUnit'),
      caloriesPerServing: formData.get('caloriesPerServing'),
      proteinPerServing: formData.get('proteinPerServing'),
      carbsPerServing: formData.get('carbsPerServing'),
      fatPerServing: formData.get('fatPerServing'),
      notes: formData.get('notes') || ''
    };

    try {
      const response = await fetch(`/api/food-catalog/${food.FOOD_ID}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Unable to update food entry.');
      }

      showStatus(`Updated ${payload.foodName}.`);
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
  const unitOptions = mealUnits.map((unit) => `<option value="${unit}" ${unit === food.SERVING_SIZE_UNIT ? 'selected' : ''}>${unit}</option>`).join('');

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

  openModal(`Add ${food.FOOD_NAME} to a meal`, body, 'Add to meal', async (form) => {
    const formData = new FormData(form);
    const payload = {
      foodId: food.FOOD_ID,
      trackDate: formData.get('trackDate'),
      mealName: formData.get('mealName'),
      quantity: formData.get('quantity'),
      unit: formData.get('unit'),
      notes: formData.get('notes') || ''
    };

    try {
      const response = await auth.authFetch('/api/meal-log', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Unable to add item to meal.');
      }

      showStatus(`Added ${food.FOOD_NAME} to ${payload.mealName} on ${payload.trackDate}.`);
      closeModal();
      await loadCatalog(searchInput.value.trim());
    } catch (error) {
      showStatus(error.message, true);
    }
  });
}

function attachActionHandlers() {
  document.querySelectorAll('[data-edit-food]').forEach((button) => {
    button.addEventListener('click', () => {
      const food = currentCatalog.find((item) => String(item.FOOD_ID) === button.dataset.foodId);
      if (food) {
        buildEditModal(food);
      }
    });
  });

  document.querySelectorAll('[data-delete-food]').forEach((button) => {
    button.addEventListener('click', async () => {
      const food = currentCatalog.find((item) => String(item.FOOD_ID) === button.dataset.foodId);
      if (!food) {
        return;
      }

      if (!window.confirm(`Delete ${food.FOOD_NAME}? This cannot be undone.`)) {
        return;
      }

      try {
        const response = await fetch(`/api/food-catalog/${food.FOOD_ID}`, {
          method: 'DELETE'
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Unable to delete food entry.');
        }

        showStatus(`Deleted ${food.FOOD_NAME}.`);
        await loadCatalog(searchInput.value.trim());
      } catch (error) {
        showStatus(error.message, true);
      }
    });
  });

  document.querySelectorAll('[data-add-meal]').forEach((button) => {
    button.addEventListener('click', () => {
      const food = currentCatalog.find((item) => String(item.FOOD_ID) === button.dataset.foodId);
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

  results.innerHTML = items.map((food) => `
    <article class="catalog-card">
      <div class="catalog-card-header">
        <div>
          <h2>${escapeHtml(food.FOOD_NAME)}</h2>
          <p class="catalog-meta">Type: ${food.MEASUREMENT_TYPE === 'unit' ? 'quantity' : 'weight'} · Serving: ${formatServing(food)}</p>
        </div>
        <span class="badge">${food.MEASUREMENT_TYPE === 'unit' ? 'quantity' : 'weight'}</span>
      </div>
      <p class="catalog-meta">${escapeHtml(food.NOTES || 'No note added.')}</p>
      <div class="catalog-macros">
        <div class="macro-pill"><span>Calories</span><strong>${escapeHtml(food.CALORIES_PER_SERVING)}</strong></div>
        <div class="macro-pill"><span>Protein</span><strong>${escapeHtml(food.PROTEIN_PER_SERVING)} g</strong></div>
        <div class="macro-pill"><span>Carbs</span><strong>${escapeHtml(food.CARBS_PER_SERVING)} g</strong></div>
        <div class="macro-pill"><span>Fat</span><strong>${escapeHtml(food.FAT_PER_SERVING)} g</strong></div>
      </div>
      <button type="button" class="action-icon-btn action-add action-top-right" data-add-meal data-food-id="${escapeHtml(food.FOOD_ID)}" aria-label="Add ${escapeHtml(food.FOOD_NAME)} to meal" title="Add to meal">🍽</button>
      <div class="catalog-actions">
        <button type="button" class="action-icon-btn action-edit" data-edit-food data-food-id="${escapeHtml(food.FOOD_ID)}" aria-label="Edit ${escapeHtml(food.FOOD_NAME)}" title="Edit">✎</button>
        <button type="button" class="action-icon-btn action-delete" data-delete-food data-food-id="${escapeHtml(food.FOOD_ID)}" aria-label="Delete ${escapeHtml(food.FOOD_NAME)}" title="Delete">🗑</button>
      </div>
    </article>
  `).join('');

  attachActionHandlers();
}

async function loadCatalog(searchTerm = '') {
  showStatus('Loading catalog...');

  try {
    const response = await fetch(`/api/food-catalog${searchTerm ? `?search=${encodeURIComponent(searchTerm)}` : ''}`);

    if (!response.ok) {
      throw new Error(`Unable to load catalog (${response.status})`);
    }

    const data = await response.json();
    renderCatalog(data);
    showStatus(`Showing ${data.length} food${data.length === 1 ? '' : 's'}.`);
  } catch (error) {
    console.error(error);
    renderEmpty('Unable to load food catalog right now.');
    showStatus(error.message, true);
  }
}

searchInput.addEventListener('input', (event) => {
  loadCatalog(event.target.value.trim());
});

loadCatalog();
