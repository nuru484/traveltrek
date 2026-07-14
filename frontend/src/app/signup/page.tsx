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

export default function SignupPage() {
  const router = useRouter();

  const [registerUser, { isLoading }] = useRegisterUserMutation();

  const form = useForm<ISignupFormSchema>({
    resolver: zodResolver(signupFormSchema),
  });

  async function onSubmit(data: z.infer<typeof signupFormSchema>) {
    try {
      const formData = new FormData();
      formData.append("name", data.name);
      formData.append("email", data.email);
      formData.append("password", data.password);
      formData.append("role", data.role);
      formData.append("phone", data.phone);
      if (data.address) formData.append("address", data.address);
      if (data.profilePicture)
        formData.append("profilePicture", data.profilePicture);

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

      <main className="flex justify-center px-4 py-10 sm:py-16">
        <div className="w-full max-w-md">
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-primary">
            New passenger
          </p>
          <h1 className="mt-2 text-4xl font-semibold tracking-tight">
            Create your account.
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Join the platform to book flights, hotels, and tours.
          </p>

          {/* Card in the landing's boarding-pass voice */}
          <div className="mt-8 overflow-hidden rounded-xl border border-foreground/20 bg-card">
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

          <p className="mt-6 text-center font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
            By signing up, you agree to the terms of service
          </p>
        </div>
      </main>
    </div>
  );
}
