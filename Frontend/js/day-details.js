const dayTitle = document.getElementById('day-title');
const dayCopy = document.getElementById('day-copy');
const dayRingsContainer = document.getElementById('day-rings-container');
const mealTabs = document.getElementById('meal-tabs');
const mealPanel = document.getElementById('meal-panel');
const addItemModal = document.getElementById('add-item-modal');
const addItemForm = document.getElementById('add-item-form');
const addItemFoodSelect = document.getElementById('add-item-food-select');
const addItemQuantityInput = document.getElementById('add-item-quantity');
const addItemUnitSelect = document.getElementById('add-item-unit');
const addItemNotesInput = document.getElementById('add-item-notes');
const catalogItemSummary = document.getElementById('catalog-item-summary');
const catalogItemPreview = document.getElementById('catalog-item-preview');
const closeAddItemModalButton = document.getElementById('close-add-item-modal');
const addItemTitle = document.getElementById('add-item-title');
const addItemFeedback = document.getElementById('add-item-feedback');
const addItemSubmitButton = document.getElementById('add-item-submit-btn');
const editItemModal = document.getElementById('edit-item-modal');
const editItemForm = document.getElementById('edit-item-form');
const editItemQuantityInput = document.getElementById('edit-item-quantity');
const editItemUnitSelect = document.getElementById('edit-item-unit');
const editItemFeedback = document.getElementById('edit-item-feedback');
const editItemSubmitButton = document.getElementById('edit-item-submit-btn');
const closeEditItemModalButton = document.getElementById('close-edit-item-modal');
const prevDayBtn = document.getElementById('prev-day-btn');
const nextDayBtn = document.getElementById('next-day-btn');
const MEAL_ORDER = [
  'Morning drink',
  'Breakfast',
  '1st snack',
  'Lunch',
  '2nd snack',
  'Dinner'
];

if (window.auth) {
  auth.requireLogin();
}

const currencyFormatter = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 0
});

const metricFormatter = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 1
});

const mealOrder = ['morning drink', 'breakfast', '1st snack', 'lunch', '2nd snack', 'dinner'];

const mealLabels = {
  'morning drink': 'Morning Drink',
  breakfast: 'Breakfast',
  '1st snack': '1st Snack',
  lunch: 'Lunch',
  '2nd snack': '2nd Snack',
  dinner: 'Dinner'
};

let catalogItems = [];
let activeAddMealName = null;
let currentDayDate = null;
let isSavingItem = false;

function getPreviousDay(dateString) {
  const date = new Date(`${dateString}T00:00:00`);
  date.setDate(date.getDate() - 1);
  return date.toISOString().slice(0, 10);
}

function getNextDay(dateString) {
  const date = new Date(`${dateString}T00:00:00`);
  date.setDate(date.getDate() + 1);
  return date.toISOString().slice(0, 10);
}

function navigateToDay(dateString) {
  const url = new URL(window.location);
  url.searchParams.set('date', dateString);
  window.history.pushState({}, '', url.toString());
  loadDayDetails();
}

function normalizeUnitForSelect(unit) {
  const normalized = String(unit || 'g').toLowerCase();

  if (['g', 'gram', 'grams'].includes(normalized)) {
    return 'g';
  }

  if (['kg', 'kilogram', 'kilograms'].includes(normalized)) {
    return 'kg';
  }

  if (['oz', 'ounce', 'ounces'].includes(normalized)) {
    return 'oz';
  }

  if (['ml', 'milliliter', 'milliliters'].includes(normalized)) {
    return 'ml';
  }

  if (['unit', 'units', 'quantity'].includes(normalized)) {
    return 'unit';
  }

  return 'g';
}

function safeNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeWeightKg(weight, unit) {
  const parsedWeight = safeNumber(weight);
  if (!parsedWeight) {
    return 0;
  }

  const normalizedUnit = String(unit || '').trim().toLowerCase();
  if (['lb', 'lbs', 'pound', 'pounds'].includes(normalizedUnit)) {
    return parsedWeight * 0.45359237;
  }

  return parsedWeight;
}

function normalizeHeightCm(height, unit) {
  const parsedHeight = safeNumber(height);
  if (!parsedHeight) {
    return 0;
  }

  const normalizedUnit = String(unit || '').trim().toLowerCase();
  if (['in', 'inch', 'inches'].includes(normalizedUnit)) {
    return parsedHeight * 2.54;
  }

  if (['ft', 'foot', 'feet'].includes(normalizedUnit)) {
    return parsedHeight * 30.48;
  }

  return parsedHeight;
}


