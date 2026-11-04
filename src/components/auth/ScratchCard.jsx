"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

const REVEAL_AT = 0.5; // fraction scratched before the rest clears itself
const BRUSH_RADIUS = 22;
const GRID = 20; // coverage tracked on a 20x20 grid -- no getImageData per stroke
const TILE = 28; // the foil is ruled into "tiles", px
const SPARK_COLORS = ["#ffd9c4", "#ffffff", "#f59a6b", "#fbe4d9"];

// The ticket's perforation line, and the two half-circle notches punched at it (lucira's ticket).
const PERF = "42%";
const NOTCH_MASK =
  `radial-gradient(circle at 0 ${PERF}, transparent 11px, #000 11.5px) left / 51% 100% no-repeat,` +
  `radial-gradient(circle at 100% ${PERF}, transparent 11px, #000 11.5px) right / 51% 100% no-repeat`;

const amountOf = (label) => Number(String(label || "").replace(/[^\d]/g, "")) || 0;

function useCountUp(target, run) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!run) return;
    let raf;
    const start = performance.now();
    const tick = (now) => {
      const t = Math.min(1, (now - start) / 900);
      setValue(Math.round(target * (1 - Math.pow(1 - t, 3))));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, run]);
  return run ? value : target;
}

/** What is under the foil: the reward as a ticket, wordmark stub on top. */
function Ticket({ prize, countUp }) {
  const reduce = useReducedMotion();
  const shown = useCountUp(amountOf(prize.label), countUp && !reduce);
  return (
    <div
      className="relative flex h-full w-full select-none flex-col overflow-hidden rounded-xl"
      style={{ WebkitMask: NOTCH_MASK, mask: NOTCH_MASK }}
    >
      <div className="flex items-center justify-center bg-ink" style={{ flex: `0 0 ${PERF}` }}>
        <span className="font-display text-lg font-bold uppercase leading-none tracking-[-0.02em] text-action">
          Texture House
        </span>
      </div>
      <div className="absolute inset-x-4 border-t-2 border-dashed border-line-strong" style={{ top: PERF }} />
      <div className="flex flex-1 flex-col items-center justify-center bg-surface px-3 text-center">
        <p className="text-sm text-subtle">You won</p>
        <p className="num mt-1 font-display text-[32px] font-bold leading-none text-ink">₹{shown} OFF</p>
        <p className="mt-1.5 text-xs text-subtle">on your first order</p>
      </div>
    </div>
  );
}

/**
 * The signup reward, as a scratch card. Look and feel ported from the jewelry build's scratch
 * ticket (lucira-frontend components/auth/scratch): notched ticket, shimmer on the foil, an animated
 * "scratch here" hand, sparks under the finger, a buzz as it clears, the amount counting up. The
 * foil is ruled into tiles instead of Lucira's photo, so there is no CDN image to wait on (or to
 * need CORS for).
 *
 * WHY NOT A WHEEL. Every Indian phone user has been trained by GPay, PhonePe and Paytm to scratch a
 * card after a transaction, so the gesture needs no explaining -- and it reads as a reward already
 * earned rather than a gamble being offered.
 *
 * IT DOES NOT DECIDE ANYTHING. The prize arrives from the server with the created account (see the
 * backend's lib/prizes.js). Scratching only uncovers what is already decided.
 *
 * TEASER MODE (no `prize`) draws an unscratchable card printed with the range -- a covered card shows
 * nothing, so the range has to be in print or the offer loses its number before anyone commits.
 */
