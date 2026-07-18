// src/components/settings/TwoFactorSettings.tsx
//
// Two-factor management over GET /auth/2fa/status and the challenge/enable/
// disable trio. Both directions consume the SAME possession proof: POST
// /auth/2fa/challenge sends a 6-digit code to the account's channel, then
// enable/disable redeem it. Disabling asks for confirmation BEFORE the code
// goes out; accounts without a delivery channel surface the backend's 400.
"use client";
import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import toast from "react-hot-toast";
import { Loader2, ShieldCheck, ShieldOff } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import ErrorMessage from "@/components/ui/ErrorMessage";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { FormRootError } from "@/components/ui/form-root-error";
import { Input } from "@/components/ui/input";
import {
  useTwoFactorChallengeMutation,
  useTwoFactorDisableMutation,
  useTwoFactorEnableMutation,
  useTwoFactorStatusQuery,
} from "@/redux/auth/authApi";
import { applyServerFieldErrors } from "@/utils/apply-server-field-errors";
import { extractApiErrorMessage } from "@/utils/extractApiErrorMessage";
import {
  ITwoFactorCodeFormSchema,
  twoFactorCodeFormSchema,
} from "@/validation/auth-validation";

const CHANNEL_LABEL = { email: "Codes via email", sms: "Codes via SMS" };

