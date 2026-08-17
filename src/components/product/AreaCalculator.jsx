"use client";

import { useId } from "react";
import { Check, Minus, Plus } from "lucide-react";
import { boxesForArea, areaForBoxes } from "@/lib/product";
import { formatPrice } from "@/utils/formatPrice";

/**
 * "How much do you need" -- area in, boxes out.
 *
 * This is the one thing Material Depot's PDP does that a jewelry PDP has no equivalent of, and it
 * is the reason their page converts: nobody buys 15 boxes, they buy a 200 sq ft floor. Theirs sits
 * behind a "Calculate How Much You Want >" link that opens a right-hand drawer.
 *
 * Ours is INLINE, and says more:
 *
 *   - Not in a drawer. Theirs hides the single most useful control on the page behind a click, and
 *     on a phone the drawer covers the price it is calculating. There is nothing here that needs
 *     560px of overlay -- it is two fields and a checkbox.
 *   - It shows the TOTAL. Theirs shows boxes and stops, so the customer types 200, reads "15 Box",
 *     and still has to do 15 x 1844.50 in their head before deciding.
 *   - It shows what those boxes actually COVER. 15 boxes of 15.5 sq ft cover 232.5, not 200, and a
 *     customer who is told that does not ring up asking why they were sent extra.
 *
 * ponytail: no debounce, no useMemo. Two multiplications on keystroke.
 */
