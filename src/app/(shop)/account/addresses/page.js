"use client";

import { useCallback, useEffect, useState } from "react";
import { useSelector } from "react-redux";
import { Loader2, Plus, Star, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  createCustomerAddress,
  deleteCustomerAddress,
  fetchCustomerAddresses,
  selectDefaultCustomerAddress,
  updateCustomerAddress,
} from "@/lib/api";

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
  // Delivery attributes, not postal ones. Shopify has nowhere to put these; the backend stores them
  // alongside the address and they are what an unloading charge gets computed from.
  propertyType: "apartment",
  floor: "",
  liftAvailable: null,
};

const PROPERTY_TYPES = [
  { value: "apartment", label: "Apartment" },
  { value: "independent_house", label: "Independent house" },
  { value: "villa", label: "Villa" },
  { value: "office", label: "Office" },
  { value: "site", label: "Site / under construction" },
  { value: "other", label: "Other" },
];

const FIELDS = [
  { key: "firstName", label: "First name", half: true },
  { key: "lastName", label: "Last name", half: true },
  { key: "address1", label: "Flat / building / street" },
  { key: "address2", label: "Area / landmark (optional)" },
  { key: "city", label: "City", half: true },
  { key: "zip", label: "PIN code", half: true, numeric: true },
  { key: "province", label: "State", half: true },
  { key: "phone", label: "Phone", half: true, numeric: true },
];

/**
 * My addresses. List, add, edit, delete, set default.
 *
 * The list is refetched after every write rather than patched in place. These are four operations
 * against a list of maybe three items -- reconciling optimistic state with Shopify's would be more
 * code than the round trip costs, and getting it wrong shows someone a delivery address that is not
 * really saved.
 */
