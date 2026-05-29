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

  const food_name = String(formData.get('food_name') || '').trim();
  const measurement_type = String(formData.get('measurement_type') || '');

  const serving_size = toNumber(formData.get('serving_size'));

  const calories_per_serving = toNumber(
    formData.get('calories_per_serving')
  );

  const protein_per_serving = toNumber(
    formData.get('protein_per_serving')
  );

  const carbs_per_serving = toNumber(
    formData.get('carbs_per_serving')
  );

  const fat_per_serving = toNumber(
    formData.get('fat_per_serving')
  );

  const payload = {
    food_name,
    measurement_type,
    serving_size,
    serving_size_unit: formData.get('serving_size_unit'),

    calories_per_serving,
    protein_per_serving,
    carbs_per_serving,
    fat_per_serving,

    notes: String(formData.get('notes') || '').trim()
  };

  if (!food_name || !measurement_type || !serving_size) {
    status.textContent =
      'Please fill in required fields (food name, measurement, serving size).';
    return;
  }

  isSaving = true;

  status.textContent = 'Saving food entry...';

  form
    .querySelectorAll('input, button, select, textarea')
    .forEach((el) => {
      el.disabled = true;
    });

  try {
    const response = await auth.authFetch(
      `${API_BASE_URL}/api/food-catalog`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      }
    );

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data.error || 'Unable to save food entry.');
    }

    status.textContent =
      `Saved "${payload.food_name}". Available in Food Intake now.`;

    form.reset();

    syncServingDefaults();

  } catch (error) {
    console.error(error);

    status.textContent =
      error.message || 'Something went wrong while saving.';

  } finally {

    isSaving = false;

    form
      .querySelectorAll('input, button, select, textarea')
      .forEach((el) => {
        el.disabled = false;
      });
  }
});

syncServingDefaults();