import { useState } from "react";

/**
 * CopyButton — Copies text to clipboard with visual feedback.
 */
export default function CopyButton({ text, label = "" }) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  }

  return (
    <button
      onClick={handleCopy}
      title="Copy to clipboard"
      style={{
        background: copied ? "#d1fae5" : "transparent",
        border: `1px solid ${copied ? "#4caf72" : "#e5e1d8"}`,
        borderRadius: "5px",
        padding: "2px 8px",
        fontSize: "11px",
        cursor: "pointer",
        color: copied ? "#065f46" : "#6b7280",
        transition: "all 0.2s",
        fontFamily: "inherit",
        marginLeft: "4px",
      }}
    >
      {copied ? "✓ Copied" : `⎘ ${label}`}
    </button>
  );
}
