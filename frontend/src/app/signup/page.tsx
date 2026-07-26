// src/app/signup/page.tsx
"use client";
import React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import Link from "next/link";
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
import GoogleSignInButton from "@/components/authentication/GoogleSignInButton";

export default function SignupPage() {
  const router = useRouter();

  const [registerUser, { isLoading }] = useRegisterUserMutation();

  const form = useForm<ISignupFormSchema>({
    resolver: zodResolver(signupFormSchema),
    defaultValues: {
      name: "",
      contactMethod: "email",
      email: "",
      phone: "",
      password: "",
    },
  });

  // Minimal registration mirroring backend registerUserSchema: name + ONE
  // contact (email or phone), password optional — passwordless accounts sign
  // in with a one-time code.
  async function onSubmit(data: z.infer<typeof signupFormSchema>) {
    try {
      const formData = new FormData();
      formData.append("name", data.name);
      if (data.contactMethod === "email" && data.email) {
        formData.append("email", data.email);
      }
      if (data.contactMethod === "phone" && data.phone) {
        formData.append("phone", data.phone);
      }
      if (data.password) formData.append("password", data.password);

      await registerUser(formData).unwrap();
      toast.success("Signup Successful");
      router.push("/dashboard");
    } catch (err) {

      const { message, fieldErrors, hasFieldErrors } =
        extractApiErrorMessage(err);

      if (hasFieldErrors && fieldErrors) {
        // Attach field errors to react-hook-form
        Object.entries(fieldErrors).forEach(([field, errorMessage]) => {
          form.setError(field as keyof ISignupFormSchema, {
            message: errorMessage,
          });
        });
      } else {
        // No field to attach it to (e.g. contact already taken): keep the
        // error visible in the form after the toast fades.
        form.setError("root", {
          message: message || "Signup failed. Please try again.",
        });
      }

      // Always show toast for main message
      toast.error(message || "Signup failed. Please try again.");
    }
  }

  return (
    <div className="min-h-dvh bg-hero-band pb-20 md:pb-0">
      <Header />

      <main className="px-4 py-10 sm:py-14">
        {/* Stacked on phones; intro + social sign-up left and the form right
            on lg, with the intro centered against the form's height. */}
        <div className="mx-auto grid w-full max-w-md grid-cols-1 gap-10 lg:max-w-5xl lg:grid-cols-2 lg:items-center lg:gap-16">
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
              {process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID && (
                <>
                  <GoogleSignInButton />

                  <div className="mt-6 flex items-center gap-3">
                    <div className="h-px flex-1 bg-foreground/15" />
                    <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                      Or register with a contact
                    </span>
                    <div className="h-px flex-1 bg-foreground/15" />
                  </div>
                </>
              )}

              <p className="mt-6 font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
                By signing up, you agree to the{" "}
                <Link
                  href="/terms-of-service"
                  className="underline underline-offset-2 transition-colors hover:text-foreground"
                >
                  terms of service
                </Link>{" "}
                and{" "}
                <Link
                  href="/privacy-policy"
                  className="underline underline-offset-2 transition-colors hover:text-foreground"
                >
                  privacy policy
                </Link>
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