export default function ScratchCard({ prize = null, onRevealed, className = "" }) {
  const reduce = useReducedMotion();
  const wrapRef = useRef(null);
  const canvasRef = useRef(null);
  const s = useRef({
    ctx: null, w: 0, h: 0, drawing: false, last: null, scratched: false, done: false,
    cells: new Uint8Array(GRID * GRID), count: 0, lastSpark: 0, lastBuzz: 0,
  });
  const [started, setStarted] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [sparks, setSparks] = useState([]);

  const interactive = Boolean(prize);

  const finish = useCallback(() => {
    if (s.current.done) return;
    s.current.done = true;
    s.current.drawing = false;
    navigator.vibrate?.([20, 40, 30]);
    setRevealed(true);
    onRevealed?.();
  }, [onRevealed]);

  // Paint the foil once. Repainting after a scratch would restore it, so resizes are ignored once
  // the first stroke has landed.
  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap || !interactive) return;

    const paint = () => {
      const st = s.current;
      if (st.scratched) return;
      const w = wrap.offsetWidth;
      const h = wrap.offsetHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      const ctx = canvas.getContext("2d");
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const foil = ctx.createLinearGradient(0, 0, w, h);
      foil.addColorStop(0, "#e4551a");
      foil.addColorStop(0.5, "#c9440f");
      foil.addColorStop(1, "#e4551a");
      ctx.fillStyle = foil;
      ctx.fillRect(0, 0, w, h);

      // Grout lines. A tile shop's foil, and the texture is what makes the scratch marks read.
      ctx.strokeStyle = "rgba(255,255,255,0.14)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let x = TILE; x < w; x += TILE) ctx.moveTo(x + 0.5, 0), ctx.lineTo(x + 0.5, h);
      for (let y = TILE; y < h; y += TILE) ctx.moveTo(0, y + 0.5), ctx.lineTo(w, y + 0.5);
      ctx.stroke();

      Object.assign(st, { ctx, w, h });
    };

    paint();
    const observer = new ResizeObserver(paint);
    observer.observe(wrap);
    return () => observer.disconnect();
  }, [interactive]);

  const markCoverage = (x, y) => {
    const st = s.current;
    const cw = st.w / GRID;
    const ch = st.h / GRID;
    const r = BRUSH_RADIUS * 0.8;
    for (let gy = Math.max(0, Math.floor((y - r) / ch)); gy <= Math.min(GRID - 1, Math.floor((y + r) / ch)); gy++) {
      for (let gx = Math.max(0, Math.floor((x - r) / cw)); gx <= Math.min(GRID - 1, Math.floor((x + r) / cw)); gx++) {
        const dx = (gx + 0.5) * cw - x;
        const dy = (gy + 0.5) * ch - y;
        const i = gy * GRID + gx;
        if (dx * dx + dy * dy <= r * r && !st.cells[i]) {
          st.cells[i] = 1;
          st.count++;
        }
      }
    }
  };

  const scratch = (from, to) => {
    const st = s.current;
    const { ctx } = st;
    if (!ctx || st.done) return;
    st.scratched = true;
    ctx.globalCompositeOperation = "destination-out";
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = BRUSH_RADIUS * 2;
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x + 0.01, to.y);
    ctx.stroke();
    // Gritty edge: flecks of foil chip off around the stroke.
    for (let i = 0; i < 7; i++) {
      const a = Math.random() * Math.PI * 2;
      const d = BRUSH_RADIUS * (0.8 + Math.random() * 0.6);
      ctx.beginPath();
      ctx.arc(to.x + Math.cos(a) * d, to.y + Math.sin(a) * d, 0.8 + Math.random() * 2.2, 0, Math.PI * 2);
      ctx.fill();
    }

    const steps = Math.max(1, Math.ceil(Math.hypot(to.x - from.x, to.y - from.y) / (BRUSH_RADIUS / 2)));
    for (let i = 0; i <= steps; i++) {
      markCoverage(from.x + ((to.x - from.x) * i) / steps, from.y + ((to.y - from.y) * i) / steps);
    }

    const progress = st.count / (GRID * GRID);
    // A tick of haptics every 15% cleared, so the card feels like it is giving way.
    const buzz = Math.floor((progress * 100) / 15);
    if (buzz > st.lastBuzz) {
      st.lastBuzz = buzz;
      navigator.vibrate?.(8);
    }
    if (progress >= REVEAL_AT) finish();
  };

  const spark = (p) => {
    if (reduce) return;
    const now = performance.now();
    if (now - s.current.lastSpark < 45) return;
    s.current.lastSpark = now;
    const id = `${now}-${Math.random()}`;
    const sp = {
      id,
      x: p.x,
      y: p.y,
      dx: (Math.random() - 0.5) * 40,
      dy: 18 + Math.random() * 26,
      size: 3 + Math.random() * 4,
      color: SPARK_COLORS[Math.floor(Math.random() * SPARK_COLORS.length)],
    };
    setSparks((prev) => [...prev.slice(-18), sp]);
    setTimeout(() => setSparks((prev) => prev.filter((x) => x.id !== id)), 650);
  };

  const toLocal = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const st = s.current;
    return { x: ((e.clientX - rect.left) * st.w) / rect.width, y: ((e.clientY - rect.top) * st.h) / rect.height };
  };

  if (!interactive) {
    // Teaser: the same foil, painted in CSS and inert. Nothing to scratch until there is a prize.
    return (
      <div
        className={`relative mx-auto aspect-[16/10] w-full max-w-[280px] overflow-hidden rounded-xl select-none ${className}`}
        style={{
          background:
            "repeating-linear-gradient(0deg, rgba(255,255,255,.14) 0 1px, transparent 1px 28px)," +
            "repeating-linear-gradient(90deg, rgba(255,255,255,.14) 0 1px, transparent 1px 28px)," +
            "linear-gradient(135deg, #e4551a 0%, #c9440f 50%, #e4551a 100%)",
        }}
        aria-hidden
      >
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-center">
          <span className="font-display text-on-action max-md:text-[11px] max-md:leading-tight md:text-xl">
            ₹250–₹750
          </span>
          <span className="text-on-action/75 max-md:hidden md:text-[11px]">Scratch it after you sign up</span>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      className={`relative mx-auto aspect-square w-full max-w-[300px] ${className}`}
      initial={reduce ? false : { opacity: 0, scale: 0.85, y: 24 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 220, damping: 20 }}
    >
      <div className="absolute inset-0 rounded-xl shadow-[0_18px_40px_rgba(28,27,25,0.28)]">
        <motion.div
          className="absolute inset-0"
          animate={revealed && !reduce ? { scale: [1, 1.07, 1] } : { scale: 1 }}
          transition={{ duration: 0.6, delay: 0.25 }}
        >
          <Ticket prize={prize} countUp={revealed} />
        </motion.div>

        <motion.div
          ref={wrapRef}
          className="absolute inset-0 overflow-hidden rounded-xl"
          animate={revealed ? { opacity: 0, scale: 1.06 } : { opacity: 1, scale: 1 }}
          transition={{ duration: reduce ? 0 : 0.45, ease: "easeOut" }}
          style={{ pointerEvents: revealed ? "none" : "auto" }}
        >
          <canvas
            ref={canvasRef}
            className="absolute inset-0 block h-full w-full"
            style={{ touchAction: "none", cursor: revealed ? "default" : "grab" }}
            onPointerDown={(e) => {
              if (s.current.done) return;
              e.preventDefault();
              canvasRef.current.setPointerCapture?.(e.pointerId);
              const p = toLocal(e);
              s.current.drawing = true;
              s.current.last = p;
              setStarted(true);
              scratch(p, p);
              spark(p);
            }}
            onPointerMove={(e) => {
              if (!s.current.drawing) return;
              e.preventDefault();
              const p = toLocal(e);
              scratch(s.current.last, p);
              s.current.last = p;
              spark(p);
            }}
            onPointerUp={() => (s.current.drawing = false)}
            onPointerCancel={() => (s.current.drawing = false)}
            onPointerLeave={() => (s.current.drawing = false)}
          />

          {/* Idle shimmer until the first scratch */}
          {!started && !reduce && (
            <div className="pointer-events-none absolute inset-0 overflow-hidden">
              <div className="th-scratch-shimmer absolute inset-y-0 -left-1/2 w-1/2" />
            </div>
          )}

          <AnimatePresence>
            {!started && (
              <motion.div
                key="hint"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center"
              >
                <motion.svg
                  width="46" height="46" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.6"
                  strokeLinecap="round" strokeLinejoin="round" aria-hidden
                  animate={reduce ? {} : { x: [-34, 34, -20, 30, -34], y: [-8, 6, 14, -2, -8], rotate: [-8, 8, -4, 6, -8] }}
                  transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
                  style={{ filter: "drop-shadow(0 2px 6px rgba(0,0,0,.45))" }}
                >
                  <path d="M18 11V6a2 2 0 0 0-4 0v1" />
                  <path d="M14 10V4a2 2 0 0 0-4 0v2" />
                  <path d="M10 10.5V6a2 2 0 0 0-4 0v8" />
                  <path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15" />
                </motion.svg>
                <span className="mt-2 rounded-full bg-black/40 px-3 py-1 text-xs tracking-[0.5px] text-white backdrop-blur-sm">
                  Scratch here to reveal
                </span>
              </motion.div>
            )}
          </AnimatePresence>

          {sparks.map((sp) => (
            <motion.span
              key={sp.id}
              className="pointer-events-none absolute rounded-full"
              style={{ left: sp.x, top: sp.y, width: sp.size, height: sp.size, background: sp.color, boxShadow: `0 0 6px ${sp.color}` }}
              initial={{ opacity: 1, x: 0, y: 0, scale: 1 }}
              animate={{ opacity: 0, x: sp.dx, y: sp.dy, scale: 0.3 }}
              transition={{ duration: 0.6, ease: "easeOut" }}
            />
          ))}
        </motion.div>
      </div>

      {/* Pointer events are not guaranteed -- a trackpad, a screen reader, or a browser that swallows
          them all end at the same dead card. This is the way out, visible from the start. */}
      {!revealed && (
        <button
          type="button"
          onClick={finish}
          className="absolute bottom-2 right-3 z-10 text-[11px] text-white/90 underline underline-offset-2"
        >
          Reveal
        </button>
      )}

      <style>{`
        .th-scratch-shimmer {
          background: linear-gradient(100deg, transparent 0%, rgba(255,236,220,.32) 50%, transparent 100%);
          animation: thScratchShimmer 2.6s ease-in-out infinite;
        }
        @keyframes thScratchShimmer {
          0% { transform: translateX(0); }
          60%, 100% { transform: translateX(400%); }
        }
      `}</style>
    </motion.div>
  );
}
