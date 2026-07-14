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
import { Button } from "@/components/ui/button";
import { User, UserCog, Shield, Lock } from "lucide-react";

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

  const demoAccounts = [
    {
      role: "customer" as const,
      label: "Customer Demo",
      icon: User,
      description: "Browse and book travel",
    },
    {
      role: "agent" as const,
      label: "Agent Demo",
      icon: UserCog,
      description: "Manage bookings",
    },
    {
      role: "admin" as const,
      label: "Admin Demo",
      icon: Shield,
      description: "Full system access",
    },
  ];

  return (
    <div className="min-h-dvh bg-hero-band">
      <Header />

      <main className="flex justify-center px-4 py-10 sm:py-16">
        <div className="w-full max-w-md">
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-primary">
            Check-in
          </p>
          <h1 className="mt-2 text-4xl font-semibold tracking-tight">
            Welcome back.
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Sign in to access your account.
          </p>

          {/* Card in the landing's boarding-pass voice */}
          <div className="mt-8 overflow-hidden rounded-xl border border-foreground/20 bg-card">
            <div className="flex items-center justify-between bg-night px-5 py-2.5 font-mono text-[10px] uppercase tracking-[0.2em] text-night-foreground">
              <span>Travel Trek</span>
              <span className="text-night-foreground/70">Sign in</span>
            </div>

            <div className="px-5 py-7 sm:px-6 sm:py-8">
              {/* Demo access */}
              <div className="mb-8">
                <div className="mb-4 flex items-center gap-3">
                  <div className="h-px flex-1 bg-foreground/15" />
                  <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                    Quick demo access
                  </span>
                  <div className="h-px flex-1 bg-foreground/15" />
                </div>

                <div className="grid grid-cols-1 gap-3">
                  {demoAccounts.map(
                    ({ role, label, icon: Icon, description }) => (
                      <Button
                        key={role}
                        type="button"
                        variant="outline"
                        onClick={() => handleDemoLogin(role)}
                        disabled={isLoading}
                        className="h-auto w-full cursor-pointer border-foreground/15 bg-card px-4 py-3 transition-colors hover:bg-muted/50 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <div className="flex w-full items-center gap-3">
                          <div className="flex h-9 w-9 flex-none items-center justify-center rounded-lg bg-primary/10 text-primary">
                            <Icon className="h-4 w-4" />
                          </div>
                          <div className="min-w-0 flex-1 text-left">
                            <p className="text-sm font-medium text-foreground">
                              {label}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {description}
                            </p>
                          </div>
                        </div>
                      </Button>
                    )
                  )}
                </div>
              </div>

              {/* Divider */}
              <div className="mb-8 flex items-center gap-3">
                <div className="h-px flex-1 bg-foreground/15" />
                <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                  Or with credentials
                </span>
                <div className="h-px flex-1 bg-foreground/15" />
              </div>

              <LoginForm
                form={form}
                onSubmit={onSubmit}
                isLoading={isLoading}
              />
            </div>
          </div>

          <p className="mt-6 flex items-center justify-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
            <Lock className="h-3 w-3" aria-hidden />
            Secured with industry-standard encryption
          </p>
        </div>
      </main>
    </div>
  );
}
