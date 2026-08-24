// src/app/login/page.tsx
"use client";
import React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  loginFormSchema,
  ILoginFormSchema,
} from "@/validation/auth-validation";
import LoginForm from "@/components/authentication/LoginForm";
import OtpLoginForm from "@/components/authentication/OtpLoginForm";
import TwoFactorLoginForm from "@/components/authentication/TwoFactorLoginForm";
import GoogleSignInButton from "@/components/authentication/GoogleSignInButton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { z } from "zod";
import toast from "react-hot-toast";
import { useLoginMutation, useDemoLoginMutation } from "@/redux/auth/authApi";
import { DemoLoginRole, isTwoFactorRequired } from "@/types/auth";
import { extractApiErrorMessage } from "@/utils/extractApiErrorMessage";
import { loginRedirectPath } from "@/components/authentication/login-redirect-logic";
import { useRouter } from "next/navigation";
import Header from "@/components/index/Header";
import { ArrowRight, Loader2 } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [loginUser, { isLoading }] = useLoginMutation();
  const [demoLoginUser, { isLoading: isDemoLoading }] = useDemoLoginMutation();

  // A 2FA account's password step answers { twoFactorRequired: true } with
  // no session - the card swaps to the code step until verify completes.
  const [twoFactorPending, setTwoFactorPending] = React.useState(false);

  // Which demo account is being minted, so the row that was tapped is the one
  // that spins instead of all three dimming together.
  const [pendingRole, setPendingRole] = React.useState<DemoLoginRole | null>(
    null
  );

  const form = useForm<ILoginFormSchema>({
    resolver: zodResolver(loginFormSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  async function onSubmit(data: z.infer<typeof loginFormSchema>) {
    try {
      const result = await loginUser(data).unwrap();

      if (isTwoFactorRequired(result.data)) {
        toast.success(
          result.message || "Enter the verification code we just sent you."
        );
        setTwoFactorPending(true);
        return;
      }

      toast.success("Login successful! Redirecting...");
      router.push(loginRedirectPath(window.location.search));
    } catch (err) {

      const { message, fieldErrors, hasFieldErrors } =
        extractApiErrorMessage(err);

      if (hasFieldErrors && fieldErrors) {
        Object.entries(fieldErrors).forEach(([field, errorMessage]) => {
          form.setError(field as keyof ILoginFormSchema, {
            message: errorMessage,
          });
        });
      } else {
        // No field to attach it to (e.g. invalid credentials): keep the
        // error visible in the form after the toast fades.
        form.setError("root", {
          message: message || "Login failed. Please try again.",
        });
      }

      toast.error(message || "Login failed. Please try again.");
    }
  }

  // Demo login is entirely server-side: the client only names a role and the
  // backend mints a session for the canned account (no credentials ship in the
  // bundle). A 403 (demo disabled) or 404 (account not seeded) surfaces as the
  // server's message.
  const handleDemoLogin = async (role: DemoLoginRole) => {
    setPendingRole(role);
    try {
      await demoLoginUser({ role }).unwrap();
      toast.success("Login successful! Redirecting...");
      // The spinner stays through the redirect - clearing it here would flash
      // the row back to its resting state before the route changes.
      router.push(loginRedirectPath(window.location.search));
    } catch (err) {
      const { message } = extractApiErrorMessage(err);
      toast.error(message || "Demo login is unavailable right now.");
      setPendingRole(null);
    }
  };

  // Boarding-style role codes instead of icons - matches the landing's
  // document vocabulary.
  const demoAccounts = [
    {
      role: "CUSTOMER" as const,
      code: "PAX",
      label: "Customer demo",
      description: "Browse and book travel",
    },
    {
      role: "AGENT" as const,
      code: "AGT",
      label: "Agent demo",
      description: "Manage bookings",
    },
    {
      role: "ADMIN" as const,
      code: "ADM",
      label: "Admin demo",
      description: "Full system access",
    },
  ];

  return (
    <div className="min-h-dvh bg-hero-band pb-20 md:pb-0">
      <Header />

      <main className="px-4 py-10 sm:py-14">
        {/* Stacked on phones; intro + demo left and credentials right on lg,
            with the intro centered against the form's height. */}
        <div className="mx-auto grid w-full max-w-md grid-cols-1 gap-10 lg:max-w-5xl lg:grid-cols-2 lg:items-center lg:gap-16">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight lg:text-4xl">
              Sign in to your account.
            </h1>

            {/* Demo access */}
            <div className="mt-8">
              <div className="mb-3 flex items-center gap-3">
                <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                  Quick demo access
                </span>
                <div className="h-px flex-1 bg-foreground/15" />
              </div>

              <p className="mb-4 max-w-prose text-sm text-muted-foreground">
                Pick a seat and you are signed straight in - nothing to type,
                nothing to remember.
              </p>

              {/* Full-width rows at every width. Three of these side by side
                  in this column leave each label wrapping over four lines,
                  and a row keeps the code, the name and the arrow on one
                  readable line from 280px up. */}
              <ul className="space-y-2.5">
                {demoAccounts.map(({ role, code, label, description }) => {
                  const isPending = pendingRole === role;

                  return (
                    <li key={role}>
                      <button
                        type="button"
                        onClick={() => handleDemoLogin(role)}
                        disabled={isLoading || isDemoLoading}
                        aria-busy={isPending}
                        className="group flex w-full cursor-pointer items-center gap-3 rounded-lg border border-foreground/15 bg-card px-3 py-3 text-left transition-colors hover:border-foreground/30 hover:bg-muted/40 active:bg-muted/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-60 sm:px-4"
                      >
                        <span className="flex h-9 w-11 flex-none items-center justify-center rounded-md border border-foreground/15 bg-muted/50 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                          {code}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-medium text-foreground">
                            {label}
                          </span>
                          <span className="mt-0.5 block text-xs text-muted-foreground">
                            {description}
                          </span>
                        </span>
                        {isPending ? (
                          <Loader2
                            className="h-4 w-4 flex-none animate-spin text-muted-foreground"
                            aria-hidden
                          />
                        ) : (
                          <ArrowRight
                            className="h-4 w-4 flex-none text-muted-foreground transition-transform group-hover:translate-x-0.5"
                            aria-hidden
                          />
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>

          {/* Credentials card in the landing's boarding-pass voice */}
          <div className="overflow-hidden rounded-xl border border-foreground/20 bg-card">
            <div className="flex items-center justify-between bg-night px-5 py-2.5 font-mono text-[10px] uppercase tracking-[0.2em] text-night-foreground">
              <span>Travel Trek</span>
              <span className="text-night-foreground/70">Sign in</span>
            </div>

            <div className="px-5 py-7 sm:px-6 sm:py-8">
              {twoFactorPending ? (
                <TwoFactorLoginForm
                  onCancel={() => setTwoFactorPending(false)}
                />
              ) : (
                <>
                  <Tabs defaultValue="password" className="w-full">
                    <TabsList className="mb-6 grid w-full grid-cols-2">
                      <TabsTrigger value="password" className="cursor-pointer">
                        Password
                      </TabsTrigger>
                      <TabsTrigger value="otp" className="cursor-pointer">
                        One-time code
                      </TabsTrigger>
                    </TabsList>
                    <TabsContent value="password">
                      <LoginForm
                        form={form}
                        onSubmit={onSubmit}
                        isLoading={isLoading}
                      />
                    </TabsContent>
                    <TabsContent value="otp">
                      <OtpLoginForm />
                    </TabsContent>
                  </Tabs>

                  {/* Google sign-in (rendered only when configured) */}
                  <div className="mt-6">
                    <GoogleSignInButton />
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
