/**
 * Progress Rings Color Configuration
 * Defines color thresholds based on percentage progress for different macro types
 */

const PROGRESS_RING_CONFIG = {
  // Protein coloring rules (stricter, more lenient at higher percentages)
  protein: {
    ranges: [
      { min: 0, max: 40, color: 'rgba(239, 68, 68, 0.6)' },        // Transparent Red (0-40%)
      { min: 40, max: 65, color: 'rgba(250, 204, 21, 0.7)' },      // Light Yellow (40-65%)
      { min: 65, max: 100, color: 'rgba(34, 197, 94, 0.8)' },      // Green (65-100%)
      { min: 100, max: Infinity, color: 'rgba(22, 163, 74, 0.9)' } // Dark Green (100%+)
    ]
  },

  // Calories, Carbs, Fat coloring rules (stricter at higher percentages)
  macro: {
    ranges: [
      { min: 0, max: 40, color: 'rgba(239, 68, 68, 0.4)' },        // Light Transparent Red (0-40%)
      { min: 40, max: 65, color: 'rgba(250, 204, 21, 0.6)' },      // Light Yellow (40-65%)
      { min: 65, max: 85, color: 'rgba(34, 197, 94, 0.8)' },       // Green (65-85%)
      { min: 85, max: 100, color: 'rgba(34, 197, 94, 0.4)' },      // Light Transparent Green (85-100%)
      { min: 100, max: Infinity, color: 'rgba(239, 68, 68, 0.8)' } // Red (100%+)
    ]
  }
};

// Expose on global window object for use in other files
if (typeof window !== 'undefined') {
  window.PROGRESS_RING_CONFIG = PROGRESS_RING_CONFIG;
}

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { PROGRESS_RING_CONFIG };
}