export default function AddressesPage() {
  const accessToken = useSelector((state) => state.user.accessToken);

  const [addresses, setAddresses] = useState([]);
  const [defaultId, setDefaultId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null); // null | "new" | address id
  const [form, setForm] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    try {
      const data = await fetchCustomerAddresses(accessToken);
      setAddresses(data?.addresses || []);
      setDefaultId(data?.defaultAddressId || null);
    } catch (err) {
      setError(err?.message || "Could not load your addresses");
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    load();
  }, [load]);

  const startNew = () => {
    setForm(EMPTY);
    setEditing("new");
    setError(null);
  };

  const startEdit = (address) => {
    setForm({ ...EMPTY, ...address });
    setEditing(address.id);
    setError(null);
  };

  const save = async () => {
    setError(null);
    if (!form.address1.trim()) return setError("Please enter the street address");
    if (!form.city.trim()) return setError("Please enter the city");
    if (!/^\d{6}$/.test(String(form.zip))) return setError("PIN code must be 6 digits");

    setBusy(true);
    try {
      const payload = { ...form };
      delete payload.id; // Shopify rejects an id inside MailingAddressInput
      // "" from an untouched number field is not 0 — send null so the backend records "not asked"
      // rather than "ground floor", which are priced differently.
      payload.floor = payload.floor === "" ? null : Number(payload.floor);

      if (editing === "new") {
        // First address becomes the default automatically -- nobody wants to add one and then be
        // asked to also mark it.
        await createCustomerAddress({ address: payload, makeDefault: addresses.length === 0 }, accessToken);
      } else {
        await updateCustomerAddress({ addressId: editing, address: payload }, accessToken);
      }
      setEditing(null);
      await load();
    } catch (err) {
      setError(err?.message || "Could not save the address");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id) => {
    setBusy(true);
    setError(null);
    try {
      await deleteCustomerAddress(id, accessToken);
      await load();
    } catch (err) {
      setError(err?.message || "Could not delete the address");
    } finally {
      setBusy(false);
    }
  };

  const makeDefault = async (id) => {
    setBusy(true);
    try {
      await selectDefaultCustomerAddress(id, accessToken);
      await load();
    } catch (err) {
      setError(err?.message || "Could not set the default address");
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[240px] items-center justify-center">
        <Loader2 className="size-5 animate-spin text-subtle" />
      </div>
    );
  }

  return (
    <div>
      {error && <p className="mb-4 text-sm text-bad">{error}</p>}

      {editing ? (
        <div className="mt-5 max-w-lg border border-line bg-surface p-4 lg:p-5">
          <h3 className="font-display text-base text-ink">
            {editing === "new" ? "Add an address" : "Edit address"}
          </h3>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {FIELDS.map(({ key, label, half, numeric }) => (
              <div key={key} className={`flex flex-col gap-2 ${half ? "" : "sm:col-span-2"}`}>
                <Label htmlFor={`a-${key}`}>{label}</Label>
                <Input
                  id={`a-${key}`}
                  className={numeric ? "num" : ""}
                  inputMode={numeric ? "numeric" : undefined}
                  maxLength={key === "zip" ? 6 : key === "phone" ? 10 : undefined}
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

          {/* WHY THIS IS ON AN ADDRESS FORM. Material is sold by weight -- a 900 kg tile order carried
              up four floors without a lift is a different job from one wheeled into a ground-floor
              entrance, and it costs different money. Asking here means the freight can be quoted
              before payment instead of argued about when the van arrives. */}
          <fieldset className="mt-6 border-t border-line pt-5">
            <legend className="sr-only">Delivery access</legend>
            <p className="text-sm font-medium text-ink">Getting it to you</p>
            <p className="mt-0.5 text-xs text-meta">
              Materials are heavy. These three answers decide the delivery charge, quoted before you
              pay.
            </p>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="a-propertyType">Property type</Label>
                <select
                  id="a-propertyType"
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
                <Label htmlFor="a-floor">Floor</Label>
                <Input
                  id="a-floor"
                  className="num"
                  inputMode="numeric"
                  placeholder="0 for ground"
                  maxLength={3}
                  value={form.floor ?? ""}
                  onChange={(e) => setForm({ ...form, floor: e.target.value.replace(/\D/g, "") })}
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
              {/* Deliberately not defaulted. "Not asked" and "no lift" are different, and only one of
                  them can be priced -- guessing the cheap one is how a delivery fails on arrival. */}
              {form.liftAvailable === null && (
                <p className="text-xs text-meta">
                  Tell us and we can quote the delivery exactly. Skip it and we&apos;ll confirm by
                  phone.
                </p>
              )}
            </div>
          </fieldset>

          <div className="mt-5 flex items-center gap-3">
            <Button onClick={save} disabled={busy}>
              {busy ? <Loader2 className="size-4 animate-spin" /> : "Save address"}
            </Button>
            <button
              type="button"
              onClick={() => setEditing(null)}
              className="text-sm text-subtle hover:text-ink"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        // "Add" is a TILE in the grid, not a button floating above it. Floating right of the heading
        // it read as unrelated chrome, and the empty state then said "add one" while the only way to
        // do that sat somewhere else on the page. As a tile it is in the same place whether you have
        // no addresses or three.
        <ul className="grid gap-4 sm:grid-cols-2">
          {addresses.map((address) => (
            <li key={address.id} className="flex flex-col border border-line bg-surface p-4">
              {address.id === defaultId && (
                <span className="mb-2 flex items-center gap-1.5 text-xs text-action-ink">
                  <Star className="size-3.5 fill-current" /> Default
                </span>
              )}

              <p className="text-sm text-ink">
                {[address.firstName, address.lastName].filter(Boolean).join(" ")}
              </p>
              <p className="mt-1 text-sm leading-relaxed text-subtle">
                {[address.address1, address.address2, address.city].filter(Boolean).join(", ")}
                <br />
                {address.province} <span className="num">{address.zip}</span>
              </p>
              {address.phone && <p className="num mt-1 text-sm text-subtle">{address.phone}</p>}

              {(address.floor !== null || address.liftAvailable !== null) && (
                <p className="mt-2 text-xs text-meta">
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
                </p>
              )}

              <div className="mt-auto flex items-center gap-3 pt-4 text-xs">
                <button
                  type="button"
                  onClick={() => startEdit(address)}
                  className="text-action-ink underline underline-offset-2"
                >
                  Edit
                </button>
                {address.id !== defaultId && (
                  <button
                    type="button"
                    onClick={() => makeDefault(address.id)}
                    disabled={busy}
                    className="text-subtle hover:text-ink"
                  >
                    Set as default
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => remove(address.id)}
                  disabled={busy}
                  className="ml-auto flex items-center gap-1 text-subtle hover:text-bad"
                  aria-label="Delete address"
                >
                  <Trash2 size={13} strokeWidth={1.6} />
                </button>
              </div>
            </li>
          ))}

          <li>
            <button
              type="button"
              onClick={startNew}
              className="flex h-full min-h-[136px] w-full flex-col items-center justify-center gap-2 border border-dashed border-line-2 bg-paper p-4 text-sm text-subtle transition-colors hover:border-ink hover:text-ink"
            >
              <Plus className="size-5" strokeWidth={1.6} />
              Add an address
              {addresses.length === 0 && (
                <span className="max-w-[220px] text-center text-xs text-meta">
                  Save one now and it will be filled in at checkout.
                </span>
              )}
            </button>
          </li>
        </ul>
      )}
    </div>
  );
}
