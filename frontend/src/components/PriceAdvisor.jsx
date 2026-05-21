import { useState, useEffect, useRef } from "react";
import { ethers }            from "ethers";
import PriceOracleABI        from "../utils/PriceOracle.json";
import { ORACLE_ADDRESS }    from "../utils/addresses";
import { CROP_PRICES, getFreshnessInfo } from "../utils/shelfLife";

const PROVIDER_URL = "https://ethereum-sepolia-rpc.publicnode.com";

const CROP_LIST = [
  { key: "Wheat",  emoji: "🌾" },
  { key: "Rice",   emoji: "🌾" },
  { key: "Tomato", emoji: "🍅" },
  { key: "Onion",  emoji: "🧅" },
  { key: "Potato", emoji: "🥔" },
  { key: "Mango",  emoji: "🥭" },
  { key: "Banana", emoji: "🍌" },
  { key: "Apple",  emoji: "🍎" },
  { key: "Garlic", emoji: "🧄" },
  { key: "Ginger", emoji: "🫚" },
];

function isDeployed(addr) {
  return addr && addr !== "" && addr !== "0x0" &&
    addr !== "0x0000000000000000000000000000000000000000";
}

// ── Sell Recommendation logic ─────────────────────────────────────────────────
function getSellRecommendation(batch, oraclePrice) {
  const info = getFreshnessInfo(
    batch.harvestTimestamp,
    batch.produceType
  );
  const freshPct = info.percent;

  const key      = (batch.produceType || "").trim().toLowerCase();
  const baseline = CROP_PRICES[key] ?? CROP_PRICES.default ?? 20;
  const pctAbove = oraclePrice ? ((oraclePrice - baseline) / baseline) * 100 : 0;

  if (freshPct <= 30) {
    return {
      text:   "⚠️ Sell Immediately",
      color:  "#991b1b",
      bg:     "#fee2e2",
      reason: `Only ${freshPct}% freshness remaining`,
    };
  }
  if (freshPct > 30 && freshPct <= 60 && pctAbove > 10 && oraclePrice) {
    return {
      text:   "✅ Great Time to Sell",
      color:  "#065f46",
      bg:     "#d1fae5",
      reason: `Oracle price is +${pctAbove.toFixed(0)}% above baseline`,
    };
  }
  return {
    text:   "⏳ Hold if Possible",
    color:  "#92400e",
    bg:     "#fef3c7",
    reason: freshPct > 60 ? "Good freshness — prices may rise" : "Price not optimal yet",
  };
}

