// src/components/settings/contact-change/ChangePhoneForm.tsx
//
// Change phone number - the inline form the Contact card expands (no
// dialog). Phone is a LOGIN IDENTIFIER, so the flow re-authenticates first
// (current password, or a code sent to the current contact), then texts an
// OTP to the NEW number; a second step enters it, the backend re-mints THIS
// session's cookies and we refresh the stored user.
"use client";
import * as React from "react";
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
import { FormRootError } from "@/components/ui/form-root-error";
import { useRefreshTokenMutation } from "@/redux/apiSlice";
import {
  useChangePhoneMutation,
  useConfirmPhoneChangeMutation,
} from "@/redux/auth/authApi";
import { applyServerFieldErrors } from "@/utils/apply-server-field-errors";
import { extractApiErrorMessage } from "@/utils/extractApiErrorMessage";
import {
  changePhoneFormSchema,
  IChangePhoneFormSchema,
} from "@/validation/auth-validation";
import {
  buildChangePhonePayload,
  isValidReauthCode,
} from "../contact-change-logic";
import { ReauthFields } from "./ReauthFields";

export function ChangePhoneForm({ onClose }: { onClose: () => void }) {
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

  const handleClose = () => {
    form.reset();
    setOtpStepMessage(null);
    setOtpCode("");
    setOtpError(null);
    onClose();
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
      handleClose();
    } catch (error) {
      setOtpError(
        extractApiErrorMessage(error).message || "Could not confirm the code"
      );
    }
  };

  if (otpStepMessage) {
    return (
      <form noValidate onSubmit={onConfirm} className="space-y-4">
        <p className="text-sm leading-relaxed text-muted-foreground">
          {otpStepMessage}
        </p>

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
          {otpError && <p className="text-xs text-destructive">{otpError}</p>}
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            type="submit"
            disabled={isConfirming}
            className="cursor-pointer"
          >
            {isConfirming && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Confirm new number
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={handleClose}
            disabled={isConfirming}
            className="cursor-pointer"
          >
            Cancel
          </Button>
        </div>
      </form>
    );
  }

  return (
    <Form {...form}>
      <form
        noValidate
        onSubmit={form.handleSubmit(onRequest)}
        className="space-y-4"
      >
        <p className="text-sm leading-relaxed text-muted-foreground">
          We&apos;ll text a verification code to the new number; the change
          only applies once you enter it.
        </p>

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

        <ReauthFields form={form} disabled={isRequesting} />

        {/* Server errors that belong to no single field stay visible here
            after the toast fades. */}
        <FormRootError />

        <div className="flex flex-wrap gap-2">
          <Button
            type="submit"
            disabled={isRequesting}
            className="cursor-pointer"
          >
            {isRequesting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Text verification code
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={handleClose}
            disabled={isRequesting}
            className="cursor-pointer"
          >
            Cancel
          </Button>
        </div>
      </form>
    </Form>
  );
}
