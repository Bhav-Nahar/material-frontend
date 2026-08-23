"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const REVEAL_AT = 0.55; // fraction scratched before the rest clears itself
const BRUSH_RADIUS = 22;

/**
 * The signup reward, as a scratch card.
 *
 * WHY NOT A WHEEL. Every Indian phone user has been trained by GPay, PhonePe and Paytm to scratch a
 * card after a transaction, so the gesture needs no explaining -- and it reads as a reward already
 * earned rather than a gamble being offered, which suits a store selling ₹27,000 tile orders. It also
 * removes a whole class of bugs: a wheel is angle maths, rotated labels and a conic-gradient that
 * dies silently if one colour stop is unparseable. This is a rectangle with a layer on top.
 *
 * IT DOES NOT DECIDE ANYTHING. The prize arrives from the server with the created account (see the
 * backend's lib/prizes.js). Scratching only uncovers what is already decided; there is nothing here
 * to tamper with.
 *
 * TEASER MODE (no `prize`) draws an unscratchable card printed with the range. A wheel advertises its
 * range just by having six labelled wedges; a covered card shows nothing, so the range has to be in
 * print or the offer loses its number before anyone commits.
 */
export default function ScratchCard({ prize = null, onRevealed, className = "" }) {
  const canvasRef = useRef(null);
  const drawing = useRef(false);
  const revealedRef = useRef(false);
  const [revealed, setRevealed] = useState(false);

  const interactive = Boolean(prize);

  const finish = useCallback(() => {
    if (revealedRef.current) return;
    revealedRef.current = true;
    setRevealed(true);
    onRevealed?.();
  }, [onRevealed]);

  // Paint the foil. Re-runs on resize so the covering always matches the box it sits in.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !interactive) return;

    const paint = () => {
      const { width, height } = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = width * dpr;
      canvas.height = height * dpr;

      const ctx = canvas.getContext("2d");
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const foil = ctx.createLinearGradient(0, 0, width, height);
      foil.addColorStop(0, "#e4551a");
      foil.addColorStop(0.5, "#c9440f");
      foil.addColorStop(1, "#e4551a");
      ctx.fillStyle = foil;
      ctx.fillRect(0, 0, width, height);

      ctx.fillStyle = "rgba(16,16,16,0.85)";
      ctx.font = "600 13px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("Scratch here", width / 2, height / 2 + 4);
    };

    paint();
    const observer = new ResizeObserver(paint);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [interactive]);

  const scratchAt = (event) => {
    const canvas = canvasRef.current;
    if (!canvas || revealedRef.current) return;

    const rect = canvas.getBoundingClientRect();
    const ctx = canvas.getContext("2d");
    ctx.globalCompositeOperation = "destination-out";
    ctx.beginPath();
    ctx.arc(event.clientX - rect.left, event.clientY - rect.top, BRUSH_RADIUS, 0, Math.PI * 2);
    ctx.fill();
  };

  // Sampled on release rather than every move: reading back pixels is the expensive part, and the
  // answer only has to be right at the moment the finger lifts.
  const measure = () => {
    const canvas = canvasRef.current;
    if (!canvas || revealedRef.current) return;

    const ctx = canvas.getContext("2d");
    const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
    let clear = 0;
    // Every 32nd pixel — 3% of the work for the same answer at this size.
    for (let i = 3; i < data.length; i += 4 * 32) if (data[i] === 0) clear++;
    if (clear / (data.length / (4 * 32)) >= REVEAL_AT) finish();
  };

  return (
    <div
      className={`relative mx-auto aspect-[16/10] w-full max-w-[280px] overflow-hidden border border-line-strong bg-surface select-none ${className}`}
    >
      {/* What is underneath. Rendered always, so the reveal is an uncovering rather than a swap. */}
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 px-4 text-center">
        {prize ? (
          <>
            <span className="font-display text-3xl leading-none text-ink">{prize.label}</span>
            <span className="text-xs text-subtle">on your first order</span>
          </>
        ) : (
          <>
            <span className="font-display text-2xl leading-none text-ink">₹250–₹750</span>
            <span className="text-xs text-subtle">inside</span>
          </>
        )}
      </div>

      {interactive ? (
        <canvas
          ref={canvasRef}
          className={`absolute inset-0 h-full w-full touch-none transition-opacity duration-500 ${
            revealed ? "pointer-events-none opacity-0" : "cursor-pointer opacity-100"
          }`}
          onPointerDown={(e) => {
            drawing.current = true;
            e.currentTarget.setPointerCapture(e.pointerId);
            scratchAt(e);
          }}
          onPointerMove={(e) => drawing.current && scratchAt(e)}
          onPointerUp={() => {
            drawing.current = false;
            measure();
          }}
          onPointerLeave={() => {
            drawing.current = false;
            measure();
          }}
        />
      ) : (
        // Teaser: the same foil, painted in CSS and inert. No canvas, nothing to scratch.
        <div
          className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-center"
          style={{ background: "linear-gradient(135deg, #e4551a 0%, #c9440f 50%, #e4551a 100%)" }}
          aria-hidden
        >
          <span className="font-display text-on-action max-md:text-[11px] max-md:leading-tight md:text-xl">
            ₹250–₹750
          </span>
          <span className="text-on-action/75 max-md:hidden md:text-[11px]">Scratch it after you sign up</span>
        </div>
      )}

      {/* Pointer events are not guaranteed — a trackpad, a screen reader, or a browser that swallows
          them all end at the same dead card. This is the way out, and it is visible from the start
          rather than appearing after a timeout nobody waits for. */}
      {interactive && !revealed && (
        <button
          type="button"
          onClick={finish}
          className="absolute bottom-1.5 right-2 z-10 text-[11px] text-on-action/90 underline underline-offset-2"
        >
          Reveal
        </button>
      )}
    </div>
  );
}
