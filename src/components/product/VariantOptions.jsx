"use client";

import Image from "next/image";
import { variantLine } from "@/lib/variantLines";
import { pickVariant } from "@/lib/product";

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
  if (product.options.length > 1) return <OptionRows product={product} variant={variant} onChoose={onChoose} />;

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

/**
 * A row PER OPTION, once a product has two (Size and Colour). One button per variant stopped
 * working there: 3 sizes x 4 colours is twelve buttons reading "2440 x 1220 mm / Walnut", and
 * the shopper choosing a colour has to read every size to find it.
 *
 * A value with no stocked combination for the current other choices is still offered -- picking it
 * moves to the nearest variant that has it (pickVariant) rather than leaving a dead button.
 * Colour buttons carry that colour's photo, so the row reads as swatches.
 */
function OptionRows({ product, variant, onChoose }) {
  return (
    <div className="space-y-4">
      {product.options.map((o) => {
        const isColour = /colou?r/i.test(o.name);
        return (
          <fieldset key={o.name}>
            <legend className="text-xs font-medium text-ink">
              {o.name}
              <span className="ml-1.5 font-normal text-subtle">{variant.options[o.name]}</span>
            </legend>
            <div className="mt-2.5 flex flex-wrap gap-2.5">
              {o.optionValues.map(({ name }) => {
                const target = pickVariant(product.variants, variant, o.name, name);
                const on = variant.options[o.name] === name;
                const swatch = isColour && product.variants.find((v) => v.options[o.name] === name)?.image;
                return (
                  <button
                    key={name}
                    type="button"
                    onClick={() => onChoose(target)}
                    aria-pressed={on}
                    className={`flex cursor-pointer items-center gap-2 rounded-sm border px-3 py-2 text-left text-sm text-ink transition-colors ${
                      on ? "border-ink bg-surface" : "border-line bg-surface hover:border-line-strong"
                    }`}
                  >
                    {swatch && (
                      <Image
                        src={swatch}
                        alt=""
                        width={28}
                        height={28}
                        className="h-7 w-7 shrink-0 rounded-full object-cover"
                      />
                    )}
                    {name}
                  </button>
                );
              })}
            </div>
          </fieldset>
        );
      })}
    </div>
  );
}
