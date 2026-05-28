const form = document.getElementById('food-form');
const resultBox = document.getElementById('macro-result');
const formStatus = document.getElementById('form-status');

if (window.auth) {
  auth.requireLogin();
}
const resultFoodName = document.getElementById('result-food-name');
const resultSource = document.getElementById('result-source');
const resultNote = document.getElementById('result-note');
const macroCalories = document.getElementById('macro-calories');
const macroProtein = document.getElementById('macro-protein');
const macroCarbs = document.getElementById('macro-carbs');
const macroFat = document.getElementById('macro-fat');

function formatNumber(value) {
  return Number.isFinite(value) ? value.toFixed(1) : '0.0';
}

function renderResult(data) {
  resultBox.classList.remove('hidden');
  resultFoodName.textContent = data.foodName || 'Food macros';
  resultSource.textContent = `Source: ${data.source}`;
  resultNote.textContent = data.note || 'Macros are estimated from the selected food and scaled to your entered quantity.';
  macroCalories.textContent = `${formatNumber(data.calories)} kcal`;
  macroProtein.textContent = `${formatNumber(data.protein)} g`;
  macroCarbs.textContent = `${formatNumber(data.carbs)} g`;
  macroFat.textContent = `${formatNumber(data.fat)} g`;
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();

  const formData = new FormData(form);
  const payload = {
    foodText: formData.get('foodText'),
    quantity: formData.get('quantity'),
    unit: formData.get('unit'),
    notes: formData.get('notes') || ''
  };

  formStatus.textContent = 'Searching local food catalog...';

  try {
    const response = await auth.authFetch('${API_BASE_URL}/api/food-macros', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Unable to fetch macros right now.');
    }

    renderResult(data);
    formStatus.textContent = `Macros loaded for ${data.foodName}.`;
  } catch (error) {
    resultBox.classList.add('hidden');
    formStatus.textContent = error.message;
  }
});
