"use client";

import { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Check, MapPin, Truck, X } from "lucide-react";

import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { useHasMounted } from "@/hooks/useHasMounted";
import { checkPincode } from "@/lib/delivery";
import { selectPincode, setPincode } from "@/redux/features/user/userSlice";

/**
 * "Deliver to 400001" in the header -- CaratLane's slot, and their reasoning.
 *
 * WHY IT BELONGS IN THE HEADER AND NOT ONLY ON THE PDP. The PDP's PincodeCheck answers the question
 * for one product, at the point of buying. This answers it for the whole visit, before any product
 * is chosen: a customer in Pune should learn that on the homepage, not after picking a tile, reading
 * the specs and calculating their area. Every minute spent shopping a shop that cannot deliver to
 * you is a minute that ends in a bounce, and the header is the only place on every page.
 *
 * IT SHARES ONE VALUE with the PDP and the buy sheet -- `state.user.pincode`, persisted to
 * localStorage and, once signed in, to the customer's `custom.pincode` metafield (see
 * redux/pincodeListener.js). Typing it here means never typing it again, which is the entire promise
 * and the only reason a customer bothers the first time.
 *
 * NOT A MODAL ON ARRIVAL. CaratLane auto-opens this and caps it at one per session
 * (`max_pincode_popup_per_session` in their localStorage). They can afford it -- the pincode unlocks
 * four things for them, listed in their own popup: delivery date, Try-at-Home, nearest store,
 * in-store design. Ours unlocks one sentence about serviceability, which does not earn an
 * interruption on arrival. Sitting in the header, visible and unpressed, is the honest weight for it.
 */
