import { getFreshnessInfo } from "../utils/shelfLife";

/**
 * FreshnessMeter — Circular/linear gauge showing freshness percentage.
 * Uses an SVG arc for the circular variant.
 */
export default function FreshnessMeter({ harvestTimestamp, produceType, variant = "bar" }) {
  const { percent, label, color, bgColor, daysRemaining, daysOld, shelfDays } =
    getFreshnessInfo(harvestTimestamp, produceType);

  if (variant === "circle") {
    const R = 36, C = 2 * Math.PI * R;
    const offset = C - (percent / 100) * C;
    return (
      <div style={{ textAlign: "center" }}>
        <svg width={90} height={90} viewBox="0 0 90 90">
          <circle cx={45} cy={45} r={R} fill="none" stroke="#e5e1d8" strokeWidth={8} />
          <circle
            cx={45} cy={45} r={R} fill="none"
            stroke={color} strokeWidth={8}
            strokeDasharray={C} strokeDashoffset={offset}
            strokeLinecap="round"
            transform="rotate(-90 45 45)"
            style={{ transition: "stroke-dashoffset 1s ease" }}
          />
          <text x={45} y={45} textAnchor="middle" dy="0.35em" fontSize={14} fontWeight={700} fill={color}>
            {percent}%
          </text>
        </svg>
        <div style={{ fontSize: "11px", color, fontWeight: 600, marginTop: 2 }}>{label}</div>
        <div style={{ fontSize: "10px", color: "#9ca3af" }}>{daysRemaining}d left</div>
      </div>
    );
  }

  // Bar variant
  return (
    <div style={{ minWidth: 120 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
        <span style={{ fontSize: "10px", fontWeight: 600, color }}>{label}</span>
        <span style={{ fontSize: "10px", color: "#9ca3af" }}>{percent}%</span>
      </div>
      <div style={{ height: 6, borderRadius: 3, background: "#e5e1d8", overflow: "hidden" }}>
        <div style={{
          height: "100%", borderRadius: 3, background: color,
          width: `${percent}%`, transition: "width 1s ease"
        }} />
      </div>
      <div style={{ fontSize: "9px", color: "#9ca3af", marginTop: 3 }}>
        {daysOld}d old · {daysRemaining}d left of {shelfDays}d shelf life
      </div>
    </div>
  );
}
