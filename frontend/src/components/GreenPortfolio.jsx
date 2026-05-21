import { useState, useEffect } from "react";
import { ethers }             from "ethers";
import CarbonCreditABI        from "../utils/CarbonCredit.json";
import { CARBON_CREDIT_ADDRESS } from "../utils/addresses";

// ─── helpers ────────────────────────────────────────────────────────────────
const PROVIDER_URL = "https://ethereum-sepolia-rpc.publicnode.com";

function isDeployed(addr) {
  return addr && addr !== "" && addr !== "0x0" && addr !== "0x0000000000000000000000000000000000000000";
}

function formatDate(unix) {
  if (!unix) return "—";
  return new Date(Number(unix) * 1000).toLocaleDateString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
  });
}

function formatCO2(grams) {
  const g = Number(grams);
  if (g >= 1_000_000) return `${(g / 1_000_000).toFixed(2)} t`;
  if (g >= 1_000)     return `${(g / 1_000).toFixed(1)} kg`;
  return `${g.toLocaleString()} g`;
}

// Trees: 21,000 g CO₂ per tree per year
function treesEquiv(totalGrams) {
  return (Number(totalGrams) / 21_000).toFixed(2);
}

// ─── Animated counter ────────────────────────────────────────────────────────
function AnimatedCounter({ target, suffix = "", duration = 1400 }) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (!target) return;
    const start     = performance.now();
    const tNum      = Number(target);
    const raf = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const ease = 1 - Math.pow(1 - t, 4);
      setVal(Math.round(ease * tNum));
      if (t < 1) requestAnimationFrame(raf);
    };
    requestAnimationFrame(raf);
  }, [target, duration]);
  return <>{val.toLocaleString()}{suffix}</>;
}

