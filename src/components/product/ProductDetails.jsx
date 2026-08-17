"use client";

import { Droplets, Hammer, Info, Sparkles, Truck } from "lucide-react";

/**
 * The long-form detail: description, installation, care, shipping, brand.
 *
 * WAS ProductSpecs, and carried a "Specification" heading over a table of five reference rows. Both
 * are gone -- the rows are now a strip at the foot of ProductInsights, where they belong, and this
 * file is what was actually left: five collapsible panels. Keeping the old name would have described
 * a table that is no longer here.
 *
 * ONE COLUMN, not two. The panels used to sit in a two-column grid, which looked deliberate only
 * when the count was even: with three panels on the left and two on the right, the right column ended
 * in a block of blank paper the height of a panel. A single stack cannot develop a hole, and each
 * closed panel is one hairline row -- the same shape as the FAQ further down the page, so the two
 * read as one system.
 *
 * Still <details> rather than tabs, for the reasons the first version of this file gave: tabs hide
 * two thirds of the page's substance behind a click, take it out of the browser's own find-in-page,
 * and cost JavaScript to do what the element does natively. No heading of its own either -- the
 * panels are self-labelling, and a third h2 in the details area was one of the things that made this
 * stretch feel over-built.
 */
export default function ProductDetails({ product, variant }) {
  return (
    // mt-6. It WAS flush (0) while the identifier strip sat directly above and the two read as one
    // continuous ruled list; the help card now sits between them, so there is a bordered card above
    // this rather than a ruled row, and a card needs air under it or its border and the first panel's
    // top rule stack into a double line.
    <div className="container-main mt-6">
      {product.description && (
        <Panel title="About this product" icon={Info} open>
          <p className="whitespace-pre-line">{product.description}</p>
        </Panel>
      )}

      {product.installation.length > 0 && (
        <Panel title="Installation" icon={Hammer}>
          <Steps items={product.installation} />
        </Panel>
      )}

      {product.care.length > 0 && (
        <Panel title="Care and maintenance" icon={Droplets}>
          <Steps items={product.care} />
        </Panel>
      )}

      {/* Shipping and returns says only what the store already commits to elsewhere -- the
          announcement bar and the FAQ's CONFIRMED answers. No window, no free-returns claim:
          src/data/faqs.js marks those PLACEHOLDER because nobody has signed off on them, and a
          policy invented on a PDP is one the shop has to argue about later. */}
      <Panel title="Shipping and returns" icon={Truck}>
        <Steps
          items={[
            "Delivered across Mumbai and the MMR.",
            "Freight depends on weight and floor, so it is quoted at checkout before you pay rather than added afterwards.",
            "Tiles travel badly and some breakage is normal — this is what the 10% overage covers. Photograph anything cracked before it is moved.",
            variant.inStock
              ? "This size is held in stock."
              : "This size is made to order; we confirm the lead time before you pay.",
          ]}
        />
      </Panel>

      {product.vendor && (
        <Panel title="Brand" icon={Sparkles}>
          <p>
            Supplied by {product.vendor}
            {product.collection ? `, from the ${product.collection.title} range` : ""}. Every brand
            we stock is bought direct, so what arrives is what was ordered.
          </p>
        </Panel>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- pieces */

function Panel({ title, icon: Icon, children, open = false }) {
  return (
    // last:border-b-0 -- the WhyMaterial strip sits flush against this list and carries its own
    // border-t. Without this the last panel's bottom rule and the strip's top rule stack into a 2px
    // line, which is the one place on the page a hairline would look like a mistake. The strip's
    // border becomes the list's closing rule instead.
    <details open={open} className="group border-b border-line first:border-t last:border-b-0">
      <summary className="flex cursor-pointer list-none items-center gap-2.5 py-4 text-sm font-medium text-ink">
        <Icon size={15} strokeWidth={1.5} className="shrink-0 text-subtle" aria-hidden="true" />
        {title}
        <span className="ml-auto text-subtle transition-transform group-open:rotate-45">+</span>
      </summary>
      {/* Constrained: full width now means the width of a 1440px page, and a 1,400px line of body
          copy is unreadable however tidy the row looks closed. */}
      <div className="max-w-3xl pb-5 text-sm leading-relaxed text-subtle">{children}</div>
    </details>
  );
}

function Steps({ items }) {
  return (
    <ul className="space-y-2">
      {items.filter(Boolean).map((line) => (
        <li key={line} className="flex gap-2.5">
          <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-line-strong" />
          {line}
        </li>
      ))}
    </ul>
  );
}