function normalizeUnitForSelect(unit) {
  const normalized = String(unit || 'g').toLowerCase();

  if (['g', 'gram', 'grams'].includes(normalized)) {
    return 'g';
  }

  if (['kg', 'kilogram', 'kilograms'].includes(normalized)) {
    return 'kg';
  }

  if (['oz', 'ounce', 'ounces'].includes(normalized)) {
    return 'oz';
  }

  if (['ml', 'milliliter', 'milliliters'].includes(normalized)) {
    return 'ml';
  }

  if (['unit', 'units', 'quantity'].includes(normalized)) {
    return 'unit';
  }

  return 'g';
}

function formatDateLabel(dateString) {
  if (!dateString) {
    return 'Selected day';
  }

  const date = new Date(`${dateString}T00:00:00`);
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  });
}

function normalizeMeals(rows) {
  const mealMap = new Map();

  // initialize all 6 meals with empty structure
  MEAL_ORDER.forEach((meal) => {
    mealMap.set(meal, {
      mealName: meal,
      label: mealLabels[meal] || meal,
      items: [],
      totals: {
        calories: 0,
        protein: 0,
        carbs: 0,
        fat: 0
      }
    });
  });

  // fill from API response
  rows.forEach((row) => {
    const mealKey = row.meal_name.toLowerCase();

    if (!mealMap.has(mealKey)) return;

    const meal = mealMap.get(mealKey);

    meal.items.push({
      mealLogId: row.meal_log_id,
      foodName: row.food_name,
      quantity: row.quantity,
      unit: row.unit,
      notes: row.notes,
      calories: row.calories,
      protein: row.protein,
      carbs: row.carbs,
      fat: row.fat
    });

    // accumulate totals safely
    meal.totals.calories += Number(row.calories || 0);
    meal.totals.protein += Number(row.protein || 0);
    meal.totals.carbs += Number(row.carbs || 0);
    meal.totals.fat += Number(row.fat || 0);
  });

  return Array.from(mealMap.values());
}

function renderMealPanels(data) {
  if (!data.meals || !data.meals.length) {
    mealTabs.innerHTML = '';
    mealPanel.innerHTML = `
      <div class="meal-panel-card">
        <p class="empty-state">No meal logs were found for this date. Use the catalog browser to add meals and return here.</p>
      </div>
    `;
    return;
  }

  mealTabs.innerHTML = data.meals.map((meal, index) => `
    <button
      type="button"
      class="meal-tab-btn ${index === 0 ? 'active' : ''}"
      data-meal="${meal.mealName}"
      role="tab"
      aria-selected="${index === 0 ? 'true' : 'false'}"
    >
      ${meal.label}
    </button>
  `).join('');

  mealPanel.innerHTML = data.meals.map((meal, index) => {
    const hiddenClass = index === 0 ? '' : 'hidden';

    return `
      <section class="meal-panel-card ${hiddenClass}" data-meal-panel="${meal.mealName}">
        <div class="panel-header">
          <div>
            <p class="panel-title">${meal.label}</p>
            <p class="panel-subcopy">Review the items consumed for this meal and the combined macros.</p>
          </div>
          <button type="button" class="primary-btn add-item-btn" data-add-item="${meal.mealName}">Add item</button>
        </div>

        <div class="summary-row">
          <div class="summary-pill">
            <span>Calories</span>
            <strong>${currencyFormatter.format(meal.totals.calories)} kcal</strong>
          </div>
          <div class="summary-pill">
            <span>Protein</span>
            <strong>${metricFormatter.format(meal.totals.protein)} g</strong>
          </div>
          <div class="summary-pill">
            <span>Carbs</span>
            <strong>${metricFormatter.format(meal.totals.carbs)} g</strong>
          </div>
          <div class="summary-pill">
            <span>Fat</span>
            <strong>${metricFormatter.format(meal.totals.fat)} g</strong>
          </div>
        </div>

        <div class="item-list">
          ${meal.items.length ? meal.items.map((item) => `
            <article class="item-row">
              <div class="item-row-header">
                <div>
                  <h3>${item.foodName}</h3>
                  <p class="item-meta">${item.quantity} ${item.unit}${item.notes ? ` • ${item.notes}` : ''}</p>
                </div>
                <div class="item-actions">
                  <button type="button" class="secondary-btn edit-item-btn" data-edit-item="${item.mealLogId}" data-item-quantity="${item.quantity}" data-item-unit="${item.unit}" aria-label="Edit ${item.foodName}">Edit</button>
                  <button type="button" class="secondary-btn delete-item-btn" data-delete-item="${item.mealLogId}" aria-label="Delete ${item.foodName}">Delete</button>
                </div>
              </div>
              <div class="item-macros">
                <span>${currencyFormatter.format(item.calories)} kcal</span>
                <span>${metricFormatter.format(item.protein)} g protein</span>
                <span>${metricFormatter.format(item.carbs)} g carbs</span>
                <span>${metricFormatter.format(item.fat)} g fat</span>
              </div>
            </article>
          `).join('') : `<div class="empty-state">No items logged for this meal on the selected day.</div>`}
        </div>
      </section>
    `;
  }).join('');

  mealTabs.querySelectorAll('.meal-tab-btn').forEach((button) => {
    button.addEventListener('click', () => {
      const mealName = button.dataset.meal;

      mealTabs.querySelectorAll('.meal-tab-btn').forEach((tabButton) => {
        const isActive = tabButton === button;
        tabButton.classList.toggle('active', isActive);
        tabButton.setAttribute('aria-selected', isActive ? 'true' : 'false');
      });

      mealPanel.querySelectorAll('[data-meal-panel]').forEach((panel) => {
        panel.classList.toggle('hidden', panel.dataset.mealPanel !== mealName);
      });
    });
  });

  mealPanel.querySelectorAll('[data-add-item]').forEach((button) => {
    button.addEventListener('click', () => {
      openAddItemModal(button.dataset.addItem);
    });
  });

  mealPanel.querySelectorAll('[data-edit-item]').forEach((button) => {
    button.addEventListener('click', () => {
      openEditItemModal(button.dataset.editItem, button.dataset.itemQuantity, button.dataset.itemUnit);
    });
  });

  mealPanel.querySelectorAll('[data-delete-item]').forEach((button) => {
    button.addEventListener('click', async () => {
      await handleDeleteItem(button.dataset.deleteItem);
    });
  });
}

