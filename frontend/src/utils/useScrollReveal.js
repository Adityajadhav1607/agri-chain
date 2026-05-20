import { useEffect, useRef, useState } from "react";

/**
 * Returns a [ref, isVisible] pair.
 * The element attached to `ref` will become visible when it scrolls into view.
 * @param {number} threshold - intersection threshold (0–1)
 * @param {boolean} once - if true, only fires once
 */
export function useScrollReveal(threshold = 0.15, once = true) {
  const ref      = useRef(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          if (once) obs.disconnect();
        } else if (!once) {
          setVisible(false);
        }
      },
      { threshold }
    );

    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold, once]);

  return [ref, visible];
}

/**
 * Inline style helper — returns CSS for a fade+slide-up reveal animation.
 * @param {boolean} visible
 * @param {number}  delay  - animation delay in ms
 * @param {string}  direction - "up" | "left" | "right" | "down"
 */
export function revealStyle(visible, delay = 0, direction = "up") {
  const transforms = {
    up:    "translateY(28px)",
    down:  "translateY(-28px)",
    left:  "translateX(-28px)",
    right: "translateX(28px)",
  };

  return {
    opacity:    visible ? 1 : 0,
    transform:  visible ? "none" : (transforms[direction] || transforms.up),
    transition: `opacity 0.65s ease ${delay}ms, transform 0.65s cubic-bezier(0.22,1,0.36,1) ${delay}ms`,
    willChange: "opacity, transform",
  };
}