// ─── Shimmer card ────────────────────────────────────────────────────────────
function CreditCard({ credit, idx, isDark }) {
  const [hovered, setHovered] = useState(false);

  const cardStyle = {
    position:     "relative",
    borderRadius: 16,
    overflow:     "hidden",
    background:   isDark
      ? "linear-gradient(135deg, #0d2e1a 0%, #0a3320 60%, #0f4a2a 100%)"
      : "linear-gradient(135deg, #d1fae5 0%, #a7f3d0 60%, #6ee7b7 100%)",
    border:       `1px solid ${isDark ? "rgba(74,222,128,0.18)" : "rgba(26,107,58,0.15)"}`,
    padding:      "20px 18px 16px",
    boxShadow:    hovered
      ? isDark
        ? "0 12px 40px rgba(34,197,94,0.22), 0 2px 8px rgba(0,0,0,0.4)"
        : "0 12px 40px rgba(26,107,58,0.20), 0 2px 8px rgba(0,0,0,0.08)"
      : isDark
        ? "0 4px 16px rgba(0,0,0,0.4)"
        : "0 4px 16px rgba(0,0,0,0.07)",
    transform:    hovered ? "translateY(-3px) scale(1.01)" : "translateY(0) scale(1)",
    transition:   "all 0.28s ease",
    cursor:       "default",
    animation:    `fadeCardIn 0.4s ease ${idx * 80}ms both`,
  };

  const co2g = Number(credit.co2Grams);

  return (
    <div
      style={cardStyle}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Shimmer overlay */}
      <div style={{
        position:   "absolute", inset: 0, pointerEvents: "none",
        background: "linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.07) 50%, transparent 60%)",
        backgroundSize: "200% 100%",
        animation:  "shimmerCredit 2.4s ease infinite",
      }} />

      {/* Leaf icon top-right */}
      <div style={{
        position:   "absolute", top: 14, right: 16,
        fontSize:   28, opacity: 0.25,
        userSelect: "none",
      }}>🌿</div>

      {/* Batch + CO2 */}
      <div style={{
        fontSize: 11, fontWeight: 700, letterSpacing: "0.1em",
        textTransform: "uppercase",
        color: isDark ? "#4ade80" : "#065f46",
        marginBottom: 4,
      }}>
        Batch #{credit.batchId?.toString()}
      </div>

      <div style={{
        fontSize: 22, fontWeight: 900, lineHeight: 1.1,
        color: isDark ? "#86efac" : "#064e3b",
        marginBottom: 2,
      }}>
        {formatCO2(co2g)}
      </div>
      <div style={{
        fontSize: 12, fontWeight: 500,
        color: isDark ? "#4ade80" : "#065f46",
        marginBottom: 14,
      }}>
        {co2g >= 1000
          ? `${(co2g / 1000).toFixed(1)} kg CO₂ offset`
          : `${co2g.toLocaleString()} g CO₂ offset`}
      </div>

      {/* Date */}
      <div style={{
        fontSize: 11,
        color: isDark ? "#86efac88" : "#065f4688",
        marginBottom: 10,
      }}>
        Minted {formatDate(credit.issuedAt)}
      </div>

      {/* Badge */}
      <div style={{
        display:      "inline-flex", alignItems: "center", gap: 5,
        background:   isDark ? "rgba(74,222,128,0.12)" : "rgba(26,107,58,0.10)",
        border:       "1px solid rgba(74,222,128,0.3)",
        borderRadius: 99, padding: "3px 10px",
        fontSize:     10, fontWeight: 700, color: "#22c55e",
        letterSpacing: "0.05em",
      }}>
        🌍 Verified On-Chain
      </div>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────
/**
 * GreenPortfolio
 * @param {{ account: string }} props
 */
export default function GreenPortfolio({ account }) {
  const isDark = document.body.classList.contains("dark");

  const [credits,    setCredits]    = useState([]);
  const [totalCO2,   setTotalCO2]   = useState(0);
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState("");
  const [copied,     setCopied]     = useState(false);
  const [glowActive, setGlowActive] = useState(false);

  const deployed = isDeployed(CARBON_CREDIT_ADDRESS);

  useEffect(() => {
    if (!deployed || !account) return;
    loadPortfolio();
  }, [account]); // eslint-disable-line

  // Glow pulse every 3s
  useEffect(() => {
    if (!totalCO2) return;
    const t = setInterval(() => {
      setGlowActive(true);
      setTimeout(() => setGlowActive(false), 800);
    }, 3000);
    return () => clearInterval(t);
  }, [totalCO2]);

  async function loadPortfolio() {
    setLoading(true);
    setError("");
    try {
      const provider = new ethers.JsonRpcProvider(PROVIDER_URL);
      const contract = new ethers.Contract(
        CARBON_CREDIT_ADDRESS, CarbonCreditABI.abi, provider
      );

      const raw = await contract.getCreditsByFarmer(account);
      const mapped = raw.map(c => ({
        batchId:  c.batchId,
        co2Grams: c.co2Grams,
        issuedAt: c.issuedAt,
      }));
      setCredits(mapped);

      const total = await contract.totalCO2(account);
      setTotalCO2(Number(total));
    } catch (e) {
      setError("Failed to load carbon credits. " + (e.message || ""));
      setCredits([]);
      setTotalCO2(0);
    } finally {
      setLoading(false);
    }
  }

  function shareImpact() {
    const kg     = (totalCO2 / 1000).toFixed(1);
    const trees  = treesEquiv(totalCO2);
    const text   =
      `🌿 I've offset ${kg} kg of CO₂ through AgriChain sustainable farming — ` +
      `equivalent to planting ${trees} trees! 🌍 #AgriChain #CarbonNeutral #SustainableAg`;
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  }

  // ── Styles ──────────────────────────────────────────────────────────────────
  const cardStyle = {
    borderRadius: 20, overflow: "hidden",
    background:   isDark ? "rgba(10,20,15,0.95)" : "#fff",
    border:       `1px solid ${isDark ? "rgba(74,222,128,0.14)" : "rgba(26,107,58,0.10)"}`,
    boxShadow:    isDark
      ? "0 8px 40px rgba(0,0,0,0.5)"
      : "0 8px 40px rgba(0,0,0,0.07)",
    marginBottom: 24,
  };

  const totalCO2kg = (totalCO2 / 1000).toFixed(1);

  return (
    <>
      <style>{`
        @keyframes fadeCardIn {
          from { opacity: 0; transform: translateY(14px); }
          to   { opacity: 1; transform: translateY(0);    }
        }
        @keyframes shimmerCredit {
          0%   { background-position: -200% 0; }
          100% { background-position:  200% 0; }
        }
        @keyframes leafGlow {
          0%,100% { box-shadow: 0 0 0   0   rgba(34,197,94,0.0);  }
          50%      { box-shadow: 0 0 40px 12px rgba(34,197,94,0.22); }
        }
        @keyframes spinLeaf {
          0%   { transform: rotate(0deg) scale(1);   }
          50%  { transform: rotate(8deg) scale(1.05);}
          100% { transform: rotate(0deg) scale(1);   }
        }
      `}</style>

      <div style={cardStyle}>
        {/* Header */}
        <div style={{
          background:    "linear-gradient(135deg, #1a6b3a 0%, #065f46 100%)",
          padding:       "20px 24px",
          display:       "flex", justifyContent: "space-between", alignItems: "center",
        }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, color: "#fff", letterSpacing: "-0.02em" }}>
              🌿 Your Carbon Credit Portfolio
            </div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.65)", marginTop: 3 }}>
              On-chain CO₂ offset certificates — earned through sustainable farming
            </div>
          </div>
          {deployed && totalCO2 > 0 && (
            <button
              onClick={shareImpact}
              style={{
                padding:      "8px 16px", borderRadius: 99, cursor: "pointer",
                background:   copied ? "#22c55e" : "rgba(255,255,255,0.15)",
                border:       "1px solid rgba(255,255,255,0.3)",
                color:        "#fff", fontSize: 12, fontWeight: 700,
                fontFamily:   "inherit",
                transition:   "all 0.2s",
                whiteSpace:   "nowrap",
              }}
            >
              {copied ? "✅ Copied!" : "📤 Share My Impact"}
            </button>
          )}
        </div>

        <div style={{ padding: "24px" }}>
          {/* Not deployed */}
          {!deployed ? (
            <div style={{
              textAlign: "center", padding: "36px 24px",
              border:    "2px dashed rgba(26,107,58,0.2)", borderRadius: 14,
              color:     isDark ? "#4ade80" : "#1a6b3a",
            }}>
              <div style={{ fontSize: 36, marginBottom: 12 }}>🌱</div>
              <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>
                Contract Not Yet Deployed
              </div>
              <div style={{ fontSize: 13, color: isDark ? "#6b7280" : "#9ca3af" }}>
                Carbon Credit contract not yet deployed — run the deploy script!
              </div>
              <code style={{
                display: "block", marginTop: 16, padding: "8px 14px",
                background: isDark ? "rgba(255,255,255,0.06)" : "#f1f5f9",
                borderRadius: 8, fontSize: 12, color: "#64748b",
              }}>
                npx hardhat run scripts/deploy.js --network sepolia
              </code>
            </div>
          ) : loading ? (
            <div style={{ textAlign: "center", padding: "32px", color: "#6b7280" }}>
              <div style={{ fontSize: 28, marginBottom: 10, animation: "spinLeaf 1.5s ease infinite" }}>🌿</div>
              Loading your green portfolio...
            </div>
          ) : error ? (
            <div style={{
              padding: "16px", borderRadius: 12,
              background: "#fee2e2", color: "#991b1b", fontSize: 13,
            }}>
              ⚠️ {error}
              <button onClick={loadPortfolio} style={{
                marginLeft: 12, padding: "3px 10px",
                background: "transparent", border: "1px solid #991b1b",
                borderRadius: 99, cursor: "pointer", color: "#991b1b", fontSize: 12,
                fontFamily: "inherit",
              }}>Retry</button>
            </div>
          ) : (
            <>
              {/* ── Total Stats Banner ──────────────────────────────────── */}
              {totalCO2 > 0 && (
                <div style={{
                  background:   isDark
                    ? "linear-gradient(135deg, #0d2e1a, #0a3320)"
                    : "linear-gradient(135deg, #d1fae5, #a7f3d0)",
                  borderRadius: 16, padding: "20px 24px", marginBottom: 24,
                  border:       `1px solid ${isDark ? "rgba(74,222,128,0.2)" : "rgba(26,107,58,0.15)"}`,
                  boxShadow:    glowActive ? "0 0 40px 10px rgba(34,197,94,0.18)" : "none",
                  transition:   "box-shadow 0.4s ease",
                }}>
                  <div style={{
                    display: "grid", gridTemplateColumns: "repeat(3, 1fr)",
                    gap: 16, textAlign: "center",
                  }}>
                    {[
                      { label: "Total CO₂ Offset", value: <><AnimatedCounter target={totalCO2} /> g</>, sub: `${totalCO2kg} kg` },
                      { label: "Carbon Credits",    value: <><AnimatedCounter target={credits.length} /></>, sub: "NFT certificates" },
                      { label: "Trees Equivalent",  value: <><AnimatedCounter target={Math.round(totalCO2 / 21000)} /></>, sub: "trees/year offset" },
                    ].map(({ label, value, sub }) => (
                      <div key={label}>
                        <div style={{
                          fontSize: 22, fontWeight: 900,
                          color: isDark ? "#86efac" : "#065f46",
                        }}>{value}</div>
                        <div style={{
                          fontSize: 11, fontWeight: 600, marginTop: 2,
                          color: isDark ? "#4ade80" : "#1a6b3a",
                          textTransform: "uppercase", letterSpacing: "0.07em",
                        }}>{label}</div>
                        <div style={{ fontSize: 10, color: isDark ? "#4ade8088" : "#06503888", marginTop: 1 }}>{sub}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ── Credit Cards Grid ───────────────────────────────────── */}
              {credits.length === 0 ? (
                <div style={{
                  textAlign: "center", padding: "40px 24px",
                  color: isDark ? "#6b7280" : "#9ca3af",
                }}>
                  <div style={{ fontSize: 36, marginBottom: 12 }}>🌱</div>
                  <div style={{ fontWeight: 600, marginBottom: 6, fontSize: 15 }}>
                    No carbon credits yet.
                  </div>
                  <div style={{ fontSize: 13 }}>
                    Register an Organic batch and get it graded A or B to earn your first credit!
                  </div>
                </div>
              ) : (
                <div style={{
                  display:             "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
                  gap:                 16,
                }}>
                  {credits.map((c, i) => (
                    <CreditCard
                      key={`${c.batchId}-${i}`}
                      credit={c}
                      idx={i}
                      isDark={isDark}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}