export default function AreaCalculator({
  variant,
  area,
  boxes,
  wastage,
  onArea,
  onBoxes,
  onWastage,
  // Inside BuySheet the sheet IS the panel, so the card frame and the redundant heading come off.
  // A bordered card inside a bordered sheet is two frames around one thing.
  bare = false,
}) {
  const { coverage, price, packUnit } = variant;
  const boxesId = useId();

  // Without coverage there is no area to calculate from -- the product is simply sold by the pack,
  // and a quantity stepper is the honest control. mapProducts makes the same call for the card.
  const hasCoverage = coverage > 0;

  const total = boxes * price;
  const covers = areaForBoxes(boxes, coverage);

  const setArea = (raw) => {
    onArea(raw);
    const parsed = Number(raw);
    if (parsed > 0) onBoxes(boxesForArea(parsed, coverage, wastage ? 0.1 : 0));
  };

  // Editing the box count writes the covered area back into the area field, so the two always
  // agree (user, 2026-08-13). It used to CLEAR that field on the grounds that a box count maps to
  // a range of areas -- 14.1 and 15.5 sq ft are both one box of 15.5 -- so no single number is
  // "the" area. True, but a field that empties itself the moment you touch its neighbour reads as
  // broken, and of the numbers in that range exactly one is meaningful: what the boxes cover.
  //
  // The old worry was that a written-back guess would re-derive the box count on the next wastage
  // toggle and creep upwards. It cannot: toggleWastage only READS area, it never writes it, so a
  // toggle moves the box count and stops. Typing 25 boxes puts 322 in the field; ticking wastage
  // then reads that as "cover 322 plus 10%" and asks for 28, which is what the tickbox says.
  //
  // The written-back area deliberately carries NO wastage, so it is what the boxes cover and
  // nothing more. That is why the tickbox now starts unticked (see ProductPage): ticked-by-default
  // plus a hand-typed box count meant unticking re-derived the count it already had and appeared
  // to do nothing.
  // A WHOLE number goes in the field (user, 2026-08-13): nobody types "335.4 sq ft", and a field
  // that fills itself with a decimal reads as machine output rather than something you can edit.
  // Rounded DOWN, never up: 26 boxes cover 335.4, and 336 re-derives as 27 on the next wastage
  // toggle -- the box-at-a-time creep this write-back has to avoid. Down is always safe while a
  // box covers at least 1 sq ft, and the re-derive check below is what makes that an assertion
  // rather than an assumption -- a sample pack covering half a square foot keeps its decimal
  // instead of rounding to zero.
  const wholeArea = (count) => {
    const covered = areaForBoxes(count, coverage);
    const whole = Math.floor(covered);
    return boxesForArea(whole, coverage, 0) === count ? whole : covered;
  };

  const setBoxes = (next) => {
    const count = Math.max(1, Math.min(999, Math.floor(next) || 1));
    onBoxes(count);
    if (hasCoverage) onArea(String(wholeArea(count)));
  };

  const toggleWastage = () => {
    const next = !wastage;
    onWastage(next);
    const parsed = Number(area);
    if (parsed > 0) onBoxes(boxesForArea(parsed, coverage, next ? 0.1 : 0));
  };

  return (
    <div className={bare ? "" : "rounded-sm border border-line bg-surface p-4 lg:p-5"}>
      {!bare && (
        <h2 className="text-sm font-medium text-ink">
          {hasCoverage ? "How much do you need?" : "How many do you need?"}
        </h2>
      )}

      <div className={`flex items-end gap-3 ${bare ? "" : "mt-3"}`}>
        {hasCoverage && (
          <label className="flex-1">
            <span className="block text-[11px] uppercase tracking-wide text-subtle">Area</span>
            <span className="mt-1 flex items-baseline gap-1.5 border-b border-line-strong pb-1.5 focus-within:border-action">
              <input
                name="area"
                type="number"
                inputMode="decimal"
                min="0"
                step="any"
                value={area}
                onChange={(e) => setArea(e.target.value)}
                placeholder="0"
                aria-label="Area to cover, in square feet"
                className="num w-full min-w-0 bg-transparent text-lg text-ink outline-none placeholder:text-meta"
              />
              <span className="shrink-0 text-xs text-subtle">sq ft</span>
            </span>
          </label>
        )}

        <div className={hasCoverage ? "w-32 shrink-0" : "flex-1"}>
          {/* A real <label>, associated by id: the stepper's buttons sit either side of the field so
              it cannot be nested inside the label, and the area field beside it already gets this for
              free by wrapping its own input. */}
          <label
            htmlFor={boxesId}
            className="block text-[11px] uppercase tracking-wide text-subtle"
          >
            {packUnit === "box" ? "Boxes" : `${packUnit}s`}
          </label>
          {/* A stepper, not a bare field: whole packs are the only quantity Shopify will accept
              (proven in scripts/verify-cart.mjs), and one more box is the commonest adjustment
              a customer makes after reading the covers-line below. */}
          <span className="mt-1 flex items-center border-b border-line-strong pb-1 focus-within:border-action">
            <button
              type="button"
              onClick={() => setBoxes(boxes - 1)}
              disabled={boxes <= 1}
              aria-label="One fewer"
              className="flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center text-subtle hover:text-ink disabled:cursor-not-allowed disabled:opacity-30"
            >
              <Minus size={14} strokeWidth={2} />
            </button>
            <input
              id={boxesId}
              name="quantity"
              type="number"
              inputMode="numeric"
              min="1"
              max="999"
              value={boxes}
              onChange={(e) => setBoxes(Number(e.target.value))}
              className="num w-full min-w-0 bg-transparent text-center text-lg text-ink outline-none"
            />
            <button
              type="button"
              onClick={() => setBoxes(boxes + 1)}
              disabled={boxes >= 999}
              aria-label="One more"
              className="flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center text-subtle hover:text-ink disabled:cursor-not-allowed disabled:opacity-30"
            >
              <Plus size={14} strokeWidth={2} />
            </button>
          </span>
        </div>
      </div>

      {hasCoverage && (
        <label className="mt-4 flex cursor-pointer items-center gap-2.5 text-xs text-ink">
          <input type="checkbox" checked={wastage} onChange={toggleWastage} className="sr-only" />
          <span
            className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border ${
              wastage ? "border-action bg-action" : "border-line-strong bg-surface"
            }`}
          >
            {wastage && <Check size={11} strokeWidth={3} className="text-on-action" />}
          </span>
          Add 10% for cuts, corners and breakage
        </label>
      )}

      {/* The answer, in the customer's terms. Reads as one sentence rather than a table, because
          it IS one thought: this many boxes, covering this much, for this.

          Suppressed in `bare` mode: BuySheet's pinned confirm row already carries the same three
          figures directly above its button, which is the better place for them -- next to the thing
          they are confirming. Printing them twice in one panel reads as two different answers. */}
      <p className={`num border-t border-line pt-3 text-sm text-ink ${bare ? "hidden" : "mt-4"}`}>
        <strong className="font-semibold">
          {boxes} {packUnit}
          {boxes === 1 ? "" : packUnit === "box" ? "es" : "s"}
        </strong>
        {hasCoverage && (
          <span className="text-subtle">
            {boxes === 1 ? " covers " : " cover "}
            {covers} sq ft
          </span>
        )}
        <span className="text-subtle"> · </span>
        <strong className="font-semibold">₹{formatPrice(total)}</strong>
      </p>
    </div>
  );
}
