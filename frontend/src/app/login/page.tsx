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
    <div className="min-h-screen bg-background">
      {/* Header */}
      <Header />

      {/* Main Content */}
      <main className="flex flex-col justify-center items-center px-4 py-8 min-h-[calc(100vh-4rem)]">
        <div className="w-full max-w-md">
          {/* Login Card */}
          <div className="bg-card border border-border rounded-xl shadow-lg overflow-hidden">
            {/* Card Header */}
            <div className="bg-gradient-to-b from-muted/30 to-transparent border-b border-border px-6 py-8 text-center">
              <p className="text-sm text-muted-foreground">
                Sign in to access your account
              </p>
            </div>

            {/* Card Body */}
            <div className="px-6 py-8">
              {/* Demo Login Section */}
              <div className="mb-8">
                <div className="flex items-center gap-2 mb-4">
                  <div className="h-px flex-1 bg-border" />
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Quick Demo Access
                  </span>
                  <div className="h-px flex-1 bg-border" />
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
                        className="w-full h-auto py-3 px-4 cursor-pointer bg-card hover:bg-muted hover:text-accent-foreground border-border transition-all group disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        <div className="flex items-center gap-3 w-full ">
                          <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                            <Icon className="w-4 h-4" />
                          </div>
                          <div className="flex-1 text-left">
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
              <div className="flex items-center gap-3 mb-8">
                <div className="h-px flex-1 bg-border" />
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Or with credentials
                </span>
                <div className="h-px flex-1 bg-border" />
              </div>

              {/* Login Form */}
              <LoginForm
                form={form}
                onSubmit={onSubmit}
                isLoading={isLoading}
              />
            </div>
          </div>

          {/* Footer */}
          <div className="mt-8 text-center space-y-2">
            <p className="text-xs text-muted-foreground flex items-center justify-center gap-1.5">
              <Lock className="w-3 h-3" />
              Secured with industry-standard encryption
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
