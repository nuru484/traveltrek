// src/components/settings/contact-change-dialogs.tsx
//
// The secure contact-change dialogs (Settings → Contact). Email and phone are
// LOGIN IDENTIFIERS, so both flows re-authenticate first — with the current
// password, or (for passwordless accounts) a code sent to the CURRENT contact
// via POST /auth/reauth/challenge — then prove possession of the NEW contact:
//
// - email: a confirmation link goes to the new inbox; the dialog ends on a
//   "check your new inbox" state (/confirm-email-change applies it and signs
//   every session out);
// - phone: an OTP goes to the new number; a second step enters it, the
//   backend re-mints THIS session's cookies and we refresh the stored user.
"use client";
import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import toast from "react-hot-toast";
import { Loader2, MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { FormRootError } from "@/components/ui/form-root-error";
import { useRefreshTokenMutation } from "@/redux/apiSlice";
import {
  useChangeEmailMutation,
  useChangePhoneMutation,
  useConfirmPhoneChangeMutation,
  useReauthChallengeMutation,
} from "@/redux/auth/authApi";
import { applyServerFieldErrors } from "@/utils/apply-server-field-errors";
import { extractApiErrorMessage } from "@/utils/extractApiErrorMessage";
import {
  changeEmailFormSchema,
  changePhoneFormSchema,
  IChangeEmailFormSchema,
  IChangePhoneFormSchema,
} from "@/validation/auth-validation";
import {
  buildChangeEmailPayload,
  buildChangePhonePayload,
  isValidReauthCode,
  type ReauthMethod,
} from "./contact-change-logic";

/** Toggle between the two re-auth proofs (password / emailed-texted code). */
function MethodToggle({
  method,
  onChange,
  disabled,
}: {
  method: ReauthMethod;
  onChange: (method: ReauthMethod) => void;
  disabled?: boolean;
}) {
  const options: Array<{ value: ReauthMethod; label: string }> = [
    { value: "password", label: "Use my password" },
    { value: "code", label: "Send me a code" },
  ];
  return (
    <div
      role="radiogroup"
      aria-label="How do you want to confirm it's you?"
      className="grid grid-cols-2 gap-2"
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={method === option.value}
          disabled={disabled}
          onClick={() => onChange(option.value)}
          className={`cursor-pointer rounded-lg border px-3 py-2 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
            method === option.value
              ? "border-foreground bg-foreground text-background"
              : "border-border text-muted-foreground hover:text-foreground"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

/** "Send code" helper for the passwordless re-auth path. */
function SendCodeButton({ disabled }: { disabled?: boolean }) {
  const [reauthChallenge, { isLoading }] = useReauthChallengeMutation();

  const handleSend = async () => {
    try {
      const result = await reauthChallenge().unwrap();
      toast.success(result.message || "Code sent to your current contact");
    } catch (error) {
      toast.error(
        extractApiErrorMessage(error).message || "Could not send the code"
      );
    }
  };

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={handleSend}
      disabled={disabled || isLoading}
      className="cursor-pointer"
    >
      {isLoading && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
      Send code
    </Button>
  );
}

// ---------------------------------------------------------------------------
// Email
// ---------------------------------------------------------------------------

export function ChangeEmailDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [changeEmail, { isLoading }] = useChangeEmailMutation();
  const [sentMessage, setSentMessage] = React.useState<string | null>(null);

  const form = useForm<IChangeEmailFormSchema>({
    resolver: zodResolver(changeEmailFormSchema),
    defaultValues: { newEmail: "", method: "password", secret: "" },
  });
  const method = form.watch("method");

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      form.reset();
      setSentMessage(null);
    }
    onOpenChange(nextOpen);
  };

  const onSubmit = async (values: IChangeEmailFormSchema) => {
    try {
      const result = await changeEmail(
        buildChangeEmailPayload(values.newEmail, values.method, values.secret)
      ).unwrap();
      setSentMessage(result.message);
    } catch (error) {
      const { message, fieldErrors, hasFieldErrors } =
        extractApiErrorMessage(error);
      const fallback = "Could not start the email change";

      if (hasFieldErrors && fieldErrors) {
        // Real field errors land on their fields; anything else (e.g. a
        // wrong password / bad code) shows as the form-level error below.
        const unmatched = applyServerFieldErrors(form.setError, fieldErrors, [
          "newEmail",
          "method",
          "secret",
        ]);
        if (unmatched.length > 0) {
          form.setError("root", { message: unmatched.join(" ") });
        }
      } else {
        form.setError("root", { message: message || fallback });
      }

      toast.error(message || fallback);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-[95vw] gap-5 sm:max-w-md">
        {sentMessage ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <MailCheck className="h-5 w-5 text-primary" aria-hidden />
                Check your new inbox
              </DialogTitle>
              <DialogDescription className="text-left">
                {sentMessage} For security, confirming signs you out
                everywhere — you&apos;ll sign back in with the new address.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                onClick={() => handleOpenChange(false)}
                className="w-full cursor-pointer sm:w-auto"
              >
                Done
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Change email address</DialogTitle>
              <DialogDescription className="text-left">
                We&apos;ll email a confirmation link to the new address; the
                change only applies once you open it.
              </DialogDescription>
            </DialogHeader>

            <Form {...form}>
              <form
                noValidate
                onSubmit={form.handleSubmit(onSubmit)}
                className="space-y-4"
              >
                <FormField
                  control={form.control}
                  name="newEmail"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>New email address</FormLabel>
                      <FormControl>
                        <Input
                          type="email"
                          placeholder="you@example.com"
                          autoComplete="email"
                          disabled={isLoading}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage className="text-xs" />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="method"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Confirm it&apos;s you</FormLabel>
                      <FormControl>
                        <MethodToggle
                          method={field.value}
                          onChange={(value) => {
                            field.onChange(value);
                            form.setValue("secret", "");
                            form.clearErrors("secret");
                          }}
                          disabled={isLoading}
                        />
                      </FormControl>
                      <FormDescription className="text-xs">
                        No password on your account? Choose &quot;Send me a
                        code&quot; — it goes to your current email or phone.
                      </FormDescription>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="secret"
                  render={({ field }) => (
                    <FormItem>
                      <div className="flex items-center justify-between gap-2">
                        <FormLabel>
                          {method === "password"
                            ? "Current password"
                            : "6-digit code"}
                        </FormLabel>
                        {method === "code" && (
                          <SendCodeButton disabled={isLoading} />
                        )}
                      </div>
                      <FormControl>
                        {method === "password" ? (
                          <PasswordInput
                            placeholder="Enter your current password"
                            autoComplete="current-password"
                            disabled={isLoading}
                            {...field}
                          />
                        ) : (
                          <Input
                            type="text"
                            inputMode="numeric"
                            placeholder="Enter the code we sent you"
                            autoComplete="one-time-code"
                            disabled={isLoading}
                            {...field}
                          />
                        )}
                      </FormControl>
                      <FormMessage className="text-xs" />
                    </FormItem>
                  )}
                />

                {/* Server errors that belong to no single field stay
                    visible here after the toast fades. */}
                <FormRootError />

                <DialogFooter className="gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => handleOpenChange(false)}
                    disabled={isLoading}
                    className="cursor-pointer"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={isLoading}
                    className="cursor-pointer"
                  >
                    {isLoading && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    Send confirmation link
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Phone
// ---------------------------------------------------------------------------

export function ChangePhoneDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [changePhone, { isLoading: isRequesting }] = useChangePhoneMutation();
  const [confirmPhoneChange, { isLoading: isConfirming }] =
    useConfirmPhoneChangeMutation();
  const [refreshToken] = useRefreshTokenMutation();

  /** null = request step; a string = the OTP step (the backend's message). */
  const [otpStepMessage, setOtpStepMessage] = React.useState<string | null>(
    null
  );
  const [otpCode, setOtpCode] = React.useState("");
  const [otpError, setOtpError] = React.useState<string | null>(null);

  const form = useForm<IChangePhoneFormSchema>({
    resolver: zodResolver(changePhoneFormSchema),
    defaultValues: { newPhone: "", method: "password", secret: "" },
  });
  const method = form.watch("method");

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      form.reset();
      setOtpStepMessage(null);
      setOtpCode("");
      setOtpError(null);
    }
    onOpenChange(nextOpen);
  };

  const onRequest = async (values: IChangePhoneFormSchema) => {
    try {
      const result = await changePhone(
        buildChangePhonePayload(values.newPhone, values.method, values.secret)
      ).unwrap();
      setOtpStepMessage(result.message);
    } catch (error) {
      const { message, fieldErrors, hasFieldErrors } =
        extractApiErrorMessage(error);
      const fallback = "Could not start the phone change";

      if (hasFieldErrors && fieldErrors) {
        // Real field errors land on their fields; anything else (e.g. a
        // wrong password / bad code) shows as the form-level error below.
        const unmatched = applyServerFieldErrors(form.setError, fieldErrors, [
          "newPhone",
          "method",
          "secret",
        ]);
        if (unmatched.length > 0) {
          form.setError("root", { message: unmatched.join(" ") });
        }
      } else {
        form.setError("root", { message: message || fallback });
      }

      toast.error(message || fallback);
    }
  };

  const onConfirm = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!isValidReauthCode(otpCode)) {
      setOtpError("Enter the 6-digit code we texted to the new number");
      return;
    }
    try {
      const result = await confirmPhoneChange({ code: otpCode }).unwrap();
      // The backend re-minted this session at the new epoch; refresh the
      // stored user so the new phone shows up immediately.
      await refreshToken().unwrap();
      toast.success(result.message || "Your phone number has been updated.");
      handleOpenChange(false);
    } catch (error) {
      setOtpError(
        extractApiErrorMessage(error).message || "Could not confirm the code"
      );
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-[95vw] gap-5 sm:max-w-md">
        {otpStepMessage ? (
          <>
            <DialogHeader>
              <DialogTitle>Enter the verification code</DialogTitle>
              <DialogDescription className="text-left">
                {otpStepMessage}
              </DialogDescription>
            </DialogHeader>

            <form noValidate onSubmit={onConfirm} className="space-y-4">
              <div className="space-y-2">
                <label
                  htmlFor="phone-otp"
                  className="text-sm font-medium leading-none"
                >
                  6-digit code
                </label>
                <Input
                  id="phone-otp"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="123456"
                  maxLength={6}
                  value={otpCode}
                  onChange={(event) => {
                    setOtpCode(event.target.value.replace(/\D/g, ""));
                    setOtpError(null);
                  }}
                  disabled={isConfirming}
                />
                {otpError && (
                  <p className="text-xs text-destructive">{otpError}</p>
                )}
              </div>

              <DialogFooter className="gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleOpenChange(false)}
                  disabled={isConfirming}
                  className="cursor-pointer"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isConfirming}
                  className="cursor-pointer"
                >
                  {isConfirming && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Confirm new number
                </Button>
              </DialogFooter>
            </form>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Change phone number</DialogTitle>
              <DialogDescription className="text-left">
                We&apos;ll text a verification code to the new number; the
                change only applies once you enter it.
              </DialogDescription>
            </DialogHeader>

            <Form {...form}>
              <form
                noValidate
                onSubmit={form.handleSubmit(onRequest)}
                className="space-y-4"
              >
                <FormField
                  control={form.control}
                  name="newPhone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>New phone number</FormLabel>
                      <FormControl>
                        <Input
                          type="tel"
                          placeholder="+233 54 000 0000"
                          autoComplete="tel"
                          disabled={isRequesting}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage className="text-xs" />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="method"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Confirm it&apos;s you</FormLabel>
                      <FormControl>
                        <MethodToggle
                          method={field.value}
                          onChange={(value) => {
                            field.onChange(value);
                            form.setValue("secret", "");
                            form.clearErrors("secret");
                          }}
                          disabled={isRequesting}
                        />
                      </FormControl>
                      <FormDescription className="text-xs">
                        No password on your account? Choose &quot;Send me a
                        code&quot; — it goes to your current email or phone.
                      </FormDescription>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="secret"
                  render={({ field }) => (
                    <FormItem>
                      <div className="flex items-center justify-between gap-2">
                        <FormLabel>
                          {method === "password"
                            ? "Current password"
                            : "6-digit code"}
                        </FormLabel>
                        {method === "code" && (
                          <SendCodeButton disabled={isRequesting} />
                        )}
                      </div>
                      <FormControl>
                        {method === "password" ? (
                          <PasswordInput
                            placeholder="Enter your current password"
                            autoComplete="current-password"
                            disabled={isRequesting}
                            {...field}
                          />
                        ) : (
                          <Input
                            type="text"
                            inputMode="numeric"
                            placeholder="Enter the code we sent you"
                            autoComplete="one-time-code"
                            disabled={isRequesting}
                            {...field}
                          />
                        )}
                      </FormControl>
                      <FormMessage className="text-xs" />
                    </FormItem>
                  )}
                />

                {/* Server errors that belong to no single field stay
                    visible here after the toast fades. */}
                <FormRootError />

                <DialogFooter className="gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => handleOpenChange(false)}
                    disabled={isRequesting}
                    className="cursor-pointer"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={isRequesting}
                    className="cursor-pointer"
                  >
                    {isRequesting && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    Text verification code
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
