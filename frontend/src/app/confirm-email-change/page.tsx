// src/app/confirm-email-change/page.tsx
//
// Target of the email-change confirmation link (/confirm-email-change?token=...).
// PUBLIC, like /reset-password: the emailed single-use token is the
// credential. Confirming applies the new address and signs every session out
// — the user logs in again with the new email.
"use client";
import React, { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import Header from "@/components/index/Header";
import { Button } from "@/components/ui/button";
import { useConfirmEmailChangeMutation } from "@/redux/auth/authApi";
import { extractApiErrorMessage } from "@/utils/extractApiErrorMessage";

function ConfirmEmailChangeContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [confirmEmailChange, { isLoading, isSuccess, isError, data, error }] =
    useConfirmEmailChangeMutation();

  // The token is the whole credential — confirm as soon as the page opens
  // (StrictMode-guarded so the single-use token is only posted once).
  const firedRef = React.useRef(false);
  React.useEffect(() => {
    if (!token || firedRef.current) return;
    firedRef.current = true;
    confirmEmailChange({ token });
  }, [token, confirmEmailChange]);

  if (!token) {
    return (
      <div className="space-y-4 text-center">
        <h1 className="text-xl font-semibold tracking-tight">
          Invalid confirmation link.
        </h1>
        <p className="text-sm text-muted-foreground">
          This page needs the token from your confirmation email. Restart the
          email change from Settings → Contact and open the new link directly.
        </p>
        <Button asChild variant="outline" className="w-full cursor-pointer">
          <Link href="/login">Back to sign in</Link>
        </Button>
      </div>
    );
  }

  if (isLoading || (!isSuccess && !isError)) {
    return (
      <div className="flex flex-col items-center gap-3 py-6 text-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          Confirming your new email address…
        </p>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="space-y-4 text-center">
        <h1 className="text-xl font-semibold tracking-tight">
          We couldn&apos;t confirm the change.
        </h1>
        <p className="text-sm text-muted-foreground">
          {extractApiErrorMessage(error).message ||
            "The link may have expired or already been used. Restart the email change from Settings → Contact."}
        </p>
        <Button asChild variant="outline" className="w-full cursor-pointer">
          <Link href="/login">Back to sign in</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4 text-center">
      <h1 className="text-xl font-semibold tracking-tight">
        Email address updated.
      </h1>
      <p className="text-sm text-muted-foreground">
        {data?.message ||
          "Your email address has been updated. Please log in again with the new address."}
      </p>
      <Button
        asChild
        className="h-11 w-full cursor-pointer rounded-full bg-foreground font-medium text-background hover:bg-foreground/90"
      >
        <Link href="/login">Sign in with your new email</Link>
      </Button>
    </div>
  );
}

export default function ConfirmEmailChangePage() {
  return (
    <div className="min-h-dvh bg-hero-band pb-20 md:pb-0">
      <Header />

      <main className="px-4 py-10 sm:py-14">
        <div className="mx-auto w-full max-w-md">
          <div className="overflow-hidden rounded-xl border border-foreground/20 bg-card">
            <div className="flex items-center justify-between bg-night px-5 py-2.5 font-mono text-[10px] uppercase tracking-[0.2em] text-night-foreground">
              <span>Travel Trek</span>
              <span className="text-night-foreground/70">Email change</span>
            </div>

            <div className="px-5 py-7 sm:px-6 sm:py-8">
              <Suspense fallback={null}>
                <ConfirmEmailChangeContent />
              </Suspense>

              <div className="mt-6 text-center">
                <p className="text-sm text-muted-foreground">
                  Back to{" "}
                  <Link
                    href="/login"
                    className="font-medium text-foreground underline-offset-4 hover:underline"
                  >
                    Sign in
                  </Link>
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