export default function TwoFactorSettings() {
  const { data, error, isError, isLoading, refetch } =
    useTwoFactorStatusQuery();

  const [challenge, { isLoading: isSending }] = useTwoFactorChallengeMutation();
  const [enable, { isLoading: isEnabling }] = useTwoFactorEnableMutation();
  const [disable, { isLoading: isDisabling }] = useTwoFactorDisableMutation();

  // Which flag change the pending challenge code will redeem, if any.
  const [pendingAction, setPendingAction] = React.useState<
    "enable" | "disable" | null
  >(null);
  const [confirmDisableOpen, setConfirmDisableOpen] = React.useState(false);
  const [confirmResendOpen, setConfirmResendOpen] = React.useState(false);

  const codeForm = useForm<ITwoFactorCodeFormSchema>({
    resolver: zodResolver(twoFactorCodeFormSchema),
    defaultValues: { code: "" },
  });

  const sendChallenge = async (action: "enable" | "disable") => {
    try {
      const res = await challenge().unwrap();
      codeForm.reset({ code: "" });
      setPendingAction(action);
      toast.success(res.message || "We sent you a verification code.");
    } catch (err) {
      // Includes the backend's 400 for accounts with no email/phone channel.
      toast.error(
        extractApiErrorMessage(err).message ||
          "Could not send the code. Please try again."
      );
    }
  };

  const onVerifyCode = async (values: ITwoFactorCodeFormSchema) => {
    if (!pendingAction) return;
    const redeem = pendingAction === "enable" ? enable : disable;
    try {
      const res = await redeem({ code: values.code }).unwrap();
      setPendingAction(null);
      toast.success(
        res.message ||
          (pendingAction === "enable"
            ? "Two-factor authentication is now on."
            : "Two-factor authentication is now off.")
      );
    } catch (err) {
      const { message, fieldErrors, hasFieldErrors } =
        extractApiErrorMessage(err);
      const fallback = "Invalid or expired code. Please try again.";

      if (hasFieldErrors && fieldErrors) {
        const unmatched = applyServerFieldErrors(
          codeForm.setError,
          fieldErrors,
          ["code"]
        );
        if (unmatched.length > 0) {
          codeForm.setError("root", { message: unmatched.join(" ") });
        }
      } else {
        // No field to attach it to: keep the error visible in the form
        // after the toast fades.
        codeForm.setError("root", { message: message || fallback });
      }

      toast.error(message || fallback);
    }
  };

  if (isLoading) {
    return (
      <div className="overflow-hidden rounded-xl border border-foreground/20 bg-card">
        <div className="bg-night px-4 py-2.5 sm:px-6">
          <Skeleton className="h-4 w-40 bg-night-foreground/20" />
        </div>
        <div className="space-y-4 px-4 py-6 sm:px-6">
          <Skeleton className="h-6 w-56" />
          <Skeleton className="h-4 w-full max-w-md" />
          <Skeleton className="h-9 w-44" />
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <ErrorMessage
        error={extractApiErrorMessage(error).message}
        onRetry={refetch}
      />
    );
  }

  const status = data?.data;
  const enabled = status?.enabled ?? false;
  const channel = status?.channel ?? null;
  const isBusy = isSending || isEnabling || isDisabling;

  return (
    <div className="overflow-hidden rounded-xl border border-foreground/20 bg-card">
      <div className="flex items-center justify-between bg-night px-4 py-2.5 font-mono text-[10px] uppercase tracking-[0.2em] text-night-foreground sm:px-6">
        <span>Travel Trek</span>
        <span className="text-night-foreground/70">Two-factor</span>
      </div>

      <div className="px-4 py-6 sm:px-6">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-lg font-semibold tracking-tight">
            Two-factor authentication
          </h2>
          <Badge variant={enabled ? "default" : "secondary"}>
            {enabled ? "Enabled" : "Off"}
          </Badge>
          {channel && <Badge variant="outline">{CHANNEL_LABEL[channel]}</Badge>}
        </div>

        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          {enabled
            ? "Password sign-ins ask for a 6-digit code we send you."
            : "Adds a second step: after your password, enter a 6-digit code we send you."}
        </p>

        {pendingAction === null ? (
          <div className="mt-6">
            {enabled ? (
              <Button
                variant="outline"
                className="cursor-pointer"
                disabled={isBusy}
                onClick={() => setConfirmDisableOpen(true)}
              >
                {isSending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <ShieldOff className="mr-2 h-4 w-4" />
                )}
                {isSending ? "Sending code..." : "Turn off two-factor"}
              </Button>
            ) : (
              <Button
                className="cursor-pointer"
                disabled={isBusy}
                onClick={() => sendChallenge("enable")}
              >
                {isSending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <ShieldCheck className="mr-2 h-4 w-4" />
                )}
                {isSending ? "Sending code..." : "Turn on two-factor"}
              </Button>
            )}
          </div>
        ) : (
          <div className="mt-6 border-t border-dashed border-foreground/20 pt-5">
            <p className="text-sm text-muted-foreground">
              Enter the 6-digit code we just sent you to{" "}
              <span className="font-medium text-foreground">
                turn two-factor {pendingAction === "enable" ? "on" : "off"}
              </span>
              .
            </p>

            <Form {...codeForm}>
              <form
                noValidate
                onSubmit={codeForm.handleSubmit(onVerifyCode)}
                className="mt-4 space-y-4"
              >
                <FormField
                  control={codeForm.control}
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
                          className="max-w-full text-center font-mono text-lg tracking-[0.5em] sm:max-w-56"
                          disabled={isBusy}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage className="text-xs" />
                    </FormItem>
                  )}
                />

                {/* Server errors that belong to no single field stay
                    visible here after the toast fades. */}
                <FormRootError />

                <div className="flex flex-wrap items-center gap-3">
                  <Button
                    type="submit"
                    className="cursor-pointer"
                    disabled={isBusy}
                  >
                    {(isEnabling || isDisabling) && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    {isEnabling || isDisabling
                      ? "Verifying..."
                      : pendingAction === "enable"
                        ? "Verify & turn on"
                        : "Verify & turn off"}
                  </Button>
                  <button
                    type="button"
                    onClick={() => setConfirmResendOpen(true)}
                    className="cursor-pointer text-sm text-muted-foreground underline-offset-4 hover:underline disabled:opacity-60"
                    disabled={isBusy}
                  >
                    {isSending ? "Resending..." : "Resend code"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setPendingAction(null)}
                    className="cursor-pointer text-sm font-medium text-foreground underline-offset-4 hover:underline disabled:opacity-60"
                    disabled={isEnabling || isDisabling}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </Form>
          </div>
        )}
      </div>

      <ConfirmationDialog
        open={confirmResendOpen}
        onOpenChange={setConfirmResendOpen}
        title="Resend verification code"
        description="We'll send you a fresh 6-digit code; the one you already received stops working."
        onConfirm={() => {
          setConfirmResendOpen(false);
          if (pendingAction) void sendChallenge(pendingAction);
        }}
        confirmText="Resend code"
      />

      <ConfirmationDialog
        open={confirmDisableOpen}
        onOpenChange={setConfirmDisableOpen}
        title="Turn off two-factor authentication"
        description="Your account will no longer ask for a verification code when signing in with a password. We'll send you a final code to confirm it's you."
        onConfirm={() => {
          setConfirmDisableOpen(false);
          void sendChallenge("disable");
        }}
        confirmText="Send code"
        cancelText="Keep it on"
        isDestructive
      />
    </div>
  );
}
