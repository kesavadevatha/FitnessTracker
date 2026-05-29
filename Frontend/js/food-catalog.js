const form = document.getElementById('food-catalog-form');
const status = document.getElementById('catalog-status');
const measurementType = document.getElementById('measurement-type');

const servingSize = document.getElementById('serving-size');
const servingSizeUnit = document.getElementById('serving-size-unit');

if (window.auth) {
  auth.requireLogin();
}

let isSaving = false;

function toNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function syncServingDefaults() {
  const selected = measurementType.value;

  if (selected === 'unit') {
    servingSize.value = '1';
    servingSizeUnit.value = 'unit';
    return;
  }

  servingSize.value = '100';
  servingSizeUnit.value = 'g';
}

measurementType.addEventListener('change', syncServingDefaults);

form.addEventListener('submit', async (event) => {
  event.preventDefault();

  if (isSaving) return;

  const formData = new FormData(form);

  const foodName = String(formData.get('foodName') || '').trim();
  const measurement = String(formData.get('measurementType') || '');
  const serving = toNumber(formData.get('servingSize'));
  const calories = toNumber(formData.get('caloriesPerServing'));
  const protein = toNumber(formData.get('proteinPerServing'));
  const carbs = toNumber(formData.get('carbsPerServing'));
  const fat = toNumber(formData.get('fatPerServing'));

  const payload = {
    foodName,
    measurementType: measurement,
    servingSize: serving,
    servingSizeUnit: formData.get('servingSizeUnit'),
    caloriesPerServing: calories,
    proteinPerServing: protein,
    carbsPerServing: carbs,
    fatPerServing: fat,
    notes: String(formData.get('notes') || '').trim()
  };

  if (!foodName || !measurement || !serving) {
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

    status.textContent = `Saved "${payload.foodName}". Available in Food Intake now.`;

    form.reset();
    syncServingDefaults();
  } catch (error) {
    console.error(error);
    status.textContent = error.message || 'Something went wrong while saving.';
  } finally {
    isSaving = false;
    form.querySelectorAll('input, button, select, textarea').forEach(el => el.disabled = false);
  }
});

syncServingDefaults();