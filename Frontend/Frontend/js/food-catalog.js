const form = document.getElementById('food-catalog-form');
const status = document.getElementById('catalog-status');
const measurement_type = document.getElementById('measurement-type');

const openBtn = document.getElementById('open-add-item');
const closeBtn = document.getElementById('close-add-item');
const modal = document.getElementById('add-food-modal');

const serving_size = document.getElementById('serving-size');
const serving_size_unit = document.getElementById('serving-size-unit');

if (window.auth) {
  auth.requireLogin();
}

let isSaving = false;

function toNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function syncServingDefaults() {
  const selected = measurement_type.value;

  if (selected === 'unit') {
    serving_size.value = '1';
    serving_size_unit.value = 'unit';
    return;
  }

  serving_size.value = '100';
  serving_size_unit.value = 'g';
}

measurement_type.addEventListener('change', syncServingDefaults);

function openModal() {
  if (!modal) return;
  modal.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
  syncServingDefaults();
}

function closeModal() {
  if (!modal) return;
  modal.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
}

if (openBtn) openBtn.addEventListener('click', (e) => { e.preventDefault(); openModal(); });
if (closeBtn) closeBtn.addEventListener('click', (e) => { e.preventDefault(); closeModal(); });
if (modal) modal.addEventListener('click', (e) => { if (e.target === modal.querySelector('.modal-backdrop')) closeModal(); });

form.addEventListener('submit', async (event) => {
  event.preventDefault();

  if (isSaving) return;

  const formData = new FormData(form);

  const food_name = String(formData.get('food_name') || '').trim();
  const measurement = String(formData.get('measurement_type') || '');
  const serving = toNumber(formData.get('serving_size'));
  const calories = toNumber(formData.get('calories_per_serving'));
  const protein = toNumber(formData.get('protein_per_serving'));
  const carbs = toNumber(formData.get('carbs_per_serving'));
  const fat = toNumber(formData.get('fat_per_serving'));

  const payload = {
    food_name,
    measurement_type: measurement,
    serving_size: serving,
    serving_size_unit: formData.get('serving_size_unit'),
    calories_per_serving: calories,
    protein_per_serving: protein,
    carbs_per_serving: carbs,
    fat_per_serving: fat,
    notes: String(formData.get('notes') || '').trim()
  };

  if (!food_name || !measurement || !serving) {
    status.textContent = 'Please fill in required fields (food name, measurement, serving size).';
    return;
  }

  isSaving = true;
  status.textContent = 'Saving food entry...';
  form.querySelectorAll('input, button, select, textarea').forEach(el => el.disabled = true);

  try {
    const response = await auth.authFetch(`${API_BASE_URL}/api/food-catalog`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data.error || 'Unable to save food entry.');
    }

    status.textContent = `Saved "${payload.food_name}". Available in Food Intake now.`;
    form.reset();
    syncServingDefaults();
    closeModal();
  } catch (error) {
    console.error(error);
    status.textContent = error.message || 'Something went wrong while saving.';
  } finally {
    isSaving = false;
    form.querySelectorAll('input, button, select, textarea').forEach(el => el.disabled = false);
  }
});

syncServingDefaults();