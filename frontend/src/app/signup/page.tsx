// src/app/signup/page.tsx
"use client";
import React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { z } from "zod";
import toast from "react-hot-toast";
import SignupForm from "@/components/authentication/SignupForm";
import {
  ISignupFormSchema,
  signupFormSchema,
} from "@/validation/auth-validation";
import { useRegisterUserMutation } from "@/redux/auth/authApi";
import { extractApiErrorMessage } from "@/utils/extractApiErrorMessage";
import Header from "@/components/index/Header";
import { Button } from "@/components/ui/button";

export default function SignupPage() {
  const router = useRouter();

  const [registerUser, { isLoading }] = useRegisterUserMutation();

  const form = useForm<ISignupFormSchema>({
    resolver: zodResolver(signupFormSchema),
    defaultValues: { name: "", email: "", phone: "" },
  });

  // Minimal registration: name + email or phone. The backend will be updated
  // to accept this shape and send the user a default password; until then the
  // API may reject the request and the error surfaces in the form/toast.
  async function onSubmit(data: z.infer<typeof signupFormSchema>) {
    try {
      const formData = new FormData();
      formData.append("name", data.name);
      if (data.email) formData.append("email", data.email);
      if (data.phone) formData.append("phone", data.phone);

      await registerUser(formData).unwrap();
      toast.success("Signup Successful");
      router.push("/dashboard");
    } catch (err) {
      console.error("Signup error:", err);

      const { message, fieldErrors, hasFieldErrors } =
        extractApiErrorMessage(err);

      if (hasFieldErrors && fieldErrors) {
        // Attach field errors to react-hook-form
        Object.entries(fieldErrors).forEach(([field, errorMessage]) => {
          form.setError(field as keyof ISignupFormSchema, {
            message: errorMessage,
          });
        });
      }

      // Always show toast for main message
      toast.error(message || "Signup failed. Please try again.");
    }
  }

  return (
    <div className="min-h-dvh bg-hero-band">
      <Header />

      <main className="px-4 py-10 sm:py-14">
        {/* Stacked on phones; intro + social sign-up left and the form right
            on lg so big screens spread out instead of scrolling. */}
        <div className="mx-auto grid w-full max-w-md grid-cols-1 gap-10 lg:max-w-5xl lg:grid-cols-2 lg:items-start lg:gap-16">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-primary">
              New passenger
            </p>
            <h1 className="mt-2 text-4xl font-semibold tracking-tight lg:text-5xl">
              Create your account.
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Join the platform to book flights, hotels, and tours.
            </p>

            <div className="mt-8">
              <Button
                type="button"
                variant="outline"
                className="h-11 w-full cursor-pointer border-foreground/15 bg-card"
              >
                <svg
                  className="h-4 w-4"
                  viewBox="0 0 24 24"
                  aria-hidden
                  focusable="false"
                >
                  <path
                    fill="#4285F4"
                    d="M23.52 12.27c0-.85-.08-1.66-.22-2.45H12v4.63h6.46a5.53 5.53 0 0 1-2.4 3.63v3h3.88c2.27-2.09 3.58-5.17 3.58-8.81Z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 24c3.24 0 5.96-1.07 7.94-2.91l-3.88-3c-1.07.72-2.45 1.15-4.06 1.15-3.13 0-5.78-2.11-6.72-4.95H1.27v3.1A12 12 0 0 0 12 24Z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.28 14.29a7.2 7.2 0 0 1 0-4.58v-3.1H1.27a12 12 0 0 0 0 10.78l4.01-3.1Z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 4.76c1.76 0 3.34.6 4.59 1.8l3.44-3.44A11.97 11.97 0 0 0 12 0 12 12 0 0 0 1.27 6.61l4.01 3.1C6.22 6.87 8.87 4.76 12 4.76Z"
                  />
                </svg>
                Continue with Google
              </Button>

              <div className="mt-6 flex items-center gap-3">
                <div className="h-px flex-1 bg-foreground/15" />
                <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                  Or register with email
                </span>
                <div className="h-px flex-1 bg-foreground/15" />
              </div>

              <p className="mt-6 font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
                By signing up, you agree to the terms of service
              </p>
            </div>
          </div>

          {/* Registration card in the landing's boarding-pass voice */}
          <div className="overflow-hidden rounded-xl border border-foreground/20 bg-card">
            <div className="flex items-center justify-between bg-night px-5 py-2.5 font-mono text-[10px] uppercase tracking-[0.2em] text-night-foreground">
              <span>Travel Trek</span>
              <span className="text-night-foreground/70">Registration</span>
            </div>

            <div className="px-5 py-7 sm:px-6 sm:py-8">
              <SignupForm
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
