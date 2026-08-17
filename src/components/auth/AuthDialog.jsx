"use client";

import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import AuthForm from "./AuthForm";

/**
 * Centred dialog on desktop, bottom sheet on a phone -- the same split BuySheet, HelpMeChoose and
 * CategorySheet already use here, so auth does not arrive as a third kind of overlay.
 *
 * Deliberately NARROW. The jewelry build's is `max-w-[1200px]` because it has to seat a six-segment
 * wheel next to a form; a sign-in box the width of a desktop browser reads as a landing page. The
 * wheel here lives inside the form column at 260px, so the whole thing fits in a column you can
 * actually read.
 */
export default function AuthDialog({ open, onOpenChange, redirectPath, mode = "login", source }) {
  const isMobile = useMediaQuery("(max-width: 768px)");
  const close = () => onOpenChange(false);
  // Checkout drops the side panel, so it drops the width that panel was paying for.
  const width = source === "cart-checkout" ? "!max-w-[420px]" : "!max-w-[720px]";

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" className="max-h-[95dvh] overflow-y-auto bg-surface p-0">
          <SheetTitle className="sr-only">Sign in to Material</SheetTitle>
          <AuthForm onClose={close} onSuccess={close} redirectPath={redirectPath} mode={mode} />
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={`w-full ${width} gap-0 overflow-hidden border-line bg-surface p-0`}>
        <DialogTitle className="sr-only">Sign in to Material</DialogTitle>
        <DialogDescription className="sr-only">
          Sign in or create an account with your mobile number.
        </DialogDescription>
        <AuthForm onClose={close} onSuccess={close} redirectPath={redirectPath} mode={mode} />
      </DialogContent>
    </Dialog>
  );
}
