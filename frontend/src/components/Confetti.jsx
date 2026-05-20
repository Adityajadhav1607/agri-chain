import { useEffect, useRef } from "react";

/**
 * Confetti burst animation — fires when `active` becomes true.
 * Uses a Canvas overlay, auto-clears after 3.5 s.
 */
export default function Confetti({ active }) {
  const canvasRef = useRef(null);
  const animRef   = useRef(null);

  useEffect(() => {
    if (!active) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;

    const COLORS = ["#4caf72","#1a6b3a","#ffc73c","#ff8c3b","#60a5fa","#f472b6","#a78bfa","#34d399"];

    const pieces = Array.from({ length: 120 }, () => ({
      x:   Math.random() * canvas.width,
      y:   -12,
      r:   Math.random() * 8 + 3,
      d:   Math.random() * 120 + 60,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      tilt: Math.random() * 20 - 10,
      tiltAngle: 0,
      tiltAngleIncrement: Math.random() * 0.07 + 0.05,
      vx: Math.random() * 3 - 1.5,
      vy: Math.random() * 4 + 2,
      opacity: 1,
      shape: Math.random() > 0.5 ? "rect" : "circle",
      w: Math.random() * 10 + 4,
      h: Math.random() * 6 + 2,
    }));

    let frame = 0;

    function draw() {
      frame++;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      pieces.forEach(p => {
        p.tiltAngle += p.tiltAngleIncrement;
        p.y += p.vy;
        p.x += p.vx;
        p.vy += 0.04; // gravity
        p.opacity -= 0.004;

        if (p.opacity <= 0) return;

        ctx.save();
        ctx.globalAlpha = Math.max(0, p.opacity);
        ctx.fillStyle   = p.color;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.tiltAngle);

        if (p.shape === "circle") {
          ctx.beginPath();
          ctx.arc(0, 0, p.r, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        }
        ctx.restore();
      });

      if (frame < 200 && pieces.some(p => p.opacity > 0)) {
        animRef.current = requestAnimationFrame(draw);
      } else {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    }

    animRef.current = requestAnimationFrame(draw);
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [active]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position:      "fixed",
        inset:         0,
        pointerEvents: "none",
        zIndex:        9998,
      }}
    />
  );
}
