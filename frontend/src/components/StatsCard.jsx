/**
 * StatsCard — Animated stat card with icon, value, label.
 */
export default function StatsCard({ icon, value, label, sub, color = "#1a6b3a", accentBg }) {
  return (
    <div className="stat" style={{ borderLeft: `3px solid ${color}`, position: "relative", overflow: "hidden" }}>
      <div style={{
        position: "absolute", top: 10, right: 14, fontSize: "28px", opacity: 0.12,
      }}>{icon}</div>
      <div className="stat-label">{label}</div>
      <div className="stat-value" style={{ color }}>{icon} {value}</div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  );
}
