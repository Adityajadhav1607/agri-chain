import { getFreshnessInfo } from "../utils/shelfLife";

/**
 * BatchAgeTag — Shows color-coded freshness badge based on harvest timestamp.
 * @param {number} harvestTimestamp - Unix timestamp in seconds
 * @param {string} produceType
 */
export default function BatchAgeTag({ harvestTimestamp, produceType }) {
  if (!harvestTimestamp) return <span style={{ color: "#9ca3af", fontSize: "11px" }}>—</span>;
  const { label, color, bgColor, daysOld, daysRemaining } = getFreshnessInfo(harvestTimestamp, produceType);

  return (
    <span
      title={`${daysOld} days old · ${daysRemaining} days remaining`}
      style={{
        display: "inline-block",
        padding: "2px 8px",
        borderRadius: "12px",
        fontSize: "10px",
        fontWeight: 600,
        background: bgColor,
        color,
        border: `1px solid ${color}33`,
        whiteSpace: "nowrap",
      }}
    >
      {label} · {daysOld}d
    </span>
  );
}
