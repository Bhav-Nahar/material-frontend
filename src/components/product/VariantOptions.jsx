"use client";

import { variantLine } from "@/lib/variantLines";

/**
 * One button per VARIANT, not a picker per option.
 *
 * Shopify's variant title is already the option values joined ("1200 × 200 mm", or
 * "1200 × 200 mm / Honey" once there are two), so this reads correctly however many options a
 * product grows, and it cannot offer a combination that does not exist.
 *
 * Each button carries the title, and a coverage line only when the variants disagree about it --
 * no price. See variantLines, which owns that rule, records what dropping the rate gives up, and is
 * tested on both halves including the uniform case a browser cannot show us.
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
            {/* Empty when the variants agree on every number -- the button closes up rather than
                reserving a blank row. */}
            {variantLine(product.variants, v) && (
              <span className="num mt-0.5 block text-[11px] text-subtle">
                {variantLine(product.variants, v)}
              </span>
            )}
          </button>
        ))}
      </div>
    </fieldset>
  );
}
