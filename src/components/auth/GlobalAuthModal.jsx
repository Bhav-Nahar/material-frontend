"use client";

import { useSelector } from "react-redux";

import { useAuth } from "@/hooks/useAuth";
import { selectAuthMode, selectAuthSource } from "@/redux/features/user/userSlice";
import AuthDialog from "./AuthDialog";

/**
 * Mounted once in the root layout so any component can open sign-in with `openLogin(redirectPath)`
 * from useAuth, without each one carrying its own dialog. Both headers already call openLogin();
 * this is what has been missing on the other end.
 *
 * `mode` comes from whoever opened it: the header's "Create account" asks for "signup", "Log in"
 * asks for "login". One dialog, two faces, rather than the jewelry build's approach of mounting a
 * second AuthDialog per entry point and letting either open over the other.
 */
export default function GlobalAuthModal() {
  const { isAuthModalOpen, closeLogin } = useAuth();
  const mode = useSelector(selectAuthMode);
  // The dialog needs the source too, not just the form: a checkout sign-in is one column, so the
  // 720px box sized for the two-panel layout would leave half of it empty.
  const source = useSelector(selectAuthSource);

  return (
    <AuthDialog
      open={isAuthModalOpen}
      onOpenChange={(open) => !open && closeLogin()}
      mode={mode}
      source={source}
    />
  );
}
