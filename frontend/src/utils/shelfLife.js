/**
 * AgriChain — Shelf Life & Freshness Utilities
 * Provides produce shelf-life data and freshness calculations.
 */

const SHELF_LIFE_DAYS = {
  tomato:    7,  onion:     30, potato:    60, wheat:     365,
  rice:      365, mango:    5,  banana:    7,  apple:     30,
  carrot:    30, spinach:   5,  corn:      5,  garlic:    90,
  ginger:    30, chili:     14, cauliflower: 7, cabbage:  14,
  broccoli:  7,  lettuce:   7,  cucumber:  10, pumpkin:  60,
  grapes:    14, orange:    21, lemon:     21, watermelon: 14,
  strawberry: 3, default:   14,
};

/**
 * Returns shelf life in days for a given produce type.
 */
export function getShelfLifeDays(produceType = "") {
  const key = produceType.trim().toLowerCase();
  return SHELF_LIFE_DAYS[key] ?? SHELF_LIFE_DAYS.default;
}

/**
 * Returns freshness info based on harvestTimestamp (seconds since epoch).
 * @returns { percent, daysRemaining, daysOld, label, color, bgColor }
 */
export function getFreshnessInfo(harvestTimestamp, produceType = "") {
  const shelfDays = getShelfLifeDays(produceType);
  const now       = Date.now();
  const harvestMs = Number(harvestTimestamp) * 1000;
  const ageMs     = now - harvestMs;
  const ageDays   = ageMs / (1000 * 60 * 60 * 24);
  const daysRemaining = Math.max(0, shelfDays - ageDays);
  const percent       = Math.max(0, Math.min(100, (daysRemaining / shelfDays) * 100));

  let label, color, bgColor;
  if (percent >= 70) {
    label = "Fresh"; color = "#065f46"; bgColor = "#d1fae5";
  } else if (percent >= 40) {
    label = "Good"; color = "#92400e"; bgColor = "#fef3c7";
  } else if (percent > 0) {
    label = "Aging"; color = "#b45309"; bgColor = "#fef9c3";
  } else {
    label = "Expired"; color = "#991b1b"; bgColor = "#fee2e2";
  }

  return {
    percent:       Math.round(percent),
    daysRemaining: Math.round(daysRemaining),
    daysOld:       Math.round(ageDays),
    shelfDays,
    label,
    color,
    bgColor,
  };
}

/**
 * Returns color for batch age display based on days old.
 */
export function getBatchAgeColor(daysOld) {
  if (daysOld <= 3)  return { color: "#065f46", bg: "#d1fae5" };
  if (daysOld <= 7)  return { color: "#92400e", bg: "#fef3c7" };
  return { color: "#991b1b", bg: "#fee2e2" };
}

/** Static crop price table (INR per kg) for earnings estimator */
export const CROP_PRICES = {
  tomato: 25, onion: 18, potato: 15, wheat: 22, rice: 35,
  mango: 60, banana: 30, apple: 80, carrot: 20, spinach: 30,
  corn: 18, garlic: 120, ginger: 80, chili: 50, default: 20,
};

export function getCropPrice(produceType = "") {
  const key = produceType.trim().toLowerCase();
  return CROP_PRICES[key] ?? CROP_PRICES.default;
}
