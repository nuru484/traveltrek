// src/components/settings/ChangePasswordForm.tsx
//
// POST /auth/change-password — the ONLY password-writing surface for an
// existing account (staff/customer forms carry no password fields). Works
// for both principals and both modes:
// - account HAS a password: current password required (a wrong one answers
//   the same uniform 401 as login and counts toward the lockout);
// - account is PASSWORDLESS (Google / code-only signup / staff-created):
//   current password stays blank and this SETS the first password.
// The stored user can't tell the two apart, so the field is always shown
// with "leave blank" guidance and the backend's 400s are mapped onto it.
// Success re-issues THIS session's cookies — every other session dies, the
// user stays signed in here.
"use client";
import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import toast from "react-hot-toast";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useChangePasswordMutation } from "@/redux/auth/authApi";
import { extractApiErrorMessage } from "@/utils/extractApiErrorMessage";
import {
  changePasswordFormSchema,
  IChangePasswordFormSchema,
} from "@/validation/auth-validation";

/** Password input with a show/hide toggle; forwards everything else. */
function PasswordInput({
  disabled,
  ...props
}: Omit<React.ComponentProps<typeof Input>, "type" | "className">) {
  const [show, setShow] = React.useState(false);
  return (
    <div className="relative">
      <Input
        type={show ? "text" : "password"}
        className="pr-11"
        disabled={disabled}
        {...props}
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        className="absolute right-3 top-1/2 -translate-y-1/2 rounded-sm p-0.5 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
        tabIndex={-1}
        disabled={disabled}
        aria-label={show ? "Hide password" : "Show password"}
      >
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}

export default function ChangePasswordForm() {
  const [changePassword, { isLoading }] = useChangePasswordMutation();

  const form = useForm<IChangePasswordFormSchema>({
    resolver: zodResolver(changePasswordFormSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  });

  const onSubmit = async (values: IChangePasswordFormSchema) => {
    try {
      const res = await changePassword({
        newPassword: values.newPassword,
        // Blank means "this account has no password yet" — the key must be
        // ABSENT for the passwordless first-set.
        ...(values.currentPassword
          ? { currentPassword: values.currentPassword }
          : {}),
      }).unwrap();
      toast.success(res.message || "Password changed successfully.");
      form.reset({ currentPassword: "", newPassword: "", confirmPassword: "" });
    } catch (err) {
      const { message, fieldErrors, hasFieldErrors } =
        extractApiErrorMessage(err);
      const status =
        typeof err === "object" && err !== null && "status" in err
          ? (err as { status?: unknown }).status
          : undefined;

      if (hasFieldErrors && fieldErrors) {
        Object.entries(fieldErrors).forEach(([field, errorMessage]) => {
          if (field === "currentPassword" || field === "newPassword") {
            form.setError(field, { message: errorMessage });
          }
        });
      } else if (status === 401) {
        // Uniform "Invalid credentials" — the current password didn't verify.
        form.setError("currentPassword", {
          message: "Incorrect current password.",
        });
      } else if (status === 400 && /current ?password/i.test(message)) {
        // "no password yet — omit currentPassword" / "current password is
        // required" — both belong on the current-password field.
        form.setError("currentPassword", { message });
      }

      toast.error(message || "Could not change your password.");
    }
  };

  return (
    <div className="overflow-hidden rounded-xl border border-foreground/20 bg-card">
      <div className="flex items-center justify-between bg-night px-4 py-2.5 font-mono text-[10px] uppercase tracking-[0.2em] text-night-foreground sm:px-6">
        <span>Travel Trek</span>
        <span className="text-night-foreground/70">Password</span>
      </div>

      <div className="px-4 py-6 sm:px-6">
        <h2 className="text-lg font-semibold tracking-tight">
          Change password
        </h2>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
          Changing your password signs you out everywhere else — this session
          stays signed in.
        </p>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="mt-6 space-y-6"
          >
            <FormField
              control={form.control}
              name="currentPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Current password</FormLabel>
                  <FormControl>
                    <PasswordInput
                      placeholder="Your current password"
                      autoComplete="current-password"
                      disabled={isLoading}
                      {...field}
                      value={field.value ?? ""}
                    />
                  </FormControl>
                  <FormDescription className="text-xs leading-relaxed">
                    Leave blank if you haven&apos;t set a password yet (Google
                    or code-only sign-in) — this will set your first one.
                  </FormDescription>
                  <FormMessage className="text-xs" />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="newPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>New password</FormLabel>
                  <FormControl>
                    <PasswordInput
                      placeholder="At least 4 characters"
                      autoComplete="new-password"
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
              name="confirmPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Confirm new password</FormLabel>
                  <FormControl>
                    <PasswordInput
                      placeholder="Repeat the new password"
                      autoComplete="new-password"
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
              className="w-full cursor-pointer sm:w-auto"
              disabled={isLoading}
            >
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isLoading ? "Saving..." : "Change password"}
            </Button>
          </form>
        </Form>
      </div>
    </div>
  );
}
