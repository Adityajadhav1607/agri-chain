import { useState, useEffect, useRef } from "react";
import { predictSpoilage, getSpoilageInputs } from "../utils/spoilageModel";

// ─────────────────────────────────────────────────────────────────────────────
// Animated SVG Gauge
// ─────────────────────────────────────────────────────────────────────────────
const RADIUS       = 70;
const STROKE_WIDTH = 12;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

function RiskGauge({ risk, animated }) {
  const isDark   = document.body.classList.contains("dark");
  const percent  = Math.round(risk * 100);

  // Color interpolation: 0% = green, 50% = yellow, 100% = red
  function riskColor(r) {
    if (r < 0.25)  return "#22c55e";
    if (r < 0.5)   return "#eab308";
    if (r < 0.75)  return "#f97316";
    return "#ef4444";
  }
  const color  = riskColor(risk);
  const offset = animated
    ? CIRCUMFERENCE * (1 - risk)
    : CIRCUMFERENCE;

  const SIZE = (RADIUS + STROKE_WIDTH) * 2;

  return (
    <svg
      width={SIZE}
      height={SIZE}
      style={{ display: "block", margin: "0 auto", overflow: "visible" }}
    >
      <defs>
        <radialGradient id="gaugeGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%"   stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0"    />
        </radialGradient>
        <filter id="glow">
          <feGaussianBlur stdDeviation="3" result="coloredBlur" />
          <feMerge>
            <feMergeNode in="coloredBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Glow halo */}
      <circle
        cx={SIZE / 2} cy={SIZE / 2} r={RADIUS + 8}
        fill="url(#gaugeGlow)"
      />

      {/* Background track */}
      <circle
        cx={SIZE / 2} cy={SIZE / 2} r={RADIUS}
        fill="none"
        stroke={isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.07)"}
        strokeWidth={STROKE_WIDTH}
      />

      {/* Animated progress arc */}
      <circle
        cx={SIZE / 2} cy={SIZE / 2} r={RADIUS}
        fill="none"
        stroke={color}
        strokeWidth={STROKE_WIDTH}
        strokeLinecap="round"
        strokeDasharray={CIRCUMFERENCE}
        strokeDashoffset={offset}
        transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
        filter="url(#glow)"
        style={{
          transition: animated ? "stroke-dashoffset 1.2s cubic-bezier(0.34,1.56,0.64,1)" : "none",
        }}
      />

      {/* Center text */}
      <text
        x={SIZE / 2} y={SIZE / 2 - 6}
        textAnchor="middle" dominantBaseline="middle"
        fontSize="26" fontWeight="800" fill={color}
        style={{ fontFamily: "'Inter', sans-serif" }}
      >
        {percent}%
      </text>
      <text
        x={SIZE / 2} y={SIZE / 2 + 18}
        textAnchor="middle" dominantBaseline="middle"
        fontSize="10" fontWeight="500"
        fill={isDark ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.4)"}
        style={{ fontFamily: "'Inter', sans-serif", letterSpacing: "0.08em", textTransform: "uppercase" }}
      >
        SPOILAGE RISK
      </text>
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Factor Bar
// ─────────────────────────────────────────────────────────────────────────────
function FactorBar({ factor, animDelay }) {
  const isDark = document.body.classList.contains("dark");
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const t = setTimeout(() => {
      // Scale factor impact (0–1) to 0–100%
      const pct = Math.min(100, Math.round(factor.impact * 300));
      setWidth(pct);
    }, animDelay);
    return () => clearTimeout(t);
  }, [factor.impact, animDelay]);

  const dirColor =
    factor.direction === "down"
      ? "#22c55e"
      : factor.direction === "up"
      ? "#ef4444"
      : "#6b7280";

  const barColor =
    factor.direction === "down" ? "#22c55e" :
    factor.direction === "up"   ? "#ef4444" : "#94a3b8";

  const arrow =
    factor.direction === "down" ? "↓" :
    factor.direction === "up"   ? "↑" : "→";

  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        marginBottom: 5,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{
            fontSize: 11, fontWeight: 700, color: dirColor,
            width: 14, textAlign: "center",
          }}>{arrow}</span>
          <span style={{
            fontSize: 12, fontWeight: 600,
            color: isDark ? "#e2e8f0" : "#1e293b",
          }}>{factor.name}</span>
        </div>
        <span style={{
          fontSize: 11, color: isDark ? "#94a3b8" : "#64748b",
          fontStyle: "italic",
        }}>{factor.value}</span>
      </div>
      <div style={{
        height: 6, borderRadius: 99,
        background: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)",
        overflow: "hidden",
      }}>
        <div style={{
          height: "100%", width: `${width}%`, borderRadius: 99,
          background: barColor,
          transition: "width 0.8s cubic-bezier(0.34,1.56,0.64,1)",
          boxShadow: `0 0 8px ${barColor}60`,
        }} />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Loading Dots
