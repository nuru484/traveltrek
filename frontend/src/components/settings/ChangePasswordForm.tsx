// src/components/settings/ChangePasswordForm.tsx
//
// POST /auth/change-password - the ONLY password-writing surface for an
// existing account (staff/customer forms carry no password fields). Works
// for both principals and both modes:
// - account HAS a password: current password required (a wrong one answers
//   the same uniform 401 as login and counts toward the lockout);
// - account is PASSWORDLESS (Google / code-only signup / staff-created):
//   current password stays blank and this SETS the first password.
// The stored user can't tell the two apart, so the field is always shown
// with "leave blank" guidance and the backend's 400s are mapped onto it.
// Success re-issues THIS session's cookies - every other session dies, the
// user stays signed in here.
//
// The tab opens READ-ONLY (a masked password row); the form only mounts
// after Edit, and Cancel/success return to the read-only view.
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
import { FormRootError } from "@/components/ui/form-root-error";
import { useChangePasswordMutation } from "@/redux/auth/authApi";
import { applyServerFieldErrors } from "@/utils/apply-server-field-errors";
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
  const [editing, setEditing] = React.useState(false);

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
        // Blank means "this account has no password yet" - the key must be
        // ABSENT for the passwordless first-set.
        ...(values.currentPassword
          ? { currentPassword: values.currentPassword }
          : {}),
      }).unwrap();
      toast.success(res.message || "Password changed successfully.");
      form.reset({ currentPassword: "", newPassword: "", confirmPassword: "" });
      setEditing(false);
    } catch (err) {
      const { message, fieldErrors, hasFieldErrors } =
        extractApiErrorMessage(err);
      const status =
        typeof err === "object" && err !== null && "status" in err
          ? (err as { status?: unknown }).status
          : undefined;

      if (hasFieldErrors && fieldErrors) {
        const unmatched = applyServerFieldErrors(form.setError, fieldErrors, [
          "currentPassword",
          "newPassword",
          "confirmPassword",
        ]);
        if (unmatched.length > 0) {
          form.setError("root", { message: unmatched.join(" ") });
        }
      } else if (status === 401) {
        // Uniform "Invalid credentials" - the current password didn't verify.
        form.setError("currentPassword", {
          message: "Incorrect current password.",
        });
      } else if (status === 400 && /current ?password/i.test(message)) {
        // "no password yet - omit currentPassword" / "current password is
        // required" - both belong on the current-password field.
        form.setError("currentPassword", { message });
      } else {
        // No field to attach it to: keep the error visible in the form
        // after the toast fades.
        form.setError("root", {
          message: message || "Could not change your password.",
        });
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
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-semibold tracking-tight">Password</h2>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              {editing
                ? "Changing your password signs you out everywhere else - this session stays signed in."
                : "The password you sign in with."}
            </p>
          </div>
          {!editing && (
            <Button
              variant="outline"
              size="sm"
              className="cursor-pointer"
              onClick={() => setEditing(true)}
            >
              Edit
            </Button>
          )}
        </div>

        {!editing ? (
          <div className="mt-6 rounded-lg border border-foreground/15 px-4 py-3">
            <p className="text-sm font-medium">Password</p>
            <p className="mt-1 font-mono text-sm tracking-[0.3em] text-muted-foreground">
              ••••••••
            </p>
          </div>
        ) : (
          <Form {...form}>
          <form
            noValidate
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
                    No password yet (Google or code sign-in)? Leave blank to
                    set your first one.
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

            {/* Server errors that belong to no single field stay visible
                here after the toast fades. */}
            <FormRootError />

            <div className="flex flex-wrap gap-2">
              <Button
                type="submit"
                className="cursor-pointer"
                disabled={isLoading}
              >
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isLoading ? "Saving..." : "Change password"}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="cursor-pointer"
                disabled={isLoading}
                onClick={() => {
                  form.reset({
                    currentPassword: "",
                    newPassword: "",
                    confirmPassword: "",
                  });
                  setEditing(false);
                }}
              >
                Cancel
              </Button>
            </div>
          </form>
        </Form>
        )}
      </div>
    </div>
  );
}
