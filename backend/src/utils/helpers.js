function normalizeUnit(unit) {
  const value = String(unit || 'g').toLowerCase();

  if (['g', 'gram', 'grams'].includes(value)) return 'g';
  if (['kg', 'kilogram', 'kilograms'].includes(value)) return 'kg';
  if (['oz', 'ounce', 'ounces'].includes(value)) return 'oz';
  if (['ml', 'milliliter', 'milliliters'].includes(value)) return 'ml';
  if (['unit', 'units', 'quantity'].includes(value)) return 'unit';

  return value;
}

function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function convertToGrams(amount, unit) {
  if (unit === 'g') return amount;
  if (unit === 'kg') return amount * 1000;
  if (unit === 'oz') return amount * 28.3495;

  throw new Error('Unsupported unit. Please use grams, kilograms, or ounces.');
}

function calculateScale(food, quantity, unit) {
  const quantityValue = Number(quantity);
  const normalizedUnit = normalizeUnit(unit);

  if (!Number.isFinite(quantityValue) || quantityValue <= 0) {
    throw new Error('Quantity must be greater than 0.');
  }

  const foodUnit = String(food.serving_size_unit).toLowerCase();

  if (foodUnit === 'unit') {
    if (normalizedUnit !== 'unit') {
      throw new Error(
        `${food.food_name} is quantity-based. Please choose "unit" as the measurement.`
      );
    }
    return quantityValue / Number(food.serving_size);
  }

  if (foodUnit === 'ml') {
    if (normalizedUnit !== 'ml') {
      throw new Error(
        `${food.food_name} is volume-based. Please choose "ml" as the measurement.`
      );
    }
    return quantityValue / Number(food.serving_size);
  }

  if (normalizedUnit === 'unit' || normalizedUnit === 'ml') {
    throw new Error(
      `${food.food_name} is stored as a weight-based food. Please choose grams, kilograms, or ounces.`
    );
  }

  const grams = convertToGrams(quantityValue, normalizedUnit);
  return grams / Number(food.serving_size);
}

function roundTo(value, digits = 1) {
  return Number(value.toFixed(digits));
}

module.exports = {
  normalizeUnit,
  normalizeText,
  convertToGrams,
  calculateScale,
  roundTo
};
