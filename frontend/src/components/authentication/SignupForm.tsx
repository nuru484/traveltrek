// src/components/authentication/SignupForm.tsx
"use client";
import React from "react";
import Link from "next/link";
import { UseFormReturn } from "react-hook-form";
import { Loader2, Eye, EyeOff } from "lucide-react";
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ISignupFormSchema } from "@/validation/auth-validation";

const INPUT_CLASS =
  "h-11 rounded-lg border-foreground/20 bg-background text-[15px] shadow-none placeholder:text-muted-foreground/50";

interface SignupFormProps {
  form: UseFormReturn<ISignupFormSchema>;
  onSubmit: (data: ISignupFormSchema) => Promise<void>;
  isLoading: boolean;
}

/**
 * Minimal registration mirroring the backend contract: a name plus ONE
 * contact channel (email or phone — toggled), and an optional password.
 * Passwordless accounts sign in with a one-time code sent to that channel.
 */
export default function SignupForm({
  form,
  onSubmit,
  isLoading,
}: SignupFormProps) {
  const [showPassword, setShowPassword] = React.useState(false);
  const contactMethod = form.watch("contactMethod");

  const handleContactMethodChange = (value: string) => {
    const method = value === "phone" ? "phone" : "email";
    form.setValue("contactMethod", method);
    // Clear the channel that is no longer in play (and its error).
    if (method === "email") {
      form.setValue("phone", "");
      form.clearErrors("phone");
    } else {
      form.setValue("email", "");
      form.clearErrors("email");
    }
  };

  return (
    <div className="w-full">
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="w-full space-y-6"
        >
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Full name</FormLabel>
                <FormControl>
                  <Input
                    placeholder="Amina Fuseini"
                    autoComplete="name"
                    className={INPUT_CLASS}
                    disabled={isLoading}
                    {...field}
                  />
                </FormControl>
                <FormMessage className="text-xs" />
              </FormItem>
            )}
          />

          {/* Contact channel toggle: email OR phone */}
          <div className="space-y-3">
            <Tabs
              value={contactMethod}
              onValueChange={handleContactMethodChange}
              className="w-full"
            >
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="email" className="cursor-pointer">
                  Email
                </TabsTrigger>
                <TabsTrigger value="phone" className="cursor-pointer">
                  Phone
                </TabsTrigger>
              </TabsList>
            </Tabs>

            {contactMethod === "email" ? (
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="you@example.com"
                        autoComplete="email"
                        className={INPUT_CLASS}
                        disabled={isLoading}
                        {...field}
                        value={field.value ?? ""}
                      />
                    </FormControl>
                    <FormMessage className="text-xs" />
                  </FormItem>
                )}
              />
            ) : (
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Input
                        type="tel"
                        placeholder="+233540000000"
                        autoComplete="tel"
                        className={INPUT_CLASS}
                        disabled={isLoading}
                        {...field}
                        value={field.value ?? ""}
                      />
                    </FormControl>
                    <FormMessage className="text-xs" />
                  </FormItem>
                )}
              />
            )}
          </div>

          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Password (optional)</FormLabel>
                <div className="relative">
                  <FormControl>
                    <Input
                      type={showPassword ? "text" : "password"}
                      placeholder="Leave blank to sign in with a code"
                      autoComplete="new-password"
                      className={`${INPUT_CLASS} pr-11`}
                      disabled={isLoading}
                      {...field}
                      value={field.value ?? ""}
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

          <p className="text-xs leading-relaxed text-muted-foreground">
            One contact is enough — skip the password and we&apos;ll sign you
            in with a one-time code sent to it.
          </p>

          <Button
            type="submit"
            disabled={isLoading}
            className="h-11 w-full cursor-pointer rounded-full bg-foreground font-medium text-background hover:bg-foreground/90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Signing up...
              </>
            ) : (
              "Signup"
            )}
          </Button>
        </form>
      </Form>

      <div className="mt-6 text-center">
        <p className="text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link
            href="/login"
            className="font-medium text-foreground underline-offset-4 hover:underline"
          >
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