// ── Animated dot ─────────────────────────────────────────────────────────────
function PulseDot({ color }) {
  return (
    <span style={{
      display: "inline-block", width: 7, height: 7,
      borderRadius: "50%", background: color,
      boxShadow: `0 0 6px ${color}`,
      animation: "pricePulse 1.6s ease infinite",
    }} />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PriceAdvisor
// ─────────────────────────────────────────────────────────────────────────────
/**
 * @param {{ account: string, batches: Array }} props
 */
export default function PriceAdvisor({ account, batches }) {
  const isDark = document.body.classList.contains("dark");

  const [oraclePrices, setOraclePrices] = useState({});
  const [updatedAt,    setUpdatedAt]    = useState({});
  const [isLive,       setIsLive]       = useState(false);
  const [loading,      setLoading]      = useState(false);
  const [error,        setError]        = useState("");
  const intervalRef                     = useRef(null);
  const deployed                        = isDeployed(ORACLE_ADDRESS);

  // Merge static baseline + oracle
  const displayPrices = CROP_LIST.reduce((acc, c) => {
    const key = c.key.toLowerCase();
    acc[c.key] = oraclePrices[c.key] ?? (CROP_PRICES[key] || 20);
    return acc;
  }, {});

  async function fetchPrices() {
    if (!deployed) return;
    setLoading(true);
    setError("");
    try {
      const provider = new ethers.JsonRpcProvider(PROVIDER_URL);
      const oracle   = new ethers.Contract(ORACLE_ADDRESS, PriceOracleABI.abi, provider);
      const allData  = await oracle.getAllPrices();

      const prices = {};
      const times  = {};
      allData.forEach(row => {
        const inr = Number(row.priceInPaise) / 100;
        if (inr > 0) {
          prices[row.crop] = inr;
          times[row.crop]  = Number(row.updatedAt);
        }
      });
      setOraclePrices(prices);
      setUpdatedAt(times);
      setIsLive(true);
    } catch (e) {
      setError("Oracle fetch failed — showing local estimates.");
      console.warn("[PriceAdvisor]", e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchPrices();
    if (deployed) {
      intervalRef.current = setInterval(fetchPrices, 30_000);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, []); // eslint-disable-line

  // ── Common styles ─────────────────────────────────────────────────────────
  const cardStyle = {
    borderRadius: 20, overflow: "hidden",
    background:   isDark ? "rgba(10,20,15,0.95)" : "#fff",
    border:       `1px solid ${isDark ? "rgba(74,222,128,0.12)" : "rgba(0,0,0,0.07)"}`,
    boxShadow:    isDark ? "0 8px 40px rgba(0,0,0,0.5)" : "0 8px 40px rgba(0,0,0,0.07)",
    marginBottom: 24,
  };

  const thStyle = {
    padding:     "10px 14px",
    textAlign:   "left",
    fontSize:    11,
    fontWeight:  700,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    color:       isDark ? "#4ade80" : "#1a6b3a",
    borderBottom: `1px solid ${isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.06)"}`,
    background:   isDark ? "rgba(255,255,255,0.03)" : "#f8fdf9",
    whiteSpace:  "nowrap",
  };

  const tdStyle = {
    padding:     "10px 14px",
    fontSize:    13,
    borderBottom: `1px solid ${isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)"}`,
    color:       isDark ? "#e2e8f0" : "#1e293b",
  };

  function formatUpdatedAt(ts) {
    if (!ts) return "—";
    const d = new Date(ts * 1000);
    const now = Date.now();
    const secAgo = Math.round((now - d.getTime()) / 1000);
    if (secAgo < 60)   return `${secAgo}s ago`;
    if (secAgo < 3600) return `${Math.round(secAgo/60)}m ago`;
    return d.toLocaleTimeString();
  }

  const hasBatches = Array.isArray(batches) && batches.length > 0;

  return (
    <>
      <style>{`
        @keyframes pricePulse {
          0%,100% { opacity: 1; transform: scale(1);   }
          50%      { opacity: 0.6; transform: scale(0.8); }
        }
        @keyframes rowFadeIn {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0);   }
        }
      `}</style>

      <div style={cardStyle}>
        {/* ── Header ──────────────────────────────────────────────────── */}
        <div style={{
          background:    "linear-gradient(135deg, #1a6b3a 0%, #065f46 100%)",
          padding:       "18px 24px",
          display:       "flex", justifyContent: "space-between", alignItems: "center",
        }}>
          <div>
            <div style={{ fontSize: 17, fontWeight: 800, color: "#fff", letterSpacing: "-0.02em" }}>
              📊 Live Market Price Advisor
            </div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.65)", marginTop: 3 }}>
              Powered by on-chain price oracle — updated by AgriChain admin
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {isLive
              ? <><PulseDot color="#4ade80" /><span style={{ fontSize: 11, color: "rgba(255,255,255,0.8)", fontWeight: 600 }}>Live</span></>
              : <span style={{ fontSize: 11, color: "rgba(255,255,255,0.5)" }}>Local Estimates</span>
            }
            <button
              onClick={fetchPrices}
              disabled={loading}
              style={{
                marginLeft: 6, padding: "5px 12px",
                background: "rgba(255,255,255,0.12)",
                border: "1px solid rgba(255,255,255,0.25)",
                borderRadius: 99, cursor: "pointer",
                color: "#fff", fontSize: 11, fontFamily: "inherit",
                opacity: loading ? 0.6 : 1,
              }}
            >
              {loading ? "…" : "↻ Refresh"}
            </button>
          </div>
        </div>

        <div style={{ padding: "20px 24px" }}>
          {/* ── Warning banner if oracle not deployed / error ─────────── */}
          {(!deployed || error) && (
            <div style={{
              marginBottom: 18, padding: "10px 16px", borderRadius: 10,
              background:   "#fef3c7", border: "1px solid #fbbf24",
              color:        "#92400e", fontSize: 12,
              display:      "flex", alignItems: "center", gap: 8,
            }}>
              <span style={{ fontSize: 16 }}>⚠️</span>
              {!deployed
                ? "PriceOracle contract not yet deployed — showing local CROP_PRICES estimates."
                : error}
            </div>
          )}

          {/* ── SECTION A: Market Prices Table ───────────────────────── */}
          <div style={{ marginBottom: hasBatches ? 28 : 0 }}>
            <div style={{
              fontSize: 13, fontWeight: 700, color: isDark ? "#86efac" : "#1a6b3a",
              marginBottom: 12, letterSpacing: "-0.01em",
            }}>
              Section A — Market Prices
            </div>
            <div style={{ overflowX: "auto", borderRadius: 12, border: `1px solid ${isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.06)"}` }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={thStyle}>Crop</th>
                    <th style={{ ...thStyle, textAlign: "right" }}>Oracle Price</th>
                    <th style={{ ...thStyle, textAlign: "right" }}>vs Baseline</th>
                    <th style={{ ...thStyle, textAlign: "right" }}>Last Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {CROP_LIST.map((crop, i) => {
                    const key      = crop.key.toLowerCase();
                    const live     = oraclePrices[crop.key];
                    const baseline = CROP_PRICES[key] || 20;
                    const price    = live ?? baseline;
                    const diff     = live ? live - baseline : 0;
                    const pctDiff  = live ? ((diff / baseline) * 100) : 0;
                    const isUp     = diff > 0;
                    const isDown   = diff < 0;
                    const ts       = updatedAt[crop.key];

                    return (
                      <tr
                        key={crop.key}
                        style={{
                          animation: `rowFadeIn 0.3s ease ${i * 40}ms both`,
                          background: i % 2 === 0
                            ? isDark ? "transparent" : "transparent"
                            : isDark ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.01)",
                        }}
                      >
                        <td style={tdStyle}>
                          <span style={{ marginRight: 8 }}>{crop.emoji}</span>
                          <strong>{crop.key}</strong>
                        </td>
                        <td style={{ ...tdStyle, textAlign: "right" }}>
                          <span style={{
                            display: "inline-flex", alignItems: "center", gap: 6,
                            padding: "2px 10px", borderRadius: 99,
                            background: live
                              ? isDark ? "rgba(74,222,128,0.1)" : "#d1fae5"
                              : isDark ? "rgba(255,255,255,0.05)" : "#f1f5f9",
                            color: live
                              ? isDark ? "#86efac" : "#065f46"
                              : isDark ? "#94a3b8" : "#64748b",
                            fontWeight: 700, fontSize: 13,
                          }}>
                            {live && <PulseDot color={isDark ? "#4ade80" : "#22c55e"} />}
                            ₹{price.toFixed(0)}/kg
                          </span>
                        </td>
                        <td style={{ ...tdStyle, textAlign: "right" }}>
                          {live ? (
                            <span style={{
                              padding: "2px 8px", borderRadius: 99, fontSize: 11,
                              fontWeight: 700,
                              background: isUp ? "#d1fae5" : isDown ? "#fee2e2" : "#f1f5f9",
                              color:      isUp ? "#065f46" : isDown ? "#991b1b" : "#64748b",
                            }}>
                              {isUp ? "▲" : isDown ? "▼" : "─"}
                              {" "}{Math.abs(pctDiff).toFixed(1)}%
                            </span>
                          ) : (
                            <span style={{ fontSize: 11, color: "#94a3b8", fontStyle: "italic" }}>
                              baseline
                            </span>
                          )}
                        </td>
                        <td style={{ ...tdStyle, textAlign: "right", fontSize: 11, color: isDark ? "#64748b" : "#94a3b8" }}>
                          {ts ? formatUpdatedAt(ts) : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* ── SECTION B: Batch Advisor ──────────────────────────────── */}
          {hasBatches && (
            <div>
              <div style={{
                fontSize: 13, fontWeight: 700, color: isDark ? "#86efac" : "#1a6b3a",
                marginBottom: 12,
              }}>
                Section B — Your Batch Advisor
              </div>
              <div style={{ overflowX: "auto", borderRadius: 12, border: `1px solid ${isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.06)"}` }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr>
                      <th style={thStyle}>Batch</th>
                      <th style={thStyle}>Produce</th>
                      <th style={{ ...thStyle, textAlign: "right" }}>Qty (kg)</th>
                      <th style={{ ...thStyle, textAlign: "right" }}>Est. Value</th>
                      <th style={{ ...thStyle, textAlign: "right" }}>Freshness</th>
                      <th style={thStyle}>Recommendation</th>
                    </tr>
                  </thead>
                  <tbody>
                    {batches.map((b, i) => {
                      const key   = (b.produceType || "").trim().toLowerCase();
                      const price = oraclePrices[b.produceType] ?? (CROP_PRICES[key] || 20);
                      const qty   = parseInt(b.quantity || 0);
                      const value = qty * price;
                      const rec   = getSellRecommendation(b, oraclePrices[b.produceType]);
                      const freshInfo = getFreshnessInfo(b.harvestTimestamp, b.produceType);

                      return (
                        <tr
                          key={b.batchId}
                          style={{
                            animation: `rowFadeIn 0.3s ease ${i * 50}ms both`,
                            background: i % 2 === 0
                              ? "transparent"
                              : isDark ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.01)",
                          }}
                        >
                          <td style={tdStyle}>
                            <strong style={{ fontFamily: "monospace" }}>#{b.batchId}</strong>
                          </td>
                          <td style={tdStyle}>{b.produceType}</td>
                          <td style={{ ...tdStyle, textAlign: "right" }}>
                            {qty.toLocaleString()}
                          </td>
                          <td style={{ ...tdStyle, textAlign: "right", fontWeight: 700 }}>
                            ₹{value.toLocaleString()}
                          </td>
                          <td style={{ ...tdStyle, textAlign: "right" }}>
                            <span style={{
                              padding: "2px 8px", borderRadius: 99, fontSize: 11,
                              fontWeight: 700,
                              background: freshInfo.bgColor,
                              color:      freshInfo.color,
                            }}>
                              {freshInfo.percent}%
                            </span>
                          </td>
                          <td style={tdStyle}>
                            <div style={{
                              display: "inline-flex", flexDirection: "column", gap: 2,
                            }}>
                              <span style={{
                                padding:    "3px 10px", borderRadius: 99,
                                background: rec.bg, color: rec.color,
                                fontSize:   11, fontWeight: 700,
                                whiteSpace: "nowrap",
                              }}>
                                {rec.text}
                              </span>
                              <span style={{
                                fontSize: 10, color: isDark ? "#64748b" : "#94a3b8",
                                fontStyle: "italic", paddingLeft: 4,
                              }}>
                                {rec.reason}
                              </span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
