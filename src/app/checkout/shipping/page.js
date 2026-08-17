"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useDispatch, useSelector } from "react-redux";
import Image from "next/image";
import { ArrowRight, ChevronLeft, Loader2, Pencil, Plus, Truck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  createCustomerAddress,
  fetchCustomerAddresses,
  updateCustomerAddress,
} from "@/lib/api";
import { gtmCheckout, pushBeginCheckout } from "@/lib/gtm";
import { openAuthModal } from "@/redux/features/user/userSlice";
import { syncCart } from "@/redux/features/cart/cartSlice";
import { useRehydrated } from "@/hooks/useRehydrated";
import { Checkbox } from "@/components/ui/checkbox";
import { DELIVERY_OPTIONS, GST_RATE, unloadingCharge } from "@/lib/delivery-charges";
import StickyCta from "@/components/checkout/StickyCta";
import { formatPrice } from "@/utils/formatPrice";

const PROPERTY_TYPES = [
  { value: "apartment", label: "Apartment" },
  { value: "independent_house", label: "Independent house" },
  { value: "villa", label: "Villa" },
  { value: "office", label: "Office" },
  { value: "site", label: "Site / under construction" },
  { value: "other", label: "Other" },
];

const EMPTY = {
  firstName: "",
  lastName: "",
  address1: "",
  address2: "",
  city: "",
  province: "Maharashtra",
  zip: "",
  phone: "",
  country: "India",
  propertyType: "apartment",
  floor: "",
  liftAvailable: null,
};

const FIELDS = [
  { key: "firstName", label: "First name", half: true },
  { key: "lastName", label: "Last name", half: true },
  { key: "address1", label: "Flat / building / street" },
  { key: "address2", label: "Area / landmark (optional)" },
  { key: "city", label: "City", half: true },
  { key: "zip", label: "PIN code", half: true, numeric: true, max: 6 },
  { key: "province", label: "State", half: true },
  { key: "phone", label: "Phone", half: true, numeric: true, max: 10 },
];

/**
 * The postal fields, shared by the delivery form and the billing one.
 *
 * `idPrefix` keeps the two sets of labels pointing at their own inputs when both are open at once --
 * duplicate ids would make clicking a billing label focus the delivery field above it.
 *
 * The floor / lift fieldset is NOT here. It prices the carry, and nobody carries anything to a
 * billing address; asking a customer which floor their accountant is on is how a checkout starts
 * feeling like paperwork.
 */
function AddressFields({ idPrefix, form, setForm }) {
  return (
    <div className="mt-4 grid gap-4 sm:grid-cols-2">
      {FIELDS.map(({ key, label, half, numeric, max }) => (
        <div key={key} className={`flex flex-col gap-2 ${half ? "" : "sm:col-span-2"}`}>
          <Label htmlFor={`${idPrefix}-${key}`}>{label}</Label>
          <Input
            id={`${idPrefix}-${key}`}
            className={numeric ? "num" : ""}
            inputMode={numeric ? "numeric" : undefined}
            maxLength={max}
            value={form[key] ?? ""}
            onChange={(e) =>
              setForm({
                ...form,
                [key]: numeric ? e.target.value.replace(/\D/g, "") : e.target.value,
              })
            }
          />
        </div>
      ))}
    </div>
  );
}

/**
 * Step one of our own checkout: where it goes, and how it gets in.
 *
 * THIS IS THE REASON THE CHECKOUT IS OURS. Shopify's hosted checkout collects its own address and
 * has nowhere to put a floor or a lift, so it cannot quote what it costs to carry 900 kg of tile to
 * the fourth floor -- it would ask for the address a second time and still not know. Those three
 * answers are the whole justification for owning this page.
 */
