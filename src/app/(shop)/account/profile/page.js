"use client";

import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Check, Loader2 } from "lucide-react";

import { Skeleton } from "@/components/ui/skeleton";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiFetch, fetchCustomerProfile } from "@/lib/api";
import { updateUser } from "@/redux/features/user/userSlice";

/**
 * My profile. Name and email are editable; the mobile number is not.
 *
 * The number is the login credential and it is what the OTP was verified against -- changing it here
 * would silently move the account to a phone nobody has proved they own. It stays read-only until
 * there is a re-verification flow, which is a feature, not a field.
 */
export default function ProfilePage() {
  const dispatch = useDispatch();
  const accessToken = useSelector((state) => state.user.accessToken);
  const user = useSelector((state) => state.user.user);

  const [form, setForm] = useState({ firstName: "", lastName: "", email: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    fetchCustomerProfile(accessToken)
      .then((data) => {
        if (cancelled) return;
        const c = data?.customer || {};
        setForm({ firstName: c.firstName || "", lastName: c.lastName || "", email: c.email || "" });
      })
      .catch((err) => !cancelled && setError(err?.message || "Could not load your profile"))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [accessToken]);

  const save = async () => {
    setError(null);
    setSaved(false);
    if (!form.firstName.trim()) return setError("Please enter your name");

    setSaving(true);
    try {
      const data = await apiFetch("/api/customer/profile", {
        method: "PATCH",
        body: JSON.stringify(form),
      });
      // Keep the header's greeting in step without a reload.
      dispatch(updateUser({ firstName: form.firstName, lastName: form.lastName, email: form.email }));
      setSaved(true);
      return data;
    } catch (err) {
      setError(err?.message || "Could not save your profile");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      // The form that is coming: four label+field pairs and a button.
      <div className="mt-5 max-w-lg animate-pulse space-y-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i}>
            <Skeleton className="h-3 w-24 opacity-60" />
            <Skeleton className="mt-2 h-9 w-full opacity-60" />
          </div>
        ))}
        <Skeleton className="h-10 w-36" />
      </div>
    );
  }

  return (
    <div className="max-w-lg">
      <div className="mt-5 flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="p-first">First name</Label>
            <Input
              id="p-first"
              value={form.firstName}
              onChange={(e) => setForm({ ...form, firstName: e.target.value })}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="p-last">Last name</Label>
            <Input
              id="p-last"
              value={form.lastName}
              onChange={(e) => setForm({ ...form, lastName: e.target.value })}
            />
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="p-email">Email</Label>
          <Input
            id="p-email"
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="p-mobile">Mobile number</Label>
          <Input
            id="p-mobile"
            className="num"
            value={user?.mobile ? `+91 ${String(user.mobile).replace(/^91/, "")}` : ""}
            readOnly
            disabled
          />
          <p className="text-xs text-meta">
            This is how you sign in. Contact us to change it.
          </p>
        </div>

        {error && <p className="text-sm text-bad">{error}</p>}

        <div className="flex items-center gap-3">
          <Button onClick={save} disabled={saving}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : "Save changes"}
          </Button>
          {saved && (
            <span className="flex items-center gap-1.5 text-sm text-good">
              <Check className="size-4" /> Saved
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
