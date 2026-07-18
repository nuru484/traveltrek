// src/components/settings/contact-change/ChangeEmailForm.tsx
//
// Change email address - the inline form the Contact card expands (no
// dialog). Email is a LOGIN IDENTIFIER, so the flow re-authenticates first
// (current password, or a code sent to the current contact) then emails a
// confirmation link to the NEW address; the form ends on a "check your new
// inbox" state (/confirm-email-change applies it and signs every session
// out).
"use client";
import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import toast from "react-hot-toast";
import { Loader2, MailCheck } from "lucide-react";
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
import { useChangeEmailMutation } from "@/redux/auth/authApi";
import { applyServerFieldErrors } from "@/utils/apply-server-field-errors";
import { extractApiErrorMessage } from "@/utils/extractApiErrorMessage";
import {
  changeEmailFormSchema,
  IChangeEmailFormSchema,
} from "@/validation/auth-validation";
import { buildChangeEmailPayload } from "../contact-change-logic";
import { ReauthFields } from "./ReauthFields";

export function ChangeEmailForm({ onClose }: { onClose: () => void }) {
  const [changeEmail, { isLoading }] = useChangeEmailMutation();
  const [sentMessage, setSentMessage] = React.useState<string | null>(null);

  const form = useForm<IChangeEmailFormSchema>({
    resolver: zodResolver(changeEmailFormSchema),
    defaultValues: { newEmail: "", method: "password", secret: "" },
  });

  const handleClose = () => {
    form.reset();
    setSentMessage(null);
    onClose();
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

  if (sentMessage) {
    return (
      <div className="space-y-3">
        <p className="flex items-center gap-2 font-semibold">
          <MailCheck className="h-5 w-5 text-primary" aria-hidden />
          Check your new inbox
        </p>
        <p className="text-sm leading-relaxed text-muted-foreground">
          {sentMessage} Confirming signs you out everywhere - you&apos;ll sign
          back in with the new address.
        </p>
        <Button onClick={handleClose} className="cursor-pointer">
          Done
        </Button>
      </div>
    );
  }

  return (
    <Form {...form}>
      <form
        noValidate
        onSubmit={form.handleSubmit(onSubmit)}
        className="space-y-4"
      >
        <p className="text-sm leading-relaxed text-muted-foreground">
          We&apos;ll email a confirmation link to the new address; the change
          only applies once you open it.
        </p>

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

        <ReauthFields form={form} disabled={isLoading} />

        {/* Server errors that belong to no single field stay visible here
            after the toast fades. */}
        <FormRootError />

        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={isLoading} className="cursor-pointer">
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Send confirmation link
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={handleClose}
            disabled={isLoading}
            className="cursor-pointer"
          >
            Cancel
          </Button>
        </div>
      </form>
    </Form>
  );
}