function closeAddItemModal() {
  addItemModal.classList.add('hidden');
  addItemModal.setAttribute('aria-hidden', 'true');
  addItemFeedback.textContent = '';
  addItemForm.reset();
  isSavingItem = false;
  addItemSubmitButton.disabled = false;
  addItemSubmitButton.textContent = 'Add item';
}

async function openAddItemModal(mealName) {
  activeAddMealName = mealName;
  addItemFeedback.textContent = '';
  addItemSubmitButton.disabled = false;
  addItemSubmitButton.textContent = 'Add item';
  addItemModal.classList.remove('hidden');
  addItemModal.setAttribute('aria-hidden', 'false');

  const selectedMealLabel = mealLabels[mealName] || mealName;
  addItemTitle.textContent = `Add food to ${selectedMealLabel}`;

  if (!catalogItems.length) {
    addItemFeedback.textContent = 'Loading food catalog...';
    await loadCatalogItems();
  }

  if (!catalogItems.length) {
    addItemFoodSelect.innerHTML = '<option value="">No food items available</option>';
    addItemFoodSelect.disabled = true;
    addItemQuantityInput.disabled = true;
    addItemUnitSelect.disabled = true;
    addItemNotesInput.disabled = true;
    catalogItemSummary.classList.add('hidden');
    addItemFeedback.textContent = 'No food catalog items are available right now.';
    return;
  }

  addItemFoodSelect.innerHTML = catalogItems.map((item) => `
    <option value="${item.food_id}">${item.food_name}</option>
  `).join('');

  addItemFoodSelect.disabled = false;
  addItemQuantityInput.disabled = false;
  addItemUnitSelect.disabled = false;
  addItemNotesInput.disabled = false;
  addItemFoodSelect.value = String(catalogItems[0].food_id);

  updateCatalogPreview();
  addItemFeedback.textContent = 'Choose a food item and add your serving details.';
}

function updateCatalogPreview() {
  const selectedItem = catalogItems.find((item) => String(item.food_id) === String(addItemFoodSelect.value));

  if (!selectedItem) {
    catalogItemSummary.classList.add('hidden');
    return;
  }

  addItemQuantityInput.value = Number(selectedItem.serving_size) || 1;
  addItemUnitSelect.value = normalizeUnitForSelect(selectedItem.serving_size_unit || 'g');

  catalogItemSummary.classList.remove('hidden');

  catalogItemPreview.innerHTML = `
    ${selectedItem.food_name} • ${currencyFormatter.format(Number(selectedItem.calories_per_serving || 0))} kcal,
    ${metricFormatter.format(Number(selectedItem.protein_per_serving || 0))} g protein,
    ${metricFormatter.format(Number(selectedItem.carbs_per_serving || 0))} g carbs,
    ${metricFormatter.format(Number(selectedItem.fat_per_serving || 0))} g fat per serving.
    ${selectedItem.notes ? `<br />${selectedItem.notes}` : ''}
  `;
}