export default function PincodeControl({ className = "", compact = false }) {
  const dispatch = useDispatch();
  const saved = useSelector(selectPincode);
  // The pincode lives in localStorage, so it does not exist server-side. Rendering it during the
  // first pass makes the markup disagree with the server -- the mistake the header already makes
  // with its wishlist count; see useRehydrated's note.
  const hasMounted = useHasMounted();
  const current = hasMounted ? saved : "";

  const isMobile = useMediaQuery("(max-width: 768px)");
  const [open, setOpen] = useState(false);
  // A DRAFT, not the store. Typing straight into `setPincode` would rewrite the PDP's delivery line
  // under the customer's own hands, one digit at a time, and briefly tell someone entering 411001
  // that we deliver to them (41 -> "410" is serviceable) before the sixth digit says otherwise.
  const [draft, setDraft] = useState(current);

  // Reopening starts from whatever is saved, not from the abandoned draft of the last visit. Seeded
  // by the opener rather than by an effect on `open` -- the effect version fired a second render
  // every time the panel appeared, and lint is right that it was synchronising nothing external.
  const openPanel = () => {
    setDraft(current);
    setOpen(true);
  };

  const result = checkPincode(draft);
  const label = current || "Set pincode";

  const commit = () => {
    if (result.status === "invalid") return;
    dispatch(setPincode(result.pincode));
    setOpen(false);
  };

  const panel = (
    <div className="flex flex-col gap-4 p-5">
      <div className="flex flex-col gap-1">
        <h2 className="font-display text-lg leading-tight text-ink">Where are we delivering?</h2>
        {/* THE PAYOFF, said before the field -- CaratLane's popup does the same thing ("Your PIN Code
            unlocks...") and it is the difference between a chore and a trade. Ours is one line
            because ours buys one thing; theirs lists four because theirs does. */}
        <p className="text-sm leading-snug text-subtle">
          Your pincode sets the delivery line on every product, so you only type it once.
        </p>
      </div>

      <div className="flex items-center gap-2 rounded-sm border border-line-strong bg-surface px-3 py-2.5 transition-colors focus-within:border-action">
        <MapPin size={15} strokeWidth={1.5} className="shrink-0 text-subtle" />
        <input
          autoFocus
          name="pincode"
          type="text"
          inputMode="numeric"
          // maxLength rather than type="number", which lets a phone paste "400-001" in.
          maxLength={6}
          value={draft}
          onChange={(e) => setDraft(e.target.value.replace(/\D/g, "").slice(0, 6))}
          onKeyDown={(e) => e.key === "Enter" && commit()}
          placeholder="6-digit pincode"
          className="num w-full min-w-0 bg-transparent text-sm text-ink outline-none placeholder:text-meta"
        />
      </div>

      {/* Silence until six digits are in: a half-typed pincode is not a wrong one. */}
      {result.status === "serviceable" && (
        <p className="flex items-start gap-2 text-xs text-good">
          <Check size={14} strokeWidth={2} className="mt-px shrink-0" />
          <span>We deliver here. Freight is quoted before you pay.</span>
        </p>
      )}
      {result.status === "outside" && (
        <p className="flex items-start gap-2 text-xs text-subtle">
          <Truck size={14} strokeWidth={1.5} className="mt-px shrink-0" />
          <span>
            Outside our Mumbai and MMR delivery area. You can still order — we will quote transport
            to you before anything is charged.
          </span>
        </p>
      )}

      {/* Enabled only once the answer exists, because that is the moment there is something to save.
          Both answers are savable: "outside" is a real answer a customer wants remembered, not an
          error to be corrected. */}
      <button
        type="button"
        onClick={commit}
        disabled={result.status === "invalid"}
        className="w-full bg-action px-4 py-2.5 text-xs uppercase tracking-wide text-on-action transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
      >
        Save pincode
      </button>
    </div>
  );

  const trigger = (
    <button
      type="button"
      onClick={openPanel}
      aria-label={current ? `Delivering to ${current}. Change pincode` : "Set your delivery pincode"}
      className={`flex items-center gap-1.5 text-left transition-colors hover:text-ink ${className}`}
    >
      <MapPin size={compact ? 18 : 15} strokeWidth={1.5} className="shrink-0" />
      {/* COMPACT is the phone: the icon alone when nothing is set, the digits beside it once
          something is. The header has no room for "Deliver to" on a 360px screen, and the six digits
          are the only part a returning customer needs to recognise. */}
      {compact ? (
        current && <span className="num text-xs font-medium text-ink">{current}</span>
      ) : (
        <span className="leading-tight">
          <span className="block text-[10px] uppercase tracking-wide text-meta">Deliver to</span>
          <span className={`block text-xs font-medium ${current ? "num text-ink" : "text-subtle"}`}>
            {label}
          </span>
        </span>
      )}
    </button>
  );

  // A bottom sheet on a phone and a small anchored panel on desktop -- the same split AuthDialog and
  // BuySheet already use, so this does not arrive as a new kind of overlay. The desktop side is a
  // plain absolutely-positioned popover rather than a Dialog: a Dialog dims the page and traps focus,
  // which is the wrong ceremony for a six-digit field launched from a header.
  // `relative` on the wrapper is load-bearing: the desktop popover below is positioned against it,
  // and without it the panel would anchor to whatever ancestor happens to be positioned -- which in
  // MainHeader is the whole bar, so it landed under the search field.
  return (
    <div className="relative shrink-0">
      {trigger}

      {isMobile ? (
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetContent side="bottom" className="bg-surface p-0">
            <SheetTitle className="sr-only">Set your delivery pincode</SheetTitle>
            {panel}
          </SheetContent>
        </Sheet>
      ) : (
        open && (
          <>
            {/* A click-catcher, not a scrim: dismissing by clicking away is expected of a popover,
                and doing it with a transparent layer means no dimming and no focus trap. */}
            <button
              type="button"
              aria-label="Close"
              onClick={() => setOpen(false)}
              className="fixed inset-0 z-[90] cursor-default"
            />
            <div className="absolute right-0 top-[calc(100%+10px)] z-[100] w-[320px] border border-line bg-surface shadow-[0_10px_32px_rgba(28,27,25,0.18)]">
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="absolute right-2 top-2 p-1 text-meta transition-colors hover:text-ink"
              >
                <X size={15} strokeWidth={1.75} />
              </button>
              {panel}
            </div>
          </>
        )
      )}
    </div>
  );
}
