import { useState, useEffect, useRef } from "react";
import { ethers }         from "ethers";
import PriceOracleABI     from "../utils/PriceOracle.json";
import { ORACLE_ADDRESS } from "../utils/addresses";
import { CROP_PRICES }    from "../utils/shelfLife";

const PROVIDER_URL = "https://ethereum-sepolia-rpc.publicnode.com";

// ── Static baseline prices (from shelfLife.js CROP_PRICES) ───────────────────
const CROPS = [
  { key: "Wheat",   emoji: "🌾", base: CROP_PRICES.wheat   || 22  },
  { key: "Rice",    emoji: "🌾", base: CROP_PRICES.rice    || 35  },
  { key: "Tomato",  emoji: "🍅", base: CROP_PRICES.tomato  || 25  },
  { key: "Onion",   emoji: "🧅", base: CROP_PRICES.onion   || 18  },
  { key: "Potato",  emoji: "🥔", base: CROP_PRICES.potato  || 15  },
  { key: "Mango",   emoji: "🥭", base: CROP_PRICES.mango   || 60  },
  { key: "Banana",  emoji: "🍌", base: CROP_PRICES.banana  || 30  },
  { key: "Apple",   emoji: "🍎", base: CROP_PRICES.apple   || 80  },
  { key: "Garlic",  emoji: "🧄", base: CROP_PRICES.garlic  || 120 },
  { key: "Ginger",  emoji: "🫚", base: CROP_PRICES.ginger  || 80  },
];

function isDeployed(addr) {
  return addr && addr !== "" && addr !== "0x0" && addr !== "0x0000000000000000000000000000000000000000";
}

// ─────────────────────────────────────────────────────────────────────────────
// Single scrolling ticker item
// ─────────────────────────────────────────────────────────────────────────────
function TickerItem({ crop, price, isLive, isDark }) {
  const base       = crop.base;
  const diff       = price - base;
  const isUp       = diff > 0;
  const isDown     = diff < 0;
  const arrowColor = isUp ? "#4ade80" : isDown ? "#f87171" : "#94a3b8";
  const arrow      = isUp ? "▲" : isDown ? "▼" : "─";

  return (
    <span style={{
      display:     "inline-flex", alignItems: "center", gap: 5,
      padding:     "0 22px",
      borderRight: `1px solid ${isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)"}`,
      whiteSpace:  "nowrap",
    }}>
      <span style={{ fontSize: 14 }}>{crop.emoji}</span>
      <span style={{
        fontWeight: 700, fontSize: 12,
        color: isDark ? "#e2e8f0" : "#1e293b",
      }}>
        {crop.key}
      </span>
      <span style={{ fontSize: 12, color: isDark ? "#94a3b8" : "#475569" }}>
        ₹{price}/kg
      </span>
      <span style={{ fontSize: 10, color: arrowColor, fontWeight: 800 }}>
        {arrow}
        {isLive && Math.abs(diff) > 0 && (
          <span style={{ marginLeft: 2 }}>
            {Math.abs(diff).toFixed(0)}
          </span>
        )}
      </span>
      {!isLive && (
        <span style={{
          fontSize: 9, color: "#94a3b8",
          fontStyle: "italic",
        }}>(est)</span>
      )}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PriceTicker
// ─────────────────────────────────────────────────────────────────────────────
/**
 * PriceTicker
 * @param {{ compact?: boolean }} props
 */
export default function PriceTicker({ compact }) {
  const isDark  = document.body.classList.contains("dark");
  const [prices, setPrices]   = useState(
    CROPS.reduce((acc, c) => ({ ...acc, [c.key]: c.base }), {})
  );
  const [isLive,  setIsLive]  = useState(false);
  const [lastUp,  setLastUp]  = useState(null);
  const intervalRef           = useRef(null);
  const deployed              = isDeployed(ORACLE_ADDRESS);

  // ── Fetch oracle prices ─────────────────────────────────────────────────
  async function fetchPrices() {
    if (!deployed) return;
    try {
      const provider = new ethers.JsonRpcProvider(PROVIDER_URL);
      const oracle   = new ethers.Contract(ORACLE_ADDRESS, PriceOracleABI.abi, provider);
      const allData  = await oracle.getAllPrices();
      if (!allData || allData.length === 0) return;

      const updated = { ...prices };
      allData.forEach(row => {
        const name  = row.crop; // e.g. "Wheat"
        const paise = Number(row.priceInPaise);
        const inr   = paise / 100;
        if (inr > 0) updated[name] = inr;
      });
      setPrices(updated);
      setIsLive(true);
      setLastUp(new Date().toLocaleTimeString());
    } catch (err) {
      // Oracle call failed — keep static prices
      console.warn("[PriceTicker] oracle fetch failed:", err.message);
    }
  }

  useEffect(() => {
    fetchPrices();
    if (deployed) {
      intervalRef.current = setInterval(fetchPrices, 30_000);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []); // eslint-disable-line

  // ── Scroll animation: duplicate items so it loops seamlessly ─────────────
  const items = [...CROPS, ...CROPS]; // duplicate for infinite scroll effect

  const stripHeight = compact ? 34 : 42;
  const stripStyle  = {
    width:      "100%",
    height:     `${stripHeight}px`,
    background: isDark
      ? "linear-gradient(90deg, #0d1f0e 0%, #0f2d14 50%, #0d1f0e 100%)"
      : "linear-gradient(90deg, #1a6b3a 0%, #1f7d44 50%, #1a6b3a 100%)",
    display:    "flex", alignItems: "center",
    overflow:   "hidden",
    position:   "relative",
    borderBottom: `1px solid ${isDark ? "rgba(74,222,128,0.15)" : "rgba(255,255,255,0.15)"}`,
  };

  const labelStyle = {
    flexShrink:  0,
    padding:     "0 16px 0 14px",
    borderRight: `1px solid ${isDark ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.25)"}`,
    fontSize:    11, fontWeight: 800,
    color:       isDark ? "#4ade80" : "rgba(255,255,255,0.9)",
    letterSpacing: "0.06em",
    whiteSpace:  "nowrap",
    display:     "flex", alignItems: "center", gap: 5,
  };

  const tickerDuration = `${CROPS.length * 3.5}s`;

  return (
    <>
      <style>{`
        @keyframes tickerScroll {
          0%   { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
      `}</style>

      <div style={stripStyle}>
        {/* Left label */}
        <div style={labelStyle}>
          <span style={{ fontSize: compact ? 12 : 14 }}>⛓️</span>
          <span>{isLive ? "Live Oracle" : "Local Rates"}</span>
        </div>

        {/* Scrolling track */}
        <div style={{ flex: 1, overflow: "hidden", position: "relative" }}>
          <div style={{
            display:   "inline-flex", alignItems: "center",
            animation: `tickerScroll ${tickerDuration} linear infinite`,
            whiteSpace: "nowrap",
          }}>
            {items.map((crop, i) => (
              <TickerItem
                key={`${crop.key}-${i}`}
                crop={crop}
                price={prices[crop.key] ?? crop.base}
                isLive={isLive}
                isDark={isDark}
              />
            ))}
          </div>
        </div>

        {/* Right: last updated */}
        {!compact && isLive && lastUp && (
          <div style={{
            flexShrink: 0, padding: "0 12px",
            fontSize: 9, color: isDark ? "#4ade8077" : "rgba(255,255,255,0.5)",
            fontStyle: "italic", whiteSpace: "nowrap",
          }}>
            ↻ {lastUp}
          </div>
        )}
      </div>
    </>
  );
}