async function loadCatalogItems() {
  try {
    const response = await auth.authFetch(`${API_BASE_URL}/api/food-catalog`);

    if (!response.ok) {
      throw new Error(`Unable to load food catalog (${response.status})`);
    }

    catalogItems = await response.json();
  } catch (error) {
    console.error(error);
    catalogItems = [];
  }
}

let activeEditMealLogId = null;
let isUpdatingItem = false;

function closeEditItemModal() {
  editItemModal.classList.add('hidden');
  editItemModal.setAttribute('aria-hidden', 'true');
  editItemFeedback.textContent = '';
  editItemForm.reset();
  isUpdatingItem = false;
  editItemSubmitButton.disabled = false;
  editItemSubmitButton.textContent = 'Update item';
  activeEditMealLogId = null;
}

function openEditItemModal(mealLogId, quantity, unit) {
  activeEditMealLogId = Number(mealLogId);
  editItemFeedback.textContent = '';
  editItemSubmitButton.disabled = false;
  editItemSubmitButton.textContent = 'Update item';
  editItemQuantityInput.value = Number(quantity) || 1;
  editItemUnitSelect.value = normalizeUnitForSelect(unit || 'g');
  editItemModal.classList.remove('hidden');
  editItemModal.setAttribute('aria-hidden', 'false');
}

