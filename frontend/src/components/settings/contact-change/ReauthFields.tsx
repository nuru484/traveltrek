// src/components/settings/contact-change/ReauthFields.tsx
//
// The shared "confirm it's you" block used by both contact-change dialogs: the
// password/code method toggle plus the secret field (a password input, or a
// 6-digit code input with a Send code button). Generic over any form whose
// values carry `method` and `secret`, so the email and phone dialogs reuse it
// without duplicating ~55 lines of field wiring each.
"use client";
import * as React from "react";
import { type FieldValues, type UseFormReturn } from "react-hook-form";
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { type ReauthMethod } from "../contact-change-logic";
import { MethodToggle } from "./MethodToggle";
import { SendCodeButton } from "./SendCodeButton";

export function ReauthFields<
  T extends FieldValues & { method: ReauthMethod; secret: string },
>({ form, disabled }: { form: UseFormReturn<T>; disabled?: boolean }) {
  const method = form.watch("method" as never) as unknown as ReauthMethod;

  return (
    <>
      <FormField
        control={form.control}
        name={"method" as never}
        render={({ field }) => (
          <FormItem>
            <FormLabel>Confirm it&apos;s you</FormLabel>
            <FormControl>
              <MethodToggle
                method={field.value as ReauthMethod}
                onChange={(value) => {
                  field.onChange(value);
                  form.setValue("secret" as never, "" as never);
                  form.clearErrors("secret" as never);
                }}
                disabled={disabled}
              />
            </FormControl>
            <FormDescription className="text-xs">
              No password on your account? Choose &quot;Send me a code&quot; — it
              goes to your current email or phone.
            </FormDescription>
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name={"secret" as never}
        render={({ field }) => (
          <FormItem>
            <div className="flex items-center justify-between gap-2">
              <FormLabel>
                {method === "password" ? "Current password" : "6-digit code"}
              </FormLabel>
              {method === "code" && <SendCodeButton disabled={disabled} />}
            </div>
            <FormControl>
              {method === "password" ? (
                <PasswordInput
                  placeholder="Enter your current password"
                  autoComplete="current-password"
                  disabled={disabled}
                  {...field}
                />
              ) : (
                <Input
                  type="text"
                  inputMode="numeric"
                  placeholder="Enter the code we sent you"
                  autoComplete="one-time-code"
                  disabled={disabled}
                  {...field}
                />
              )}
            </FormControl>
            <FormMessage className="text-xs" />
          </FormItem>
        )}
      />
    </>
  );
}
