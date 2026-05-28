const form = document.getElementById('food-catalog-form');
const status = document.getElementById('catalog-status');
const measurementType = document.getElementById('measurement-type');

if (window.auth) {
  auth.requireLogin();
}
const servingSize = document.getElementById('serving-size');
const servingSizeUnit = document.getElementById('serving-size-unit');

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

  status.textContent = 'Saving food entry...';

  try {
    const response = await auth.authFetch('/api/food-catalog', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Unable to save food entry.');
    }

    status.textContent = `Saved ${payload.foodName}. You can now use it from Food Intake.`;
    form.reset();
    syncServingDefaults();
  } catch (error) {
    status.textContent = error.message;
  }
});

syncServingDefaults();
