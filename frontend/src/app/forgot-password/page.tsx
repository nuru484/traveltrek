// src/app/forgot-password/page.tsx
"use client";
import React from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import toast from "react-hot-toast";
import { Loader2, MailCheck } from "lucide-react";
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
import { useForgotPasswordMutation } from "@/redux/auth/authApi";
import { extractApiErrorMessage } from "@/utils/extractApiErrorMessage";
import {
  forgotPasswordFormSchema,
  IForgotPasswordFormSchema,
} from "@/validation/auth-validation";

const INPUT_CLASS =
  "h-11 rounded-lg border-foreground/20 bg-background text-[15px] shadow-none placeholder:text-muted-foreground/50";

export default function ForgotPasswordPage() {
  const [forgotPassword, { isLoading }] = useForgotPasswordMutation();
  const [sentTo, setSentTo] = React.useState<string | null>(null);

  const form = useForm<IForgotPasswordFormSchema>({
    resolver: zodResolver(forgotPasswordFormSchema),
    defaultValues: { email: "" },
  });

  async function onSubmit(data: IForgotPasswordFormSchema) {
    try {
      await forgotPassword(data).unwrap();
      // Always 200 on the wire (no account enumeration).
      setSentTo(data.email);
    } catch (err) {
      toast.error(
        extractApiErrorMessage(err).message ||
          "Could not send the reset link. Please try again."
      );
    }
  }

  return (
    <div className="min-h-dvh bg-hero-band pb-20 md:pb-0">
      <Header />

      <main className="px-4 py-10 sm:py-14">
        <div className="mx-auto w-full max-w-md">
          <div className="overflow-hidden rounded-xl border border-foreground/20 bg-card">
            <div className="flex items-center justify-between bg-night px-5 py-2.5 font-mono text-[10px] uppercase tracking-[0.2em] text-night-foreground">
              <span>Travel Trek</span>
              <span className="text-night-foreground/70">Password reset</span>
            </div>

            <div className="px-5 py-7 sm:px-6 sm:py-8">
              {sentTo ? (
                <div className="space-y-4 text-center">
                  <MailCheck
                    className="mx-auto h-10 w-10 text-primary"
                    aria-hidden
                  />
                  <h1 className="text-xl font-semibold tracking-tight">
                    Check your inbox.
                  </h1>
                  <p className="text-sm text-muted-foreground break-words [overflow-wrap:anywhere]">
                    If an account exists for{" "}
                    <span className="font-medium text-foreground">
                      {sentTo}
                    </span>
                    , a password reset link is on its way. The link opens the
                    reset page where you choose a new password.
                  </p>
                  <Button
                    variant="outline"
                    className="w-full cursor-pointer"
                    onClick={() => setSentTo(null)}
                  >
                    Use a different email
                  </Button>
                </div>
              ) : (
                <>
                  <h1 className="text-xl font-semibold tracking-tight">
                    Forgot your password?
                  </h1>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Enter your account email and we&apos;ll send you a reset
                    link.
                  </p>

                  <Form {...form}>
                    <form
                      onSubmit={form.handleSubmit(onSubmit)}
                      className="mt-6 space-y-6"
                    >
                      <FormField
                        control={form.control}
                        name="email"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Email</FormLabel>
                            <FormControl>
                              <Input
                                type="email"
                                placeholder="your.email@example.com"
                                autoComplete="email"
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
                            Sending link...
                          </>
                        ) : (
                          "Send reset link"
                        )}
                      </Button>
                    </form>
                  </Form>
                </>
              )}

              <div className="mt-6 text-center">
                <p className="text-sm text-muted-foreground">
                  Remembered it?{" "}
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
