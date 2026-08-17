"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSelector } from "react-redux";

import AuthForm from "@/components/auth/AuthForm";
import { useRehydrated } from "@/hooks/useRehydrated";

/**
 * A real page as well as the modal, because the checkout gate redirects here rather than opening an
 * overlay on a page it has already decided not to render.
 *
 * The redirect away for an already-signed-in customer waits on useRehydrated. Without that it fires
 * on the first render -- when persisted state has not loaded and everyone looks logged out -- so a
 * signed-in customer would see the sign-in form flash before being sent on. The jewelry build gets
 * away with the naive version only because PersistGate blocks its whole tree; see
 * src/redux/provider.js.
 */
export default function LoginPage() {
  const router = useRouter();
  const rehydrated = useRehydrated();
  const isAuthenticated = useSelector((state) => state.user.isAuthenticated);

  useEffect(() => {
    if (rehydrated && isAuthenticated) router.replace("/");
  }, [rehydrated, isAuthenticated, router]);

  return (
    <main className="flex min-h-[80vh] items-center justify-center bg-paper px-4 py-12">
      <div className="w-full max-w-[720px] border border-line bg-surface">
        <AuthForm onSuccess={() => router.replace("/")} />
      </div>
    </main>
  );
}
