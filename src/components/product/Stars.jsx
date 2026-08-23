import { Star } from "lucide-react";

/**
 * A rating, drawn. GOLD, not the brand orange -- see the note on --gold in globals.css: orange
 * stars read as a control on a site where orange is every button, and the star-is-gold convention
 * is older and stronger than the palette.
 *
 * NO "use client". It renders the same markup from the same props whoever calls it, so the server
 * components (ProductReviews) and the client ones (ProductCard, the buy box) can all import it and
 * only the client callers pay for it in the bundle.
 *
 * HALF STARS ARE DRAWN PROPERLY, by overlaying a clipped filled row on an empty one. The usual
 * shortcut -- round 4.3 up to 4.5 or down to 4 -- makes the picture disagree with the number
 * printed beside it, which is the one thing a rating cannot do. Width is a percentage of `value`,
 * so 4.3 is 4.3.
 */
export default function Stars({ value, size = 14, className = "" }) {
  const pct = Math.max(0, Math.min(100, (value / 5) * 100));

  return (
    <span className={`relative inline-flex shrink-0 align-middle ${className}`} aria-hidden="true">
      {/* The empty track: outline only, in the page's own hairline colour. Deliberately NOT a pale
          gold -- two golds at 11px is mud, and the track's job is to say "out of five", not to
          look like a dimmer star. */}
      <Row size={size} className="text-line-strong" />
      {/* Absolutely positioned over the empty row and clipped to the score. overflow-hidden on a
          fixed-width box does the clipping; the inner row keeps its full width so the partial star
          is a partial STAR and not a squashed one. */}
      <span className="absolute inset-y-0 left-0 overflow-hidden" style={{ width: `${pct}%` }}>
        <Row size={size} className="text-gold-line" fillClass="fill-gold" />
      </span>
    </span>
  );
}

/**
 * `className` colours the STROKE and rides the wrapper, because lucide draws with
 * `stroke="currentColor"` and colour inherits.
 *
 * `fillClass` has to go on each ICON, and that distinction is the whole reason this signature is
 * not one prop. lucide puts a literal `fill="none"` attribute on the <svg>, and a presentation
 * attribute on the element beats a `fill` inherited from an ancestor -- so `fill-gold` on this
 * wrapper silently paints nothing and every star renders as an empty outline.
 */
function Row({ size, className, fillClass = "" }) {
  return (
    <span className={`flex ${className}`}>
      {[0, 1, 2, 3, 4].map((i) => (
        <Star
          key={i}
          size={size}
          strokeWidth={1.5}
          className={fillClass}
          // shrink-0 so the clipped copy cannot compress its own stars to fit the cropped box --
          // without it the overlay's five stars squeeze into 86% of the width and stop lining up
          // with the row underneath.
          style={{ flexShrink: 0 }}
        />
      ))}
    </span>
  );
}
