import Link from "next/link";

/**
 * The wordmark: MATERIAL in Bai Jamjuree 700, orange.
 *
 * §02 records that every store render sets the wordmark in orange and that this "overrides the
 * colourway guidance for retail only" -- extended to web deliberately. WCAG exempts logotypes from
 * contrast requirements (1.4.3), so this is the one legitimate place for orange type; it stays out
 * of body copy, links, prices and labels, which is what §04's rule protects.
 *
 * The link is OPT-IN via `href`. It used to always render its own <Link>, which produced an <a>
 * nested inside an <a> wherever a caller had already wrapped it -- invalid HTML that failed
 * hydration and silently reset component state on the whole header.
 */
export default function Wordmark({ href, className = "" }) {
  const mark = (
    <span className="font-display text-2xl font-bold uppercase leading-none tracking-[-0.02em] text-[var(--action)] lg:text-3xl">
      Material
    </span>
  );

  if (!href) return <span className={`inline-flex items-center ${className}`}>{mark}</span>;

  return (
    <Link href={href} aria-label="Material home" className={`inline-flex items-center ${className}`}>
      {mark}
    </Link>
  );
}
