// src/components/authentication/TwoFactorLoginForm.tsx
//
// Login second step for 2FA accounts. The password step answered
// { twoFactorRequired: true } with NO session — only the short-lived signed
// pending cookie that gates POST /auth/2fa/{verify,resend}. Verify completes
// the login (cookies + user DTO, dispatched by the authApi endpoint); an
// expired pending cookie (401) sends the user back to the password step.
"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import toast from "react-hot-toast";
import { Loader2 } from "lucide-react";
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
import {
  useTwoFactorResendMutation,
  useTwoFactorVerifyMutation,
} from "@/redux/auth/authApi";
import { extractApiErrorMessage } from "@/utils/extractApiErrorMessage";
import { loginRedirectPath } from "@/components/authentication/login-redirect-logic";
import {
  ITwoFactorCodeFormSchema,
  twoFactorCodeFormSchema,
} from "@/validation/auth-validation";

const INPUT_CLASS =
  "h-11 rounded-lg border-foreground/20 bg-background text-[15px] shadow-none placeholder:text-muted-foreground/50";

interface TwoFactorLoginFormProps {
  /** Back to the password step (also used when the pending session expires). */
  onCancel: () => void;
}

export default function TwoFactorLoginForm({
  onCancel,
}: TwoFactorLoginFormProps) {
  const router = useRouter();
  const [verify, { isLoading: isVerifying }] = useTwoFactorVerifyMutation();
  const [resend, { isLoading: isResending }] = useTwoFactorResendMutation();

  const form = useForm<ITwoFactorCodeFormSchema>({
    resolver: zodResolver(twoFactorCodeFormSchema),
    defaultValues: { code: "" },
  });

  const onVerify = async (data: ITwoFactorCodeFormSchema) => {
    try {
      await verify({ code: data.code }).unwrap();
      toast.success("Login successful! Redirecting...");
      router.push(loginRedirectPath(window.location.search));
    } catch (err) {
      const { message } = extractApiErrorMessage(err);
      const status =
        typeof err === "object" && err !== null && "status" in err
          ? (err as { status?: unknown }).status
          : undefined;

      // The pending proof expired or was consumed — restart from the password.
      if (status === 401 && /sign in again|session expired/i.test(message)) {
        toast.error(message);
        onCancel();
        return;
      }

      form.setError("code", {
        message: message || "Invalid or expired code. Please try again.",
      });
    }
  };

  const onResend = async () => {
    try {
      const res = await resend().unwrap();
      toast.success(res.message || "A new code is on its way.");
    } catch (err) {
      toast.error(
        extractApiErrorMessage(err).message ||
          "Could not resend the code. Please try again."
      );
    }
  };

  return (
    <div className="w-full">
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onVerify)}
          className="w-full space-y-6"
        >
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
              Two-factor check
            </p>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Your account is protected with two-factor authentication. Enter
              the 6-digit code we just sent you to finish signing in.
            </p>
          </div>

          <FormField
            control={form.control}
            name="code"
            render={({ field }) => (
              <FormItem>
                <FormLabel>6-digit code</FormLabel>
                <FormControl>
                  <Input
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    placeholder="123456"
                    className={`${INPUT_CLASS} text-center font-mono text-lg tracking-[0.5em]`}
                    disabled={isVerifying}
                    autoFocus
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
            disabled={isVerifying}
          >
            {isVerifying ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Verifying...
              </>
            ) : (
              "Verify & Sign In"
            )}
          </Button>

          <div className="flex items-center justify-between text-sm">
            <button
              type="button"
              onClick={onCancel}
              className="cursor-pointer font-medium text-foreground underline-offset-4 hover:underline"
              disabled={isVerifying}
            >
              Back to sign in
            </button>
            <button
              type="button"
              onClick={onResend}
              className="cursor-pointer text-muted-foreground underline-offset-4 hover:underline disabled:opacity-60"
              disabled={isResending || isVerifying}
            >
              {isResending ? "Resending..." : "Resend code"}
            </button>
          </div>
        </form>
      </Form>
    </div>
  );
}
