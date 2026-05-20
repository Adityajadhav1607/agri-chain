import { useState, useEffect, useRef } from "react";
import { subscribe } from "../utils/toast";

const ICONS = {
  success: "✅",
  error:   "❌",
  info:    "ℹ️",
  loading: "⏳",
};

const COLORS = {
  success: { bg: "#e8f5ee", border: "#4caf72", text: "#1a6b3a", bar: "#4caf72" },
  error:   { bg: "#fee2e2", border: "#f87171", text: "#991b1b", bar: "#ef4444" },
  info:    { bg: "#eff6ff", border: "#60a5fa", text: "#1e40af", bar: "#3b82f6" },
  loading: { bg: "#fef9c3", border: "#fbbf24", text: "#92400e", bar: "#f59e0b" },
};

function ToastItem({ toast, onRemove }) {
  const [visible, setVisible]   = useState(false);
  const [leaving, setLeaving]   = useState(false);
  const [progress, setProgress] = useState(100);
  const startRef = useRef(null);
  const rafRef   = useRef(null);

  useEffect(() => {
    // Entrance animation
    requestAnimationFrame(() => setVisible(true));

    if (toast.duration < 99999) {
      startRef.current = Date.now();
      const tick = () => {
        const elapsed = Date.now() - startRef.current;
        const pct     = Math.max(0, 100 - (elapsed / toast.duration) * 100);
        setProgress(pct);
        if (pct > 0) {
          rafRef.current = requestAnimationFrame(tick);
        } else {
          dismiss();
        }
      };
      rafRef.current = requestAnimationFrame(tick);
    }

    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  // eslint-disable-next-line
  }, []);

  function dismiss() {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    setLeaving(true);
    setTimeout(() => onRemove(toast.id), 320);
  }

  const c = COLORS[toast.type] || COLORS.info;

  return (
    <div
      onClick={dismiss}
      style={{
        display:        "flex",
        alignItems:     "flex-start",
        gap:            "12px",
        background:     c.bg,
        border:         `1px solid ${c.border}`,
        borderRadius:   "14px",
        padding:        "14px 16px 10px",
        boxShadow:      "0 8px 32px rgba(0,0,0,0.12)",
        cursor:         "pointer",
        position:       "relative",
        overflow:       "hidden",
        minWidth:       "280px",
        maxWidth:       "380px",
        fontFamily:     "'Inter','Segoe UI',sans-serif",
        transition:     "opacity 0.32s ease, transform 0.32s cubic-bezier(0.4,0,0.2,1)",
        opacity:        leaving ? 0 : (visible ? 1 : 0),
        transform:      leaving ? "translateX(110%)" : (visible ? "translateX(0)" : "translateX(110%)"),
        marginBottom:   "10px",
        userSelect:     "none",
      }}
    >
      {/* Icon */}
      <span style={{ fontSize: "18px", lineHeight: "1.3", flexShrink: 0 }}>
        {ICONS[toast.type]}
      </span>

      {/* Message */}
      <div style={{ flex: 1, fontSize: "13px", lineHeight: "1.55", color: c.text, fontWeight: "500", paddingRight: "8px" }}>
        {toast.msg}
      </div>

      {/* Close X */}
      <button
        onClick={e => { e.stopPropagation(); dismiss(); }}
        style={{ background: "none", border: "none", color: c.text, opacity: 0.5, cursor: "pointer", fontSize: "14px", lineHeight: 1, padding: "0 2px", flexShrink: 0, marginTop: "1px" }}
      >✕</button>

      {/* Progress bar */}
      {toast.duration < 99999 && (
        <div style={{ position: "absolute", bottom: 0, left: 0, height: "3px", background: c.bar, width: `${progress}%`, transition: "width 0.05s linear", borderRadius: "0 0 14px 14px" }} />
      )}
    </div>
  );
}

export default function ToastProvider() {
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    return subscribe(({ id, msg, type, duration, dismiss }) => {
      if (dismiss) {
        setToasts(prev => prev.filter(t => t.id !== id));
      } else {
        setToasts(prev => [...prev.filter(t => t.id !== id), { id, msg, type, duration }]);
      }
    });
  }, []);

  const remove = id => setToasts(prev => prev.filter(t => t.id !== id));

  if (toasts.length === 0) return null;

  return (
    <div style={{
      position:    "fixed",
      top:         "72px",
      right:       "20px",
      zIndex:      9999,
      display:     "flex",
      flexDirection: "column",
      alignItems:  "flex-end",
      pointerEvents: "none",
    }}>
      {toasts.map(t => (
        <div key={t.id} style={{ pointerEvents: "all" }}>
          <ToastItem toast={t} onRemove={remove} />
        </div>
      ))}
    </div>
  );
}
