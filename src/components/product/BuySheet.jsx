"use client";

import Image from "next/image";
import { ArrowRight, Check, Loader2, X } from "lucide-react";

import { Sheet, SheetClose, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { areaForBoxes, optionText, variantPhoto } from "@/lib/product";
import { formatPrice } from "@/utils/formatPrice";
import AreaCalculator from "./AreaCalculator";
import VariantOptions from "./VariantOptions";

/**
 * The buy sheet -- SIDE panel on desktop, BOTTOM sheet on a phone, which is Material Depot's
 * arrangement and the same split HelpMeChoose and CategorySheet already use here.
 *
 * WHY IT EXISTS. The pinned bar could add to cart on its own, and that was a way to sell someone
 * the wrong order: by the time the bar is the only control on screen the calculator is scrolled
 * away, so "Add" meant "add ONE box" -- ₹1,845 of tile for a customer who needs ₹27,668 of it.
 * A quantity that is derived from an area cannot be confirmed by a button that shows neither.
 * So the bar no longer adds. It OPENS this, which shows the area, the size, the coverage, the
 * pincode and the total, and adds only once the customer has seen them.
 *
 * It is not a second calculator. Every control here is the SAME component the buy box renders,
 * driven by the SAME state in ProductPage -- so a sheet opened after someone typed 200 sq ft
 * upstairs opens already saying 15 boxes, and nothing has to be entered twice.
 *
 * NO PINCODE. It was here and it has been taken out: serviceability is a question you ask BEFORE
 * deciding to buy, and it is already answered in the buy box where the price is. Asking it again on
 * the way to the cart adds a field to the one panel that should only be asking "how much", and
 * Shopify collects the real delivery address at checkout regardless.
 *
 * On confirm it goes to the CART rather than staying put. That is the one place the sheet differs
 * from the inline button: someone who has just worked through a configuration panel is finished
 * deciding, and leaving them on the PDP with a closed sheet is the moment the order gets abandoned.
 */
export default function BuySheet({
  open,
  onOpenChange,
  product,
  variant,
  area,
  boxes,
  wastage,
  status,
  onArea,
  onBoxes,
  onWastage,
  onVariant,
  onConfirm,
  stockNote,
}) {
  // Matches Tailwind's lg, same as HelpMeChoose -- false on the server and on first paint, which is
  // fine because the sheet starts closed either way.
  const isDesktop = useMediaQuery("(min-width: 1024px)");

  const total = boxes * variant.price;
  const busy = status === "adding";
  const failed = status && status !== "adding" && status !== "added";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={isDesktop ? "right" : "bottom"}
        aria-describedby={undefined}
        // Same as CategorySheet: the built-in close has no z-index and the sticky header paints
        // over it, so ours lives IN the header.
        showCloseButton={false}
        className="flex max-h-[92dvh] flex-col gap-0 rounded-none p-0 sm:max-w-none lg:max-h-none lg:w-[27rem]"
      >
        <div className="flex shrink-0 items-center justify-between gap-4 border-b border-line bg-background px-5 py-4">
          <SheetTitle className="font-display text-lg tracking-[-0.02em]">
            How much do you need?
          </SheetTitle>
          <SheetClose
            aria-label="Close"
            className="-mr-1 flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-sm text-subtle hover:text-ink"
          >
            <X size={18} strokeWidth={1.5} />
          </SheetClose>
        </div>

        {/* Scrolls, because on a phone the bottom sheet is capped at 92dvh and this is four
            controls plus a summary. The confirm row below is OUTSIDE this, so it never scrolls
            away from the customer. */}
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
          {/* The product, so a sheet that covers the page still says what it is about. */}
          <div className="flex gap-3.5 border-b border-line pb-5">
            {variantPhoto(product, variant) && (
              <div className="relative aspect-swatch w-16 shrink-0 overflow-hidden rounded-sm border border-line bg-paper">
                <Image
                  key={variantPhoto(product, variant)}
                  src={variantPhoto(product, variant)}
                  alt=""
                  fill
                  sizes="64px"
                  className="object-cover"
                />
              </div>
            )}
            <div className="min-w-0">
              <p className="line-clamp-2 text-sm leading-snug text-ink">{product.title}</p>
              {/* Which one is being added -- the sheet changes size and colour, so it must say. */}
              {optionText(product, variant) && (
                <p className="mt-1 text-xs font-medium text-ink">{optionText(product, variant)}</p>
              )}
              <p className="num mt-1 text-xs text-subtle">
                ₹{formatPrice(variant.perSqFt > 0 ? variant.perSqFt : variant.price)}
                {variant.perSqFt > 0 ? "/sq ft" : `/${variant.packUnit}`}
                {variant.coverage > 0 && ` · ${variant.coverage} sq ft/${variant.packUnit}`}
              </p>
            </div>
          </div>

          {product.variants.length > 1 && (
            <div className="border-b border-line py-5">
              <VariantOptions
                product={product}
                variant={variant}
                onChoose={onVariant}
                columns={1}
              />
            </div>
          )}

          {/* The calculator itself, borderless here -- the sheet already IS the panel, and a
              bordered card inside a bordered sheet is two frames around one thing. */}
          <div className="border-b border-line py-5">
            <AreaCalculator
              variant={variant}
              area={area}
              boxes={boxes}
              wastage={wastage}
              onArea={onArea}
              onBoxes={onBoxes}
              onWastage={onWastage}
              bare
            />

            {/* "You have asked for more boxes than we hold" belongs HERE now -- this is where a box
                count is chosen, and it is worth knowing before the order is placed rather than after
                it ships short. Nothing renders when inventory is untracked. */}
            {stockNote && <p className="mt-3.5 text-xs font-medium text-warn">{stockNote}</p>}
          </div>
        </div>

        {/* CONFIRM. Pinned to the bottom of the sheet and carrying the total, because the total is
            the thing being confirmed. */}
        <div className="shrink-0 border-t border-line bg-surface px-5 py-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] lg:pb-4">
          <div className="num mb-3 flex items-baseline justify-between text-sm">
            <span className="text-subtle">
              {boxes} {variant.packUnit}
              {boxes === 1 ? "" : variant.packUnit === "box" ? "es" : "s"}
              {variant.coverage > 0 && ` · covers ${areaForBoxes(boxes, variant.coverage)} sq ft`}
            </span>
            {/* Repeated here rather than left to the buy box: this is the figure being confirmed,
                and it is the last number the customer reads before paying. */}
            <span className="text-base font-semibold text-ink">
              ₹{formatPrice(total)}
              <span className="text-xs font-normal text-subtle"> incl. GST</span>
            </span>
          </div>

          <button
            type="button"
            onClick={onConfirm}
            disabled={busy || !variant.inStock}
            className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-sm bg-action py-3.5 text-xs uppercase tracking-wide text-on-action transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {busy ? (
              <Loader2 size={15} strokeWidth={2} className="animate-spin" />
            ) : status === "added" ? (
              <Check size={15} strokeWidth={2} />
            ) : null}
            {!variant.inStock
              ? "Made to order"
              : busy
                ? "Adding"
                : "Add to cart & continue"}
            {!busy && status !== "added" && variant.inStock && (
              <ArrowRight size={15} strokeWidth={1.75} />
            )}
          </button>

          {failed && <p className="mt-2.5 text-xs text-bad">{status}</p>}
        </div>
      </SheetContent>
    </Sheet>
  );
}
