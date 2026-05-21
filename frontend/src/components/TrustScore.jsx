/**
 * TrustScore — Circular badge computing 0-100 blockchain trust score.
 * Factors: has cert, grade, transfer count, freshness, certification type.
 */
export function computeTrustScore({ cert, transferCount = 0, harvestTimestamp, certification = "None" }) {
  let score = 0;

  // Certificate exists: +35 pts
  if (cert) {
    score += 35;
    // Grade bonus
    if (cert.grade === "A") score += 25;
    else if (cert.grade === "B") score += 15;
    else if (cert.grade === "C") score += 5;
    // Passed bonus
    if (cert.passed) score += 10;
  }

  // Transfer chain integrity (up to 15 pts)
  score += Math.min(15, transferCount * 5);

  // Certification type (up to 10 pts)
  if (certification === "Organic" || certification === "GlobalGAP") score += 10;
  else if (certification === "APEDA" || certification === "FSSAI") score += 6;
  else if (certification !== "None") score += 3;

  // Freshness (up to 5 pts)
  if (harvestTimestamp) {
    const ageHours = (Date.now() - Number(harvestTimestamp) * 1000) / 3600000;
    if (ageHours < 24) score += 5;
    else if (ageHours < 72) score += 3;
    else if (ageHours < 168) score += 1;
  }

  return Math.min(100, Math.max(0, score));
}

export function getTrustLabel(score) {
  if (score >= 85) return { label: "Excellent", color: "#065f46", bg: "#d1fae5" };
  if (score >= 65) return { label: "Good",      color: "#1e40af", bg: "#dbeafe" };
  if (score >= 45) return { label: "Fair",      color: "#92400e", bg: "#fef3c7" };
  return             { label: "Low",       color: "#991b1b", bg: "#fee2e2" };
}

/**
 * TrustScore visual component — large circular badge.
 */
export default function TrustScore({ score }) {
  const { label, color, bg } = getTrustLabel(score);
  const R = 44, C = 2 * Math.PI * R;
  const offset = C - (score / 100) * C;

  return (
    <div style={{ textAlign: "center" }}>
      <div style={{ position: "relative", display: "inline-block" }}>
        <svg width={110} height={110} viewBox="0 0 110 110">
          {/* Track */}
          <circle cx={55} cy={55} r={R} fill="none" stroke="#e5e1d8" strokeWidth={10} />
          {/* Progress */}
          <circle
            cx={55} cy={55} r={R} fill="none"
            stroke={color} strokeWidth={10}
            strokeDasharray={C} strokeDashoffset={offset}
            strokeLinecap="round"
            transform="rotate(-90 55 55)"
            style={{ transition: "stroke-dashoffset 1.5s cubic-bezier(0.34,1.56,0.64,1)" }}
          />
          {/* Score text */}
          <text x={55} y={50} textAnchor="middle" fontSize={22} fontWeight={800} fill={color}>{score}</text>
          <text x={55} y={65} textAnchor="middle" fontSize={10} fill="#9ca3af">/100</text>
        </svg>
      </div>
      <div style={{
        marginTop: 8, display: "inline-block",
        padding: "4px 14px", borderRadius: "20px",
        background: bg, color, fontWeight: 700, fontSize: "13px",
      }}>
        {label} Trust
      </div>
    </div>
  );
}