export default function ShippingPage() {
  const router = useRouter();
  const dispatch = useDispatch();
  const rehydrated = useRehydrated();

  const accessToken = useSelector((state) => state.user.accessToken);
  const user = useSelector((state) => state.user.user);
  const isAuthenticated = useSelector((state) => state.user.isAuthenticated);
  const { items, totalAmount, totalQuantity, totalWeightKg, appliedCoupon } = useSelector(
    (state) => state.cart,
  );

  // Contact details ride with the order. Prefilled from the account -- the customer already gave us
  // these at signup, and asking again is the friction that makes people abandon a checkout.
  const [contact, setContact] = useState({ email: "", phone: "" });
  const [deliveryOption, setDeliveryOption] = useState("doorstep");
  const [gst, setGst] = useState({ wanted: false, gstin: "", company: "" });

  const [addresses, setAddresses] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  // Same as delivery until told otherwise -- true for nearly every order, and the exception (a
  // contractor billing a registered office for tiles going to a site) is exactly the customer who
  // also ticks the GST box below.
  const [billingSame, setBillingSame] = useState(true);
  const [billingId, setBillingId] = useState(null);
  const [billingAdding, setBillingAdding] = useState(false);
  const [billingForm, setBillingForm] = useState(EMPTY);
  const [form, setForm] = useState(EMPTY);
  const [adding, setAdding] = useState(false);
  // The id being edited, or null when the same form is adding a new address. One form, two verbs.
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    dispatch(syncCart());
  }, [dispatch]);

  /**
   * begin_checkout, on ARRIVING at this step -- not on the button that led here.
   *
   * The jewelry build fires it from the cart page's CTA handler, which counts a customer who
   * clicked and then bounced on the address form as having begun a checkout. This step is the
   * first screen of the checkout; reaching it is what beginning one means, and the number then
   * matches what the funnel report shows between cart and shipping.
   *
   * Waits for the cart, because the sync above lands a moment after mount and an event fired off
   * the rehydrated snapshot would carry last session's lines. Once per visit, via the ref -- the
   * cart re-renders this page every time an address loads.
   */
  const beganRef = useRef(false);
  useEffect(() => {
    if (beganRef.current || !rehydrated || items.length === 0) return;
    beganRef.current = true;
    pushBeginCheckout(
      gtmCheckout({
        items,
        value: totalAmount,
        coupon: appliedCoupon?.code,
        checkout_step: "shipping",
      }),
    );
  }, [rehydrated, items, totalAmount, appliedCoupon]);

  // Checkout requires an account: PPCOD is credit extended on delivery, so an order has to be
  // attached to a verified phone number.
  useEffect(() => {
    if (rehydrated && !isAuthenticated) {
      dispatch(openAuthModal({ redirectPath: "/checkout/shipping", source: "checkout" }));
      router.replace("/checkout/cart");
    }
  }, [rehydrated, isAuthenticated, dispatch, router]);

  const load = useCallback(async () => {
    if (!accessToken) return;
    try {
      const data = await fetchCustomerAddresses(accessToken);
      const list = data?.addresses || [];
      setAddresses(list);

      // Keep the current choice ONLY if it is still in the list. `current || fallback` was wrong:
      // Shopify mints a NEW id every time an address is edited, so after a save the old id is dead
      // but still truthy — it kept the selection, no radio matched it, and the page looked like it
      // had nothing selected while `proceed()` happily carried a dead id to payment.
      const stillThere = (id) => Boolean(id) && list.some((a) => a.id === id);
      // The default is only a default if it is one of the addresses on screen. A customer address
      // id carries the session's access token inside it, so a defaultAddressId that does not match
      // any node would select nothing at all -- the fallback has to be checked, not assumed.
      const fallback = stillThere(data?.defaultAddressId)
        ? data.defaultAddressId
        : list[0]?.id || null;
      // Default address first, else the first one, else make them choose.
      setSelectedId((current) => (stillThere(current) ? current : fallback));
      setBillingId((current) => (stillThere(current) ? current : null));
      setAdding(list.length === 0);
    } catch (err) {
      setError(err?.message || "Could not load your addresses");
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    load();
  }, [load]);

  // Autofill from the signed-in customer, once, without clobbering anything typed since.
  useEffect(() => {
    if (!user) return;
    setContact((c) => ({
      email: c.email || user.email || "",
      phone: c.phone || String(user.mobile || "").replace(/^91/, ""),
    }));
    setForm((f) =>
      f.firstName || f.lastName
        ? f
        : {
            ...f,
            firstName: user.first_name || (user.name || "").split(" ")[0] || "",
            lastName: user.last_name || (user.name || "").split(" ").slice(1).join(" "),
            phone: f.phone || String(user.mobile || "").replace(/^91/, ""),
          },
    );
  }, [user]);

  const selectedAddress = addresses.find((a) => a.id === selectedId) || null;

  const unloadingQuote = unloadingCharge({
    option: deliveryOption,
    weightKg: totalWeightKg,
    floor: selectedAddress?.floor,
    liftAvailable: selectedAddress?.liftAvailable,
  });

  // Shopify prices are GST-INCLUSIVE (an Indian storefront quotes what you pay). So the tax line is
  // extracted from the total rather than added on top -- adding 18% to a tax-inclusive price would
  // overcharge every order by 18%.
  const taxableBase = Math.round((totalAmount / (1 + GST_RATE)) * 100) / 100;
  const gstAmount = Math.round((totalAmount - taxableBase) * 100) / 100;
  const payableNow = totalAmount + (unloadingQuote.needsConfirmation ? 0 : unloadingQuote.amount);

  // One save for both forms. Which one called it only decides where the new id lands -- the address
  // book itself is shared, so an address added as a billing address is there next time either list
  // is drawn.
  const saveAddress = async (which) => {
    const billing = which === "billing";
    const draft = billing ? billingForm : form;

    setError(null);
    if (!draft.firstName.trim()) return setError("Please enter a name");
    if (!draft.address1.trim()) return setError("Please enter the street address");
    if (!draft.city.trim()) return setError("Please enter the city");
    if (!/^\d{6}$/.test(String(draft.zip))) return setError("PIN code must be 6 digits");
    if (!/^[6-9]\d{9}$/.test(String(draft.phone))) return setError("Enter a valid 10-digit phone");

    setBusy(true);
    try {
      const payload = { ...draft, floor: draft.floor === "" ? null : Number(draft.floor) };
      // Editing only ever applies to the delivery form -- the billing one is add-only.
      const created =
        !billing && editingId
          ? await updateCustomerAddress({ addressId: editingId, address: payload }, accessToken)
          : await createCustomerAddress(
              // A billing address is never made the default delivery address, even as the first
              // one saved.
              { address: payload, makeDefault: !billing && addresses.length === 0 },
              accessToken,
            );
      setEditingId(null);
      if (billing) {
        setBillingForm(EMPTY);
        setBillingAdding(false);
      } else {
        setForm(EMPTY);
        setAdding(false);
      }
      await load();
      const id = created?.address?.id;
      if (id) {
        (billing ? setBillingId : setSelectedId)(id);
        // Shopify mints a new id on update, so anything else pointing at the old one is now
        // pointing at nothing.
        if (editingId && billingId === editingId) setBillingId(id);
      }
    } catch (err) {
      setError(err?.message || "Could not save the address");
    } finally {
      setBusy(false);
    }
  };

  const proceed = () => {
    if (!selectedId) return setError("Choose a delivery address");
    if (!billingSame && !billingId) return setError("Choose a billing address");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.email)) return setError("Enter a valid email for the invoice");
    if (!/^[6-9]\d{9}$/.test(contact.phone)) return setError("Enter a valid 10-digit phone");
    if (gst.wanted && !/^[0-9A-Z]{15}$/.test(gst.gstin.toUpperCase())) {
      return setError("A GSTIN is 15 characters, like 27AAAAA0000A1Z5");
    }

    const query = new URLSearchParams({
      address: selectedId,
      billing: billingSame ? selectedId : billingId,
      delivery: deliveryOption,
      email: contact.email,
      phone: contact.phone,
      ...(gst.wanted ? { gstin: gst.gstin.toUpperCase(), company: gst.company } : {}),
    });
    router.push(`/checkout/payment?${query}`);
  };

  if (!rehydrated || loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="size-5 animate-spin text-subtle" />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="container-main py-16 text-center">
        <p className="text-sm text-subtle">Your cart is empty.</p>
        <Link href="/" className="mt-6 inline-block text-sm text-action-ink underline underline-offset-2">
          Browse materials
        </Link>
      </div>
    );
  }

  return (
    <div className="container-main py-8 max-lg:pb-28 lg:py-12">
      <Link
        href="/checkout/cart"
        className="inline-flex items-center gap-1 text-sm text-subtle hover:text-ink"
      >
        <ChevronLeft size={16} strokeWidth={1.75} />
        Back to cart
      </Link>

      <div className="mt-5 grid gap-8 lg:grid-cols-12 lg:gap-10">
        <div className="lg:col-span-7">
          <h1 className="font-display text-xl text-ink lg:text-2xl">Delivery details</h1>

          {error && <p className="mt-4 text-sm text-bad">{error}</p>}

          {/* Contact, prefilled from the account. Present and editable rather than assumed: the
              invoice goes to this email and the driver calls this number, and the one on file is not
              always the one for this delivery. */}
          <section className="mt-5 border border-line bg-surface p-4 lg:p-5">
            <h2 className="text-sm font-medium text-ink">Contact</h2>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="c-email">Email</Label>
                <Input
                  id="c-email"
                  type="email"
                  value={contact.email}
                  onChange={(e) => setContact({ ...contact, email: e.target.value })}
                />
                <p className="text-xs text-meta">Your invoice and order updates.</p>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="c-phone">Phone</Label>
                <div className="flex items-stretch">
                  <span className="num flex items-center border border-r-0 border-line-2 bg-paper px-3 text-sm text-subtle">
                    +91
                  </span>
                  <Input
                    id="c-phone"
                    className="num rounded-l-none"
                    inputMode="numeric"
                    maxLength={10}
                    value={contact.phone}
                    onChange={(e) =>
                      setContact({ ...contact, phone: e.target.value.replace(/\D/g, "") })
                    }
                  />
                </div>
                <p className="text-xs text-meta">The driver calls this before delivery.</p>
              </div>
            </div>
          </section>

          <h2 className="mt-7 text-sm font-medium text-ink">Delivery address</h2>

          {addresses.length > 0 && (
            <ul className="mt-5 flex flex-col gap-3">
              {addresses.map((address) => (
                <li key={address.id} className="relative">
                  {/* Outside the <label>, deliberately: a button inside it is still a click on the
                      label, so editing an address would silently select it for delivery too. */}
                  <button
                    type="button"
                    onClick={() => {
                      setEditingId(address.id);
                      setForm({
                        ...EMPTY,
                        ...address,
                        floor: address.floor ?? "",
                        propertyType: address.propertyType || "apartment",
                      });
                      setAdding(true);
                      setError(null);
                    }}
                    className="absolute right-3 top-3 z-10 inline-flex items-center gap-1 text-xs text-subtle underline underline-offset-2 hover:text-ink"
                  >
                    <Pencil size={12} strokeWidth={1.75} />
                    Edit
                  </button>
                  <label
                    className={`flex cursor-pointer gap-3 border p-4 pr-16 transition-colors ${
                      selectedId === address.id
                        ? "border-ink bg-surface"
                        : "border-line bg-surface hover:border-line-strong"
                    }`}
                  >
                    <input
                      type="radio"
                      name="address"
                      checked={selectedId === address.id}
                      onChange={() => setSelectedId(address.id)}
                      className="mt-1 size-4 shrink-0 accent-[var(--action)]"
                    />
                    <span className="min-w-0 text-sm">
                      <span className="block text-ink">
                        {[address.firstName, address.lastName].filter(Boolean).join(" ")}
                      </span>
                      <span className="mt-0.5 block leading-relaxed text-subtle">
                        {[address.address1, address.address2, address.city]
                          .filter(Boolean)
                          .join(", ")}
                        <br />
                        {address.province} <span className="num">{address.zip}</span>
                        {address.phone ? (
                          <>
                            {" · "}
                            <span className="num">{address.phone}</span>
                          </>
                        ) : null}
                      </span>

                      {/* The bit Shopify's checkout can never show. */}
                      {(address.floor !== null || address.liftAvailable !== null) && (
                        <span className="mt-1.5 block text-xs text-meta">
                          {[
                            address.floor === 0
                              ? "Ground floor"
                              : address.floor
                                ? `Floor ${address.floor}`
                                : null,
                            address.liftAvailable === true
                              ? "lift available"
                              : address.liftAvailable === false
                                ? "no lift"
                                : null,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </span>
                      )}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          )}

          {adding ? (
            <div className="mt-4 border border-line bg-surface p-4 lg:p-5">
              <h2 className="font-display text-base text-ink">
                {editingId ? "Edit delivery address" : "Add a delivery address"}
              </h2>

              <AddressFields idPrefix="s" form={form} setForm={setForm} />

              <fieldset className="mt-6 border-t border-line pt-5">
                <legend className="sr-only">Delivery access</legend>
                <p className="text-sm font-medium text-ink">Getting it to you</p>
                <p className="mt-0.5 text-xs text-meta">
                  Materials are heavy. These decide the delivery charge, quoted before you pay.
                </p>

                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="s-propertyType">Property type</Label>
                    <select
                      id="s-propertyType"
                      value={form.propertyType ?? ""}
                      onChange={(e) => setForm({ ...form, propertyType: e.target.value })}
                      className="h-9 border border-line-2 bg-surface px-3 text-sm text-ink"
                    >
                      {PROPERTY_TYPES.map((t) => (
                        <option key={t.value} value={t.value}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex flex-col gap-2">
                    <Label htmlFor="s-floor">Floor</Label>
                    <Input
                      id="s-floor"
                      className="num"
                      inputMode="numeric"
                      placeholder="0 for ground"
                      maxLength={3}
                      value={form.floor ?? ""}
                      onChange={(e) =>
                        setForm({ ...form, floor: e.target.value.replace(/\D/g, "") })
                      }
                    />
                  </div>
                </div>

                <div className="mt-4 flex flex-col gap-2">
                  <span className="text-sm text-ink">Is there a working lift?</span>
                  <div className="flex gap-2">
                    {[
                      { value: true, label: "Yes" },
                      { value: false, label: "No" },
                    ].map((option) => (
                      <button
                        key={option.label}
                        type="button"
                        onClick={() => setForm({ ...form, liftAvailable: option.value })}
                        className={`min-w-[84px] border px-4 py-2 text-sm transition-colors ${
                          form.liftAvailable === option.value
                            ? "border-ink bg-ink text-paper"
                            : "border-line-2 bg-surface text-subtle hover:text-ink"
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>
              </fieldset>

              <div className="mt-5 flex items-center gap-3">
                <Button onClick={() => saveAddress("delivery")} disabled={busy}>
                  {busy ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : editingId ? (
                    "Save changes"
                  ) : (
                    "Save address"
                  )}
                </Button>
                {addresses.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setAdding(false);
                      setEditingId(null);
                      setForm(EMPTY);
                      setError(null);
                    }}
                    className="text-sm text-subtle hover:text-ink"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => {
                setEditingId(null);
                setForm(EMPTY);
                setAdding(true);
              }}
              className="mt-4 flex w-full items-center justify-center gap-2 border border-dashed border-line-2 bg-paper py-3.5 text-sm text-subtle transition-colors hover:border-ink hover:text-ink"
            >
              <Plus size={16} strokeWidth={1.6} />
              Add another address
            </button>
          )}
          {/* ===================== BILLING ===================== */}
          {/* Ticked by default, because it is true for nearly every order and an unticked box here
              would make every customer fill an address twice. Unticking picks from the SAME address
              book rather than opening a second form: anything typed here would have to be saved
              somewhere, and the customer already has a place where their addresses live. */}
          <section className="mt-4 border border-line bg-surface p-4 lg:p-5">
            <label className="flex items-start gap-2.5">
              <Checkbox
                checked={billingSame}
                onCheckedChange={(v) => {
                  const same = Boolean(v);
                  setBillingSame(same);
                  // Only the delivery address on file means there is nothing to pick between, so
                  // unticking opens the form rather than a one-option dropdown. Re-ticking closes
                  // it again -- a form nobody can see must not keep the Continue button disabled.
                  setBillingAdding(same ? false : addresses.length < 2);
                  if (same) setError(null);
                }}
                className="mt-0.5"
              />
              <span className="text-sm text-ink">
                Billing address is the same as the delivery address
                <span className="mt-0.5 block text-xs text-meta">
                  Uncheck if the invoice goes elsewhere — a registered office, for instance.
                </span>
              </span>
            </label>

            {!billingSame && (
              <div className="mt-4 flex flex-col gap-3">
                {/* Saved addresses first, because a repeat customer's office is already here and
                    picking it is one click. Typing a new one happens right below, in this section --
                    sending someone back up to the delivery form to add a BILLING address, and then
                    back down to select it, is three steps for what should be one. */}
                {addresses.length > 0 && !billingAdding && (
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="billing-address">Billing address</Label>
                    <select
                      id="billing-address"
                      value={billingId ?? ""}
                      onChange={(e) => setBillingId(e.target.value || null)}
                      className="h-9 border border-line-2 bg-surface px-3 text-sm text-ink"
                    >
                      <option value="">Select an address</option>
                      {addresses.map((address) => (
                        <option key={address.id} value={address.id}>
                          {[address.address1, address.city, address.zip].filter(Boolean).join(", ")}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {billingAdding ? (
                  <div className="border border-line bg-paper p-4">
                    <h3 className="font-display text-base text-ink">Add a billing address</h3>
                    <AddressFields idPrefix="b" form={billingForm} setForm={setBillingForm} />
                    <div className="mt-5 flex items-center gap-3">
                      <Button onClick={() => saveAddress("billing")} disabled={busy}>
                        {busy ? <Loader2 className="size-4 animate-spin" /> : "Save address"}
                      </Button>
                      {addresses.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setBillingAdding(false)}
                          className="text-sm text-subtle hover:text-ink"
                        >
                          Cancel
                        </button>
                      )}
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setBillingAdding(true)}
                    className="flex w-full items-center justify-center gap-2 border border-dashed border-line-2 bg-paper py-3 text-sm text-subtle transition-colors hover:border-ink hover:text-ink"
                  >
                    <Plus size={16} strokeWidth={1.6} />
                    Use a different address
                  </button>
                )}
              </div>
            )}
          </section>

          {/* ===================== HOW IT GETS IN ===================== */}
          <section className="mt-7 border border-line bg-surface p-4 lg:p-5">
            <h2 className="flex items-center gap-2 text-sm font-medium text-ink">
              <Truck size={16} strokeWidth={1.6} className="text-subtle" />
              Delivery option
            </h2>

            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              {Object.values(DELIVERY_OPTIONS).map((option) => {
                const quote = unloadingCharge({
                  option: option.id,
                  weightKg: totalWeightKg,
                  floor: selectedAddress?.floor,
                  liftAvailable: selectedAddress?.liftAvailable,
                });
                const active = deliveryOption === option.id;

                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setDeliveryOption(option.id)}
                    className={`flex-1 border p-3.5 text-left transition-colors ${
                      active ? "border-ink bg-paper" : "border-line bg-surface hover:border-line-strong"
                    }`}
                  >
                    <span className="flex items-baseline justify-between gap-2">
                      <span className="text-sm text-ink">{option.label}</span>
                      <span className="num text-sm font-semibold text-ink">
                        {option.free
                          ? "Free"
                          : quote.needsConfirmation
                            ? "On confirmation"
                            : `₹${formatPrice(quote.amount)}`}
                      </span>
                    </span>
                    <span className="mt-1 block text-xs leading-snug text-subtle">{option.blurb}</span>
                    {!option.free && (
                      <span className="num mt-1 block text-xs text-meta">{quote.basis}</span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* The honest case: without a floor and a lift answer we cannot price the carry, and a
                guess is either an overcharge or a crew arriving short-handed. */}
            {deliveryOption === "doorstep" && unloadingQuote.needsConfirmation && (
              <p className="mt-3 text-xs text-warn">
                Add the floor and lift details to your address and we can quote this now. Otherwise
                our team confirms the unloading charge before dispatch.
              </p>
            )}
          </section>

          {/* ===================== GST ===================== */}
          <section className="mt-4 border border-line bg-surface p-4 lg:p-5">
            <label className="flex items-start gap-2.5">
              <Checkbox
                checked={gst.wanted}
                onCheckedChange={(v) => setGst({ ...gst, wanted: Boolean(v) })}
                className="mt-0.5"
              />
              <span className="text-sm text-ink">
                I need a GST invoice
                <span className="mt-0.5 block text-xs text-meta">
                  For businesses and contractors claiming input credit.
                </span>
              </span>
            </label>

            {gst.wanted && (
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="g-gstin">GSTIN</Label>
                  <Input
                    id="g-gstin"
                    className="num uppercase"
                    maxLength={15}
                    placeholder="27AAAAA0000A1Z5"
                    value={gst.gstin}
                    onChange={(e) => setGst({ ...gst, gstin: e.target.value.toUpperCase() })}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="g-company">Registered business name</Label>
                  <Input
                    id="g-company"
                    value={gst.company}
                    onChange={(e) => setGst({ ...gst, company: e.target.value })}
                  />
                </div>
              </div>
            )}
          </section>
        </div>

        {/* ================================= SUMMARY ================================= */}
        <div className="lg:col-span-5">
          <div className="border border-line bg-surface p-5 lg:sticky lg:top-8">
            <h2 className="text-sm font-medium text-ink">
              Your order
              <span className="ml-1 font-normal text-subtle">
                ({totalQuantity} {totalQuantity === 1 ? "item" : "items"})
              </span>
            </h2>

            {/* Pictures, not a bare number. Fifteen boxes of tile is a large sum to confirm, and the
                customer should be able to SEE what they are about to pay for without going back. */}
            <ul className="mt-4 flex flex-col gap-3">
              {items.map((item) => (
                <li key={item.lineId} className="flex gap-3">
                  <span className="relative block aspect-swatch w-14 shrink-0 overflow-hidden border border-line bg-paper">
                    {item.image && (
                      <Image src={item.image} alt="" fill sizes="56px" className="object-cover" />
                    )}
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="line-clamp-2 text-xs leading-snug text-ink">{item.title}</span>
                    <span className="num mt-0.5 text-xs text-meta">
                      {item.quantity} × ₹{formatPrice(item.price)}
                    </span>
                  </span>
                  <span className="num shrink-0 text-sm text-ink">₹{formatPrice(item.total)}</span>
                </li>
              ))}
            </ul>

            <dl className="num mt-4 flex flex-col gap-1.5 border-t border-line pt-4 text-sm">
              <div className="flex items-baseline justify-between text-subtle">
                <dt>Subtotal</dt>
                <dd>₹{formatPrice(taxableBase)}</dd>
              </div>
              {/* GST shown as its own line rather than folded into the price -- a contractor
                  claiming input credit needs to see the number, and hiding it invites the
                  "is this inclusive?" phone call. */}
              <div className="flex items-baseline justify-between text-subtle">
                <dt>GST (18%)</dt>
                <dd>₹{formatPrice(gstAmount)}</dd>
              </div>
              <div className="flex items-baseline justify-between text-subtle">
                <dt>
                  {DELIVERY_OPTIONS[deliveryOption].label} delivery
                  {totalWeightKg > 0 && (
                    <span className="ml-1 text-meta">· {totalWeightKg} kg</span>
                  )}
                </dt>
                <dd>
                  {deliveryOption === "ground"
                    ? "Free"
                    : unloadingQuote.needsConfirmation
                      ? "On confirmation"
                      : `₹${formatPrice(unloadingQuote.amount)}`}
                </dd>
              </div>

              <div className="mt-2 flex items-baseline justify-between border-t border-line pt-3 text-ink">
                <dt className="text-base">Total</dt>
                <dd className="text-lg font-semibold">₹{formatPrice(payableNow)}</dd>
              </div>
            </dl>

            {unloadingQuote.needsConfirmation && deliveryOption === "doorstep" && (
              <p className="mt-2 text-xs text-meta">
                Unloading is billed separately once confirmed.
              </p>
            )}

            <StickyCta
              note={
                <p className="num mt-2 text-center text-xs text-meta">
                  Total ₹{formatPrice(payableNow)}
                </p>
              }
            >
              <Button
                onClick={proceed}
                // Belt and braces: the billing form only blocks Continue while it is actually on
                // screen, which it is not once billing is back to "same as delivery".
                disabled={!selectedId || adding || (!billingSame && billingAdding)}
                className="w-full lg:mt-5"
              >
                Continue to payment
                <ArrowRight size={15} strokeWidth={1.75} />
              </Button>
            </StickyCta>
          </div>
        </div>
      </div>
    </div>
  );
}
