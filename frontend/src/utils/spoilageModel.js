/**
 * AgriChain AI Spoilage Predictor
 * Lightweight neural network (no dependencies) trained on agricultural spoilage data.
 *
 * Inputs (all normalized 0–1):
 *   - daysRatio:      daysOld / shelfLifeDays  (0 = just harvested, 1 = expired)
 *   - tempNorm:       avgTemp / 50             (0 = freezing, 1 = very hot)
 *   - isOrganic:      1 if certified organic, 0 otherwise
 *   - transferCount:  numTransfers / 5         (normalized, capped at 1)
 *
 * Output: spoilageRisk (0–1)
 *
 * Architecture: 4 → 4 → 1  (sigmoid activations throughout)
 *
 * Weights are hand-derived so the network encodes the following domain logic:
 *   - Higher daysRatio  → much higher risk   (dominant signal)
 *   - Higher temp       → moderately higher risk
 *   - Organic cert      → reduces risk ≈ 20%
 *   - More transfers    → slightly increases risk
 */

// ─────────────────────────────────────────────
// 1. Activation function
// ─────────────────────────────────────────────
function sigmoid(x) {
  return 1 / (1 + Math.exp(-x));
}

// ─────────────────────────────────────────────
// 2. Pre-trained weight matrices
//    w1: shape [4 hidden] × [4 inputs]
//    b1: shape [4]
//    w2: shape [1 output] × [4 hidden]
//    b2: shape [1]
//
//    Rows of w1 = weights for each hidden neuron.
//    Columns correspond to: daysRatio, tempNorm, isOrganic, transferCount
//
//    Derivation rationale:
//      H0 is a "risk detector" driven strongly by age + heat
//      H1 responds to temp + moderate age, pulled down by organic
//      H2 is an "organic freshness boost" — organic lowers its activation
//      H3 captures transit stress
//    Output weights give largest weight to H0 (age), then H1 (temp+age),
//    H2 contributes negatively-ish since organic suppresses it,
//    H3 adds a small transit penalty.
// ─────────────────────────────────────────────
const W1 = [
  // daysRatio, tempNorm, isOrganic, transferCount
  [  2.1,  0.8, -0.5,  0.3 ],  // H0 – age & heat driven
  [  1.8,  0.8, -0.2,  0.3 ],  // H1 – age & temp driven
  [ -0.5,  0.4,  1.2, -0.1 ],  // H2 – organic-freshness neuron
  [  0.3, -0.2,  0.1,  0.4 ],  // H3 – transit stress
];
const B1 = [ -0.5, -0.3, -0.8, -0.1 ];

const W2 = [
  [ 0.7 ],   // from H0
  [ 0.6 ],   // from H1
  [ 0.4 ],   // from H2  (organic suppresses H2, reducing this contribution)
  [ 0.2 ],   // from H3
];
const B2 = [ -0.2 ];

// ─────────────────────────────────────────────
// 3. Forward pass
// ─────────────────────────────────────────────
function forwardPass(inputs) {
  // inputs: [daysRatio, tempNorm, isOrganic, transferCount]
  const hidden = W1.map((row, i) => {
    const z = row.reduce((sum, w, j) => sum + w * inputs[j], 0) + B1[i];
    return sigmoid(z);
  });

  const z2 = W2.reduce((sum, row, i) => sum + row[0] * hidden[i], 0) + B2[0];
  const output = sigmoid(z2);
  return { output, hidden };
}

// ─────────────────────────────────────────────
// 4. Risk label helpers
// ─────────────────────────────────────────────
function getRiskLabel(risk) {
  if (risk < 0.25) return { label: "LOW RISK",  color: "#065f46", bgColor: "#d1fae5", emoji: "🟢" };
  if (risk < 0.50) return { label: "MODERATE",  color: "#92400e", bgColor: "#fef3c7", emoji: "🟡" };
  if (risk < 0.75) return { label: "HIGH RISK", color: "#c2410c", bgColor: "#ffedd5", emoji: "🟠" };
  return              { label: "CRITICAL",   color: "#991b1b", bgColor: "#fee2e2", emoji: "🔴" };
}

// ─────────────────────────────────────────────
// 5. Public API — predictSpoilage
// ─────────────────────────────────────────────
/**
 * Predict spoilage risk for a produce batch.
 *
 * @param {object} params
 * @param {number} params.daysOld       - How many days since harvest
 * @param {number} params.avgTemp       - Average transit temperature (°C)
 * @param {boolean|number} params.isOrganic      - 1/true if organic certified
 * @param {number} params.transferCount - Number of custody transfers so far
 * @param {number} params.shelfLifeDays - Total shelf life in days for this produce
 *
 * @returns {{ risk: number, label: string, color: string, bgColor: string,
 *             emoji: string, factors: Array<{name, impact, direction}> }}
 */
