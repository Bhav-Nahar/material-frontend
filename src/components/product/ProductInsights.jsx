import { Footprints, Home, Layers, Package, Palette, Sun } from "lucide-react";

/**
 * Product insights -- Material Depot's block, and the reason theirs reads better than a spec table:
 * a spec table tells a buyer "Slip rating: R10", which is only useful to someone who already knows
 * what R10 means. Most people buying a floor once in ten years do not. So each card here carries the
 * VALUE and one line explaining what the field actually is, which is the part that turns a
 * measurement into a decision.
 *
 * WHAT IS DELIBERATELY NOT HERE. Depot's insights also claim water resistance, scratch resistance,
 * fire rating and frost resistance. We have no metafield for any of those, and a PDP that prints
 * "Water resistant" because a competitor does is inventing a property of someone's floor. Every card
 * below is built from a metafield that is actually set (see mapProduct in lib/product.js) and drops
 * out silently when it is not -- the same rule the spec chips follow.
 *
 * The captions describe the FIELD, not the product. "Matte" gets "how much light the surface
 * reflects" rather than "hides scratches well": the first is a definition and cannot be wrong, the
 * second is a performance claim nobody has tested. The one exception is the slip rating, where the
 * caption places the value on the DIN 51130 scale (R9-R13) -- that scale is a published fact, not a
 * claim about this tile.
 */
const INSIGHTS = [
  {
    key: "application",
    icon: Home,
    label: "Where it goes",
    caption: "The rooms this material is meant for.",
    value: (p) => (p.specs.application.length > 0 ? p.specs.application.join(" · ") : null),
  },
  {
    key: "slip",
    icon: Footprints,
    label: "Slip rating",
    // The one caption that explains a SCALE rather than a field, because a bare "R10" is the least
    // readable figure on the page and the scale is published (DIN 51130).
    caption: "Grip underfoot on the R9–R13 scale — the higher the number, the more textured.",
    value: (p) => p.specs.slipRating,
  },
  {
    key: "finish",
    icon: Sun,
    label: "Finish",
    caption: "How much light the surface reflects.",
    value: (p) => p.specs.finish,
  },
  {
    key: "look",
    icon: Palette,
    label: "Look",
    caption: "The material this one is designed to read as.",
    value: (p) => p.specs.look,
  },
  {
    key: "material",
    icon: Layers,
    label: "Base material",
    caption: "The body it is made from.",
    value: (p) => p.specs.material,
  },
  {
    key: "coverage",
    icon: Package,
    label: "Coverage",
    caption: "What one pack covers — this is what the quantity is worked out from.",
    value: (p, v) =>
      v.coverage > 0
        ? `${v.coverage} sq ft/${v.packUnit}${v.pieces ? ` · ${v.pieces} pieces` : ""}`
        : null,
  },
];

/**
 * The identifiers -- which exact item this is, rather than what it is like.
 *
 * These used to be a SECTION of their own, headed "Specification", laid out as a three-column grid.
 * That was too much furniture for five reference rows: a display-size heading, a grid that left a
 * visible hole in its second row because five does not divide by three, and a third h2 in a details
 * area that only needed one. Nobody scans for a product code -- they arrive looking for it -- so it
 * does not need a heading competing with the cards above, it needs to be findable and small.
 *
 * Now it is a quiet strip attached to the bottom of the insights block, which is where it belongs:
 * the cards say what the material is like, these say which one it is. One section, one heading.
 */
function identifiers(product, variant) {
  return [
    [variant.title !== "Default Title" && "Size", variant.title],
    ["Thickness", variant.thickness && `${variant.thickness} mm`],
    ["Product code", variant.sku],
    ["Brand", product.vendor],
    ["Collection", product.collection?.title],
  ].filter(([label, value]) => label && value);
}

export default function ProductInsights({ product, variant }) {
  const cards = INSIGHTS.map((insight) => ({
    ...insight,
    value: insight.value(product, variant),
  })).filter((insight) => insight.value);

  const rows = identifiers(product, variant);

  // A single card is not a section -- and whatever that lone field is, it is already a chip beside the
  // price. Two or more make a row worth heading. The identifiers can carry the block on their own, so
  // only a product with neither drops out entirely.
  const showCards = cards.length >= 2;
  if (!showCards && rows.length === 0) return null;

  return (
    <section aria-labelledby="product-insights" className="container-main mt-6 lg:mt-8">
      <h2
        id="product-insights"
        className="font-display text-lg tracking-[-0.02em] lg:text-xl"
      >
        Product insights
      </h2>

      {showCards && (
        /**
         * TOP RULES, not a boxed grid, and this is a correctness fix rather than a taste one.
         *
         * This was a bordered container with `bg-line` showing through `gap-px` to draw the hairlines.
         * That only works when the cards fill every row: at three columns, FIVE cards leave one empty
         * track and FOUR leave two, and an empty track has no `bg-surface` cell over it -- so the
         * container's line colour showed through as a solid beige block where a card should be. Six
         * fields happened to tile perfectly, which is the only reason it looked right.
         *
         * A rule on top of each cell cannot do that: every count from two upwards lays out correctly,
         * an incomplete last row is simply shorter, and it speaks the same language as the identifier
         * strip below. Partial data is the NORMAL case here -- most products will not carry all six
         * metafields -- so the layout has to be right for any number of them, not one.
         */
        <ul className="mt-4 grid gap-x-10 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map(({ key, icon: Icon, label, caption, value }) => (
            <li key={key} className="border-t border-line py-4">
              <div className="flex items-center gap-2">
                <Icon
                  size={15}
                  strokeWidth={1.5}
                  className="shrink-0 text-subtle"
                  aria-hidden="true"
                />
                <p className="text-[11px] font-medium uppercase tracking-wide text-meta">{label}</p>
              </div>
              <p className="num mt-2.5 text-sm font-medium leading-snug text-ink">{value}</p>
              <p className="mt-1.5 text-xs leading-relaxed text-subtle">{caption}</p>
            </li>
          ))}
        </ul>
      )}

      {/* The identifiers. Five columns at lg so the five rows land in ONE line with no hole; each
          cell carries its own top rule, so at the narrower widths -- where they wrap 2 and 3 at a
          time -- it still reads as a list rather than a grid that ran out. No icons and no captions:
          a product code does not need explaining, it needs finding. */}
      {rows.length > 0 && (
        <dl className="mt-5 grid grid-cols-2 gap-x-8 sm:grid-cols-3 lg:grid-cols-5">
          {rows.map(([label, value]) => (
            <div key={label} className="border-t border-line py-3">
              <dt className="text-[11px] uppercase tracking-wide text-meta">{label}</dt>
              <dd className="num mt-1 text-sm text-ink">{value}</dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  );
}