// ─────────────────────────────────────────────────────────────────────────────
function LoadingDots() {
  const [dots, setDots] = useState(1);
  useEffect(() => {
    const t = setInterval(() => setDots(d => (d % 3) + 1), 400);
    return () => clearInterval(t);
  }, []);
  return (
    <div style={{ textAlign: "center", padding: "40px 20px" }}>
      <div style={{ fontSize: 32, marginBottom: 12 }}>🤖</div>
      <div style={{ fontSize: 14, color: "#6b7280", fontWeight: 500 }}>
        Running neural inference{".".repeat(dots)}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────
/**
 * SpoilagePredictor
 * @param {object} props
 * @param {object} props.batchInfo - batch data from CustomerPage / InspectorPage
 * @param {Array}  props.history   - transfer history array
 * @param {object} [props.cert]    - quality certificate (optional)
 */
export default function SpoilagePredictor({ batchInfo, history, cert }) {
  const isDark   = document.body.classList.contains("dark");
  const [result, setResult]       = useState(null);
  const [loading, setLoading]     = useState(true);
  const [animated, setAnimated]   = useState(false);
  const [visible, setVisible]     = useState(false);
  const prevBatchRef              = useRef(null);

  useEffect(() => {
    if (!batchInfo) { setLoading(false); return; }

    // Only re-run if batchInfo changed
    const key = batchInfo.harvestTimestamp + (batchInfo.produceType || "");
    if (prevBatchRef.current === key && result) return;
    prevBatchRef.current = key;

    setLoading(true);
    setAnimated(false);
    setVisible(false);

    const delay = setTimeout(() => {
      try {
        const inputs = getSpoilageInputs(batchInfo, history || []);
        const prediction = predictSpoilage(inputs);
        setResult(prediction);
      } catch (err) {
        console.error("[SpoilagePredictor]", err);
        setResult(null);
      } finally {
        setLoading(false);
        requestAnimationFrame(() => {
          setVisible(true);
          setTimeout(() => setAnimated(true), 50);
        });
      }
    }, 200);

    return () => clearTimeout(delay);
  }, [batchInfo, history]); // eslint-disable-line

  if (!batchInfo) return null;

  // ── Gradient header colors ────────────────────────────────────────────────
  const headerGrad = result
    ? `linear-gradient(135deg, ${result.color}22 0%, #1a6b3a18 100%)`
    : "linear-gradient(135deg, #1a6b3a18 0%, #4caf7218 100%)";

  const cardStyle = {
    borderRadius: 20,
    overflow: "hidden",
    background: isDark
      ? "rgba(15, 23, 42, 0.9)"
      : "rgba(255, 255, 255, 0.95)",
    border: `1px solid ${isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.07)"}`,
    boxShadow: isDark
      ? "0 8px 40px rgba(0,0,0,0.5), 0 2px 8px rgba(0,0,0,0.3)"
      : "0 8px 40px rgba(0,0,0,0.10), 0 2px 8px rgba(0,0,0,0.05)",
    marginBottom: 24,
    opacity:    visible ? 1 : 0,
    transform:  visible ? "translateY(0)" : "translateY(16px)",
    transition: "opacity 0.5s ease, transform 0.5s ease",
  };

  return (
    <>
      <style>{`
        @keyframes shimmerPulse {
          0%,100% { opacity: 0.7; }
          50%      { opacity: 1; }
        }
        @keyframes spinBadge {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        @keyframes glowPulse {
          0%,100% { box-shadow: 0 0 0 0 rgba(74,222,128,0.0); }
          50%      { box-shadow: 0 0 18px 6px rgba(74,222,128,0.18); }
        }
      `}</style>

      <div style={cardStyle}>
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div style={{
          background: headerGrad,
          borderBottom: `1px solid ${isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.05)"}`,
          padding: "18px 22px",
          display: "flex", justifyContent: "space-between", alignItems: "center",
        }}>
          <div>
            <div style={{
              fontSize: 17, fontWeight: 800,
              color: isDark ? "#f1f5f9" : "#0f172a",
              letterSpacing: "-0.02em",
            }}>
              🤖 AI Spoilage Prediction
            </div>
            <div style={{
              fontSize: 11, marginTop: 3,
              color: isDark ? "#94a3b8" : "#64748b",
              fontStyle: "italic",
            }}>
              Analyzed using real ML inference — not a lookup table
            </div>
          </div>
          {result && (
            <div style={{
              padding: "4px 12px", borderRadius: 99,
              background: result.bgColor, color: result.color,
              fontSize: 11, fontWeight: 800,
              border: `1px solid ${result.color}30`,
              letterSpacing: "0.06em",
              whiteSpace: "nowrap",
            }}>
              {result.emoji} {result.label}
            </div>
          )}
        </div>

        {/* ── Body ───────────────────────────────────────────────────────── */}
        <div style={{ padding: "24px 22px" }}>
          {loading ? (
            <LoadingDots />
          ) : !result ? (
            <div style={{ textAlign: "center", color: "#6b7280", padding: "24px" }}>
              Unable to compute prediction. Insufficient data.
            </div>
          ) : (
            <>
              {/* ── Gauge + Label ─────────────────────────────── */}
              <div style={{ textAlign: "center", marginBottom: 28 }}>
                <RiskGauge risk={result.risk} animated={animated} />

                <div style={{
                  marginTop: 16,
                  fontSize: 22, fontWeight: 900,
                  color: isDark ? "#f1f5f9" : "#0f172a",
                  letterSpacing: "-0.02em",
                }}>
                  {result.emoji} {result.label}
                </div>
                <div style={{
                  marginTop: 6, fontSize: 13,
                  color: isDark ? "#94a3b8" : "#64748b",
                }}>
                  Spoilage probability:&nbsp;
                  <strong style={{ color: result.color, fontSize: 15 }}>
                    {result.percent}%
                  </strong>
                </div>

                {/* Confidence meter */}
                <div style={{ margin: "14px auto 0", maxWidth: 240 }}>
                  <div style={{
                    height: 8, borderRadius: 99,
                    background: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)",
                    overflow: "hidden",
                  }}>
                    <div style={{
                      height: "100%",
                      width: animated ? `${result.percent}%` : "0%",
                      borderRadius: 99,
                      background: `linear-gradient(90deg, #22c55e, ${result.color})`,
                      transition: "width 1.2s cubic-bezier(0.34,1.56,0.64,1)",
                      boxShadow: `0 0 10px ${result.color}60`,
                    }} />
                  </div>
                </div>
              </div>

              {/* ── Factor Breakdown ──────────────────────────── */}
              <div style={{
                background: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.025)",
                border: `1px solid ${isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.06)"}`,
                borderRadius: 14, padding: "18px 18px 10px",
                marginBottom: 18,
              }}>
                <div style={{
                  fontSize: 11, fontWeight: 700, letterSpacing: "0.1em",
                  textTransform: "uppercase", marginBottom: 14,
                  color: isDark ? "#64748b" : "#94a3b8",
                }}>
                  Risk Drivers
                </div>
                {result.factors.map((f, i) => (
                  <FactorBar key={f.name} factor={f} animDelay={200 + i * 120} />
                ))}
              </div>

              {/* ── Cert info ─────────────────────────────────── */}
              {cert && (
                <div style={{
                  display: "flex", gap: 8, flexWrap: "wrap",
                  marginBottom: 16,
                }}>
                  <span style={{
                    padding: "4px 10px", borderRadius: 99, fontSize: 11, fontWeight: 600,
                    background: cert.passed ? "#d1fae5" : "#fee2e2",
                    color:      cert.passed ? "#065f46" : "#991b1b",
                  }}>
                    🏅 Grade {cert.grade} — {cert.passed ? "PASSED" : "REJECTED"}
                  </span>
                  {cert.issuedAt && (
                    <span style={{
                      padding: "4px 10px", borderRadius: 99, fontSize: 11,
                      background: isDark ? "rgba(255,255,255,0.07)" : "#f1f5f9",
                      color: isDark ? "#94a3b8" : "#64748b",
                    }}>
                      Inspected {cert.issuedAt}
                    </span>
                  )}
                </div>
              )}

              {/* ── NN Badge ──────────────────────────────────── */}
              <div style={{
                display: "flex", justifyContent: "center",
                marginTop: 4,
              }}>
                <div style={{
                  display: "inline-flex", alignItems: "center", gap: 6,
                  padding: "5px 14px", borderRadius: 99,
                  background: isDark ? "rgba(74,222,128,0.08)" : "rgba(26,107,58,0.07)",
                  border: "1px solid rgba(74,222,128,0.2)",
                  fontSize: 11, color: "#22c55e", fontWeight: 600,
                  letterSpacing: "0.04em",
                }}>
                  <span style={{
                    display: "inline-block",
                    animation: "spinBadge 3s linear infinite",
                    transformOrigin: "center",
                    fontSize: 13,
                  }}>⚡</span>
                  Powered by Neural Network (4→4→1 architecture)
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