async function handleEditItemSubmit(event) {
  event.preventDefault();

  if (isUpdatingItem) {
    return;
  }

  if (!activeEditMealLogId || !currentDayDate) {
    editItemFeedback.textContent = 'Please select a day and item before saving changes.';
    return;
  }

  const quantity = Number(editItemQuantityInput.value);

  if (!Number.isFinite(quantity) || quantity <= 0) {
    editItemFeedback.textContent = 'Please enter a valid quantity.';
    return;
  }

  isUpdatingItem = true;
  editItemSubmitButton.disabled = true;
  editItemSubmitButton.textContent = 'Saving...';
  editItemFeedback.textContent = 'Saving item changes...';

  try {
    const response = await auth.authFetch(`${API_BASE_URL}/api/meal-log/${activeEditMealLogId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        quantity,
        unit: editItemUnitSelect.value
      })
    });

    if (!response.ok) {
	  const errorData = await response.json();
	  console.error('UPDATE ERROR:', errorData);
      throw new Error('Unable to update item.');
    }

    closeEditItemModal();
    await loadDayDetails();
  } catch (error) {
    console.error(error);
    editItemFeedback.textContent = error.message;
    isUpdatingItem = false;
    editItemSubmitButton.disabled = false;
    editItemSubmitButton.textContent = 'Update item';
  }
}

async function handleDeleteItem(mealLogId) {
  if (!mealLogId) {
    return;
  }

  if (!window.confirm('Delete this meal item? This cannot be undone.')) {
    return;
  }

  try {
    const response = await auth.authFetch(`${API_BASE_URL}/api/meal-log/${mealLogId}`, {
      method: 'DELETE'
    });

    if (!response.ok) {
      throw new Error('Unable to delete item.');
    }

    await loadDayDetails();
  } catch (error) {
    console.error(error);
    window.alert(error.message);
  }
}

async function handleAddItemSubmit(event) {
  console.log('ADD ITEM SUBMIT FIRED');
  event.preventDefault();

  if (isSavingItem) {
    return;
  }

  if (!activeAddMealName || !currentDayDate) {
    addItemFeedback.textContent = 'Please select a day and meal before adding an item.';
    return;
  }

  const selectedFoodId = addItemFoodSelect.value;
  const quantity = Number(addItemQuantityInput.value);
  
  console.log('selectedFoodId =', selectedFoodId);
	console.log('quantity =', quantity);
	console.log('activeAddMealName =', activeAddMealName);
	console.log('currentDayDate =', currentDayDate);

	const payload = {
	  food_id: Number(selectedFoodId),
	  track_date: currentDayDate,
	  meal_name: activeAddMealName,
	  quantity,
	  unit: addItemUnitSelect.value,
	  notes: addItemNotesInput.value.trim() || null
	};
	
	console.log('POST PAYLOAD =', payload);

  if (!selectedFoodId || !Number.isFinite(quantity) || quantity <= 0) {
    addItemFeedback.textContent = 'Please choose a food and enter a valid quantity.';
    return;
  }

  isSavingItem = true;
  addItemSubmitButton.disabled = true;
  addItemSubmitButton.textContent = 'Saving...';
  addItemFeedback.textContent = 'Saving item...';

  try {
    const response = await auth.authFetch(`${API_BASE_URL}/api/meal-log`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
	console.log('POST RESPONSE STATUS =', response.status);

    if (!response.ok) {
      throw new Error('Unable to add item.');
    }

    closeAddItemModal();
    await loadDayDetails();
  } catch (error) {
    console.error(error);
    addItemFeedback.textContent = error.message;
    isSavingItem = false;
    addItemSubmitButton.disabled = false;
    addItemSubmitButton.textContent = 'Add item';
  }
}

async function loadDayDetails() {
  const params = new URLSearchParams(window.location.search);
  const date = params.get('date');

  if (!date) return;

  currentDayDate = date;

  dayTitle.textContent = formatDateLabel(date);
  dayCopy.textContent = `Review the meal breakdown for ${formatDateLabel(date)}.`;

  try {
    const response = await auth.authFetch(
      `${API_BASE_URL}/api/day-details?date=${encodeURIComponent(date)}`
    );

    if (!response.ok) {
      throw new Error(`Unable to fetch day details (${response.status})`);
    }

    const data = await response.json();

    console.log("DAY DETAILS RESPONSE:", data);

    // Fetch user profile and targets for progress rings
    let targets = null;
    try {
      const profileResp = await auth.authFetch(`${API_BASE_URL}/api/user/profile`);
      if (profileResp.ok) {
        const profile = await profileResp.json();
        
        const weightKg = normalizeWeightKg(profile.weight ?? profile.weight_kg ?? profile.weightKg, profile.weightUnit || profile.weight_unit);
        const heightCm = normalizeHeightCm(profile.height ?? profile.height_cm ?? profile.heightCm, profile.heightUnit || profile.height_unit);
        
        const dob = profile.dateOfBirth || profile.date_of_birth || null;
        let age = 30;
        if (dob) {
          const yy = new Date(dob);
          if (!Number.isNaN(yy.getTime())) {
            age = new Date().getFullYear() - yy.getFullYear();
          }
        }

        const payload = {
          sex: (profile.gender || profile.sex || 'male'),
          weightKg: weightKg,
          heightCm: heightCm,
          age,
          activityLevel: profile.activityLevel || profile.activity || 'sedentary',
          goal: profile.goal || 'maintain weight'
        };

        const targetsResp = await auth.authFetch(`${API_BASE_URL}/api/targets`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        if (targetsResp.ok) {
          targets = await targetsResp.json();
        }
      }
    } catch (err) {
      console.error('Targets/profile fetch failed:', err);
    }

    renderProgressRings(dayRingsContainer, data.totals, targets);
    renderMealPanels(data);

  } catch (error) {
    console.error('LoadDayDetails error:', error);

    dayCopy.textContent = 'Unable to load this day\u2019s meal details right now.';
    dayRingsContainer.innerHTML = '';
    mealTabs.innerHTML = '';
    mealPanel.innerHTML = `
      <div class="meal-panel-card">
        <p class="empty-state">Unable to load the selected day's meal details. ${error.message || 'Please try again.'}</p>
      </div>
    `;
  }
}

addItemFoodSelect.addEventListener('change', updateCatalogPreview);
addItemForm.addEventListener('submit', handleAddItemSubmit);
closeAddItemModalButton.addEventListener('click', closeAddItemModal);
addItemModal.querySelectorAll('[data-close-modal]').forEach((element) => {
  element.addEventListener('click', closeAddItemModal);
});

editItemForm.addEventListener('submit', handleEditItemSubmit);
closeEditItemModalButton.addEventListener('click', closeEditItemModal);
editItemModal.querySelectorAll('[data-close-modal]').forEach((element) => {
  element.addEventListener('click', closeEditItemModal);
});

if (prevDayBtn) {
  prevDayBtn.addEventListener('click', () => {
    if (currentDayDate) {
      navigateToDay(getPreviousDay(currentDayDate));
    }
  });
}

if (nextDayBtn) {
  nextDayBtn.addEventListener('click', () => {
    if (currentDayDate) {
      navigateToDay(getNextDay(currentDayDate));
    }
  });
}

loadCatalogItems();
loadDayDetails();

console.log('BOTTOM OF FILE REACHED');

console.log('addItemForm', addItemForm);

addItemForm.addEventListener('submit', (e) => {
  console.log('RAW SUBMIT FIRED');
});