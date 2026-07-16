// src/app/reset-password/page.tsx
//
// Target of the emailed reset link (/reset-password?token=...). Consumes the
// single-use token; a successful reset kills every live session, so the user
// signs in again with the new password.
"use client";
import React, { Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import toast from "react-hot-toast";
import { Loader2, Eye, EyeOff } from "lucide-react";
import Header from "@/components/index/Header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useResetPasswordMutation } from "@/redux/auth/authApi";
import { extractApiErrorMessage } from "@/utils/extractApiErrorMessage";
import {
  IResetPasswordFormSchema,
  resetPasswordFormSchema,
} from "@/validation/auth-validation";

const INPUT_CLASS =
  "h-11 rounded-lg border-foreground/20 bg-background text-[15px] shadow-none placeholder:text-muted-foreground/50";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [resetPassword, { isLoading }] = useResetPasswordMutation();
  const [showPassword, setShowPassword] = React.useState(false);

  const form = useForm<IResetPasswordFormSchema>({
    resolver: zodResolver(resetPasswordFormSchema),
    defaultValues: { password: "", confirmPassword: "" },
  });

  async function onSubmit(data: IResetPasswordFormSchema) {
    try {
      const result = await resetPassword({
        token,
        password: data.password,
      }).unwrap();
      toast.success(result.message);
      router.push("/login");
    } catch (err) {
      toast.error(
        extractApiErrorMessage(err).message ||
          "Could not reset the password. The link may have expired."
      );
    }
  }

  if (!token) {
    return (
      <div className="space-y-4 text-center">
        <h1 className="text-xl font-semibold tracking-tight">
          Invalid reset link.
        </h1>
        <p className="text-sm text-muted-foreground">
          This page needs the token from your reset email. Request a new link
          and open it directly.
        </p>
        <Button asChild variant="outline" className="w-full cursor-pointer">
          <Link href="/forgot-password">Request a new link</Link>
        </Button>
      </div>
    );
  }

  return (
    <>
      <h1 className="text-xl font-semibold tracking-tight">
        Choose a new password.
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        After resetting, you&apos;ll sign in again with the new password.
      </p>

      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="mt-6 space-y-6"
        >
          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>New password</FormLabel>
                <div className="relative">
                  <FormControl>
                    <Input
                      type={showPassword ? "text" : "password"}
                      placeholder="Enter a new password"
                      autoComplete="new-password"
                      className={`${INPUT_CLASS} pr-11`}
                      disabled={isLoading}
                      {...field}
                    />
                  </FormControl>
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer rounded-sm p-0.5 text-muted-foreground transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
                    tabIndex={-1}
                    disabled={isLoading}
                    aria-label={
                      showPassword ? "Hide password" : "Show password"
                    }
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
                <FormMessage className="text-xs" />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="confirmPassword"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Confirm new password</FormLabel>
                <FormControl>
                  <Input
                    type={showPassword ? "text" : "password"}
                    placeholder="Repeat the new password"
                    autoComplete="new-password"
                    className={INPUT_CLASS}
                    disabled={isLoading}
                    {...field}
                  />
                </FormControl>
                <FormMessage className="text-xs" />
              </FormItem>
            )}
          />

          <Button
            type="submit"
            className="h-11 w-full cursor-pointer rounded-full bg-foreground font-medium text-background hover:bg-foreground/90 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Resetting...
              </>
            ) : (
              "Reset password"
            )}
          </Button>
        </form>
      </Form>
    </>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-dvh bg-hero-band pb-20 md:pb-0">
      <Header />

      <main className="px-4 py-10 sm:py-14">
        <div className="mx-auto w-full max-w-md">
          <div className="overflow-hidden rounded-xl border border-foreground/20 bg-card">
            <div className="flex items-center justify-between bg-night px-5 py-2.5 font-mono text-[10px] uppercase tracking-[0.2em] text-night-foreground">
              <span>Travel Trek</span>
              <span className="text-night-foreground/70">New password</span>
            </div>

            <div className="px-5 py-7 sm:px-6 sm:py-8">
              <Suspense fallback={null}>
                <ResetPasswordForm />
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