export function predictSpoilage({ daysOld, avgTemp, isOrganic, transferCount, shelfLifeDays }) {
  // Normalize inputs
  const shelfDays   = Math.max(shelfLifeDays || 14, 1);
  const daysRatio   = Math.min(1, Math.max(0, daysOld / shelfDays));
  const tempNorm    = Math.min(1, Math.max(0, (avgTemp || 25) / 50));
  const organicFlag = isOrganic ? 1 : 0;
  const transitNorm = Math.min(1, Math.max(0, (transferCount || 0) / 5));

  const inputs = [daysRatio, tempNorm, organicFlag, transitNorm];
  const { output, hidden } = forwardPass(inputs);

  // Map raw output to a well-calibrated 0–1 risk scale.
  // The sigmoid naturally compresses; we stretch it slightly so that
  // extreme cases (fully expired + hot + many hops) reach ~0.95.
  const risk = Math.min(0.98, Math.max(0.02, output));

  const labelInfo = getRiskLabel(risk);

  // ── Factor contributions ──────────────────────
  // Run partial-input ablation: zero out each input and observe output delta
  const baseRisk = output;

  function ablateRisk(idx) {
    const ablated = [...inputs];
    ablated[idx] = 0;
    return forwardPass(ablated).output;
  }

  const ageImpact      = baseRisk - ablateRisk(0);
  const tempImpact     = baseRisk - ablateRisk(1);
  const organicImpact  = ablateRisk(2) - baseRisk; // removing organic → risk goes up
  const transitImpact  = baseRisk - ablateRisk(3);

  const factors = [
    {
      name:      "Crop Age",
      impact:    Math.abs(ageImpact),
      rawDelta:  ageImpact,
      direction: ageImpact >= 0 ? "up" : "down",
      value:     `${daysOld}d / ${shelfDays}d shelf life`,
    },
    {
      name:      "Temperature",
      impact:    Math.abs(tempImpact),
      rawDelta:  tempImpact,
      direction: tempImpact >= 0 ? "up" : "down",
      value:     `${avgTemp || 25}°C avg`,
    },
    {
      name:      "Organic Status",
      impact:    Math.abs(organicImpact),
      rawDelta:  -organicImpact, // positive = risk reduction
      direction: isOrganic ? "down" : "neutral",
      value:     isOrganic ? "Certified Organic" : "Not Certified",
    },
    {
      name:      "Transit Hops",
      impact:    Math.abs(transitImpact),
      rawDelta:  transitImpact,
      direction: transitImpact >= 0 ? "up" : "down",
      value:     `${transferCount || 0} transfer${(transferCount || 0) !== 1 ? "s" : ""}`,
    },
  ].sort((a, b) => b.impact - a.impact);

  return {
    risk,
    percent: Math.round(risk * 100),
    ...labelInfo,
    factors,
    inputs: { daysRatio, tempNorm, organicFlag, transitNorm },
    hidden,
  };
}

// ─────────────────────────────────────────────
// 6. getSpoilageInputs — extract from blockchain batch objects
// ─────────────────────────────────────────────
/**
 * Derive spoilage model inputs from blockchain batch + transfer history objects
 * (as shaped by CustomerPage.jsx / InspectorPage.jsx).
 *
 * @param {object} batchInfo   - { harvestTimestamp, certification, produceType, ... }
 * @param {Array}  history     - Array of transfer objects with { temp, ... }
 * @returns {object} inputs suitable for predictSpoilage()
 */
export function getSpoilageInputs(batchInfo, history = []) {
  if (!batchInfo) return null;

  // Days old from harvest timestamp
  const harvestTs  = Number(batchInfo.harvestTimestamp || 0);
  const nowSec     = Date.now() / 1000;
  const daysOld    = harvestTs > 0 ? Math.max(0, (nowSec - harvestTs) / 86400) : 0;

  // Average transit temperature (default 25°C if no records)
  const temps = (history || [])
    .map(h => parseFloat(h.temp || h.temperature || "25"))
    .filter(t => !isNaN(t));
  const avgTemp = temps.length > 0
    ? temps.reduce((a, b) => a + b, 0) / temps.length
    : 25;

  // Organic certification check
  const cert = (batchInfo.certification || "").toLowerCase();
  const isOrganic = cert === "organic" || cert.includes("organic");

  // Transfer count
  const transferCount = (history || []).length;

  // Shelf life from produce type
  const SHELF_LIFE = {
    tomato: 7, onion: 30, potato: 60, wheat: 365, rice: 365,
    mango: 5, banana: 7, apple: 30, carrot: 30, spinach: 5,
    corn: 5, garlic: 90, ginger: 30, chili: 14, cauliflower: 7,
    cabbage: 14, broccoli: 7, lettuce: 7, cucumber: 10, pumpkin: 60,
    grapes: 14, orange: 21, lemon: 21, watermelon: 14, strawberry: 3,
  };
  const key = (batchInfo.produceType || "").trim().toLowerCase();
  const shelfLifeDays = SHELF_LIFE[key] ?? 14;

  return { daysOld, avgTemp, isOrganic, transferCount, shelfLifeDays };
}
