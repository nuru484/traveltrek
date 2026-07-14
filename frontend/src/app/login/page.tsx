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
import { z } from "zod";
import toast from "react-hot-toast";
import { useLoginMutation } from "@/redux/auth/authApi";
import { extractApiErrorMessage } from "@/utils/extractApiErrorMessage";
import { useRouter } from "next/navigation";
import Header from "@/components/index/Header";

export default function LoginPage() {
  const router = useRouter();
  const [loginUser, { isLoading }] = useLoginMutation();

  const form = useForm<ILoginFormSchema>({
    resolver: zodResolver(loginFormSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  async function onSubmit(data: z.infer<typeof loginFormSchema>) {
    try {
      await loginUser(data).unwrap();
      toast.success("Login successful! Redirecting...");
      router.push("/dashboard");
    } catch (err) {
      console.error("Login error:", err);

      const { message, fieldErrors, hasFieldErrors } =
        extractApiErrorMessage(err);

      if (hasFieldErrors && fieldErrors) {
        Object.entries(fieldErrors).forEach(([field, errorMessage]) => {
          form.setError(field as keyof ILoginFormSchema, {
            message: errorMessage,
          });
        });
      }

      toast.error(message || "Login failed. Please try again.");
    }
  }

  const handleDemoLogin = async (role: "customer" | "agent" | "admin") => {
    const credentials = {
      customer: {
        email: process.env.NEXT_PUBLIC_DEMO_CUSTOMER_EMAIL || "",
        password: process.env.NEXT_PUBLIC_DEMO_PASSWORD || "",
      },
      agent: {
        email: process.env.NEXT_PUBLIC_DEMO_AGENT_EMAIL || "",
        password: process.env.NEXT_PUBLIC_DEMO_PASSWORD || "",
      },
      admin: {
        email: process.env.NEXT_PUBLIC_DEMO_ADMIN_EMAIL || "",
        password: process.env.NEXT_PUBLIC_DEMO_PASSWORD || "",
      },
    };

    const selectedCredentials = credentials[role];

    if (!selectedCredentials.email || !selectedCredentials.password) {
      toast.error(`Demo ${role} credentials not configured`);
      return;
    }

    // Populate form fields for visual feedback
    form.setValue("email", selectedCredentials.email);
    form.setValue("password", selectedCredentials.password);

    // Submit the form
    await onSubmit(selectedCredentials);
  };

  // Boarding-style role codes instead of icons — matches the landing's
  // document vocabulary.
  const demoAccounts = [
    {
      role: "customer" as const,
      code: "PAX",
      label: "Customer demo",
      description: "Browse and book travel",
    },
    {
      role: "agent" as const,
      code: "AGT",
      label: "Agent demo",
      description: "Manage bookings",
    },
    {
      role: "admin" as const,
      code: "ADM",
      label: "Admin demo",
      description: "Full system access",
    },
  ];

  return (
    <div className="min-h-dvh bg-hero-band">
      <Header />

      <main className="px-4 py-10 sm:py-14">
        {/* Stacked on phones; intro + demo left and credentials right on lg,
            with the intro centered against the form's height. */}
        <div className="mx-auto grid w-full max-w-md grid-cols-1 gap-10 lg:max-w-5xl lg:grid-cols-2 lg:items-center lg:gap-16">
          <div>
            <h1 className="text-4xl font-semibold tracking-tight lg:text-5xl">
              Sign in to your account.
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Use your credentials, or explore with a one-click demo.
            </p>

            {/* Demo access */}
            <div className="mt-8">
              <div className="mb-4 flex items-center gap-3">
                <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                  Quick demo access
                </span>
                <div className="h-px flex-1 bg-foreground/15" />
              </div>

              {/* Full-width rows on phones; compact 3-up cards on desktop so
                  the wide column doesn't leave dead space to the right. */}
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
                {demoAccounts.map(({ role, code, label, description }) => (
                  <button
                    key={role}
                    type="button"
                    onClick={() => handleDemoLogin(role)}
                    disabled={isLoading}
                    className="cursor-pointer rounded-lg border border-foreground/15 bg-card px-4 py-3 text-left transition-colors hover:bg-muted/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <span className="block font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                      {code}
                    </span>
                    <span className="mt-1 block text-sm font-medium text-foreground">
                      {label}
                    </span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      {description}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Credentials card in the landing's boarding-pass voice */}
          <div className="overflow-hidden rounded-xl border border-foreground/20 bg-card">
            <div className="flex items-center justify-between bg-night px-5 py-2.5 font-mono text-[10px] uppercase tracking-[0.2em] text-night-foreground">
              <span>Travel Trek</span>
              <span className="text-night-foreground/70">Sign in</span>
            </div>

            <div className="px-5 py-7 sm:px-6 sm:py-8">
              <LoginForm
                form={form}
                onSubmit={onSubmit}
                isLoading={isLoading}
              />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
