"use client";

import { formatPrice } from "@/utils/formatPrice";

/**
 * One button per VARIANT, not a picker per option.
 *
 * Shopify's variant title is already the option values joined ("1200 × 200 mm", or
 * "1200 × 200 mm / Honey" once there are two), so this reads correctly however many options a
 * product grows, and it cannot offer a combination that does not exist.
 *
 * Each button carries the two numbers that actually differ between sizes -- the rate and the
 * coverage -- which is the job Material Depot's photographed colour drawer does for colourways,
 * and the reason we do not need the drawer.
 *
 * Extracted from the buy box because the buy SHEET needs the identical control: someone who opens
 * the sheet from the pinned bar is past the buy box and must still be able to change size without
 * scrolling back up.
 */
export default function VariantOptions({ product, variant, onChoose, columns = 2 }) {
  if (product.variants.length < 2) return null;

  return (
    <fieldset>
      <legend className="text-xs font-medium text-ink">
        {product.options.map((o) => o.name).join(" / ") || "Choose"}
        <span className="ml-1.5 font-normal text-subtle">{variant.title}</span>
      </legend>
      <div className={`mt-2.5 grid gap-2.5 ${columns === 1 ? "grid-cols-1" : "grid-cols-2"}`}>
        {product.variants.map((v) => (
          <button
            key={v.id}
            type="button"
            onClick={() => onChoose(v)}
            disabled={!v.inStock}
            aria-pressed={v.id === variant.id}
            className={`cursor-pointer rounded-sm border px-3 py-2.5 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-45 ${
              v.id === variant.id
                ? "border-ink bg-surface"
                : "border-line bg-surface hover:border-line-strong"
            }`}
          >
            <span className="block text-sm text-ink">{v.title}</span>
            <span className="num mt-0.5 block text-[11px] text-subtle">
              {v.perSqFt > 0
                ? `₹${formatPrice(v.perSqFt)}/sq ft · ${v.coverage} sq ft/${v.packUnit}`
                : `₹${formatPrice(v.price)}/${v.packUnit}`}
            </span>
          </button>
        ))}
      </div>
    </fieldset>
  );
}
