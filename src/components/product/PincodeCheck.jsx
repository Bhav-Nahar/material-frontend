"use client";

import { useId } from "react";
import { Check, MapPin, Truck } from "lucide-react";

import { checkPincode } from "@/lib/delivery";
import { buildWhatsappLink } from "@/lib/whatsapp";
import { WHATSAPP_NUMBER } from "@/data/footer";

/**
 * "Do you deliver to me?" -- asked and answered on the page, which is the whole point. Material
 * Depot puts this on the PDP for the same reason: a buyer who cannot find out until checkout
 * assumes the answer is no and leaves.
 *
 * It answers SERVICEABILITY, not a date -- see the note in lib/delivery.js for why inventing
 * "delivery by Thursday" here would be a promise the shop never made. What it can say is true:
 * inside the MMR, freight quoted before you pay, and whether this variant ships from stock or is
 * made to order (that part is Shopify's own availability, not a guess).
 *
 * Controlled from ProductPage so the buy box and the buy sheet show the same answer -- a customer
 * who checked a pincode in one should not have to type it again in the other.
 *
 * ponytail: no API, no debounce, no geolocation. Six digits and a prefix test.
 */
export default function PincodeCheck({ pincode, onPincode, inStock }) {
  const result = checkPincode(pincode);
  // htmlFor/id rather than a bare <label>: the label sits OUTSIDE the bordered box (the border is on
  // a wrapper, so the input cannot be nested inside the label without the label owning the frame), and
  // an unassociated <label> is one that does not focus the field when tapped -- on a phone, where the
  // label is a bigger target than the field, that is the difference between the control working and
  // not. useId keeps it unique if this ever renders twice on one page.
  const id = useId();

  return (
    <div>
      <label htmlFor={id} className="flex items-center gap-2 text-xs font-medium text-ink">
        <MapPin size={14} strokeWidth={1.5} className="shrink-0 text-subtle" />
        Check delivery
      </label>

      {/* A BOXED field, not an underline. The underline version read as a line of text rather than
          something to type in -- on a page where every other row is also label-above-value, the one
          control the customer has to fill in was the least visible thing in the buy box. A full
          border says "field", and the focus ring is the action colour so the state change is obvious.

          There is no Check BUTTON on purpose: the answer appears the moment the sixth digit lands, so
          a button would be a click that changes nothing. */}
      <div className="mt-2 flex items-center gap-2 rounded-sm border border-line-strong bg-surface px-3 py-2.5 transition-colors focus-within:border-action">
        <input
          id={id}
          name="pincode"
          type="text"
          inputMode="numeric"
          // Six characters and digits only, so the field cannot hold something the check will
          // reject. maxLength rather than type="number", which lets a phone paste "400-001" in.
          maxLength={6}
          value={pincode}
          onChange={(e) => onPincode(e.target.value.replace(/\D/g, "").slice(0, 6))}
          placeholder="Enter 6-digit pincode"
          className="num w-full min-w-0 bg-transparent text-sm text-ink outline-none placeholder:text-meta"
        />
      </div>

      {/* Nothing is claimed until six digits are in -- a half-typed pincode gets silence, not a
          red error, because the customer is not wrong yet. */}
      {result.status === "serviceable" && (
        <div className="mt-2.5 space-y-1.5">
          <p className="flex items-start gap-2 text-xs text-good">
            <Check size={14} strokeWidth={2} className="mt-px shrink-0" />
            <span>
              We deliver to <span className="num">{result.pincode}</span>. Freight is quoted at
              checkout before you pay.
            </span>
          </p>
          <p className="flex items-start gap-2 text-xs text-subtle">
            <Truck size={14} strokeWidth={1.5} className="mt-px shrink-0" />
            {inStock ? "Held in stock — ready to ship." : "Made to order — we will confirm the lead time."}
          </p>
        </div>
      )}

      {result.status === "outside" && (
        <p className="mt-2.5 text-xs text-warn">
          We don’t deliver to <span className="num">{result.pincode}</span> yet.{" "}
          {WHATSAPP_NUMBER ? (
            <a
              href={buildWhatsappLink(WHATSAPP_NUMBER, [
                `Hi Texture House, do you deliver to ${result.pincode}?`,
              ])}
              target="_blank"
              rel="noopener noreferrer"
              className="text-action-ink underline underline-offset-4"
            >
              Ask us if we can arrange freight
            </a>
          ) : (
            "Ask us if we can arrange freight."
          )}
        </p>
      )}
    </div>
  );
}
