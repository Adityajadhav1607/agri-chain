import { useState, useEffect } from "react";

/**
 * DarkModeToggle — persists preference in localStorage.
 * Applies .dark class to document.body.
 */
export default function DarkModeToggle() {
  const [dark, setDark] = useState(() => localStorage.getItem("agrichain_dark") === "1");

  useEffect(() => {
    document.body.classList.toggle("dark", dark);
    localStorage.setItem("agrichain_dark", dark ? "1" : "0");
  }, [dark]);

  // Apply on mount
  useEffect(() => {
    if (localStorage.getItem("agrichain_dark") === "1") {
      document.body.classList.add("dark");
    }
  }, []);

  return (
    <button
      onClick={() => setDark(d => !d)}
      title={dark ? "Switch to Light Mode" : "Switch to Dark Mode"}
      style={{
        background: dark ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.18)",
        border: "1px solid rgba(255,255,255,0.25)",
        borderRadius: "8px",
        padding: "6px 12px",
        cursor: "pointer",
        fontSize: "16px",
        lineHeight: 1,
        transition: "all 0.2s",
        display: "flex",
        alignItems: "center",
        gap: "6px",
        color: "white",
        fontFamily: "inherit",
        fontWeight: 500,
      }}
    >
      {dark ? "☀️ Light" : "🌙 Dark"}
    </button>
  );
}
