// src/components/authentication/LoginForm.tsx
"use client";
import React from "react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Loader2, Eye, EyeOff } from "lucide-react";
import { ILoginFormSchema } from "@/validation/auth-validation";
import { UseFormReturn } from "react-hook-form";

interface LoginFormContentProps {
  form: UseFormReturn<ILoginFormSchema>;
  onSubmit: (data: ILoginFormSchema) => Promise<void>;
  isLoading: boolean;
}

export default function LoginForm({
  form,
  onSubmit,
  isLoading,
}: LoginFormContentProps) {
  const [showPassword, setShowPassword] = React.useState(false);

  const handleSubmit = async (data: ILoginFormSchema) => {
    try {
      await onSubmit(data);
    } catch {
      // onSubmit surfaces its own error feedback
    }
  };

  return (
    <div className="w-full">
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(handleSubmit)}
          className="w-full space-y-6"
        >
          {/* Email Field */}
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  Email
                </FormLabel>
                <FormControl>
                  <Input
                    placeholder="your.email@example.com"
                    type="email"
                    autoComplete="email"
                    className="h-11 rounded-lg border-foreground/20 bg-background text-[15px] shadow-none placeholder:text-muted-foreground/50"
                    disabled={isLoading}
                    {...field}
                  />
                </FormControl>
                <FormMessage className="text-xs" />
              </FormItem>
            )}
          />

          {/* Password Field */}
          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <div className="flex items-center justify-between mb-2">
                  <FormLabel>
                    Password
                  </FormLabel>
                  <Link
                    href="/forgot-password"
                    className="text-xs font-medium text-foreground underline-offset-4 hover:underline"
                    tabIndex={isLoading ? -1 : 0}
                  >
                    Forgot password?
                  </Link>
                </div>
                {/* The wrapper sits OUTSIDE FormControl so the label's id
                    lands on the input itself, not this div. */}
                <div className="relative">
                  <FormControl>
                    <Input
                      type={showPassword ? "text" : "password"}
                      placeholder="Enter your password"
                      autoComplete="current-password"
                      className="h-11 rounded-lg border-foreground/20 bg-background text-[15px] shadow-none placeholder:text-muted-foreground/50 pr-11"
                      disabled={isLoading}
                      {...field}
                    />
                  </FormControl>
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm p-0.5 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
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

          {/* Submit Button */}
          <Button
            type="submit"
            className="h-11 w-full cursor-pointer rounded-full bg-foreground font-medium text-background hover:bg-foreground/90 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Signing in...
              </>
            ) : (
              "Sign In"
            )}
          </Button>
        </form>
      </Form>

      {/* Sign Up Link */}
      <div className="mt-6 text-center">
        <p className="text-sm text-muted-foreground">
          Don&apos;t have an account?{" "}
          <Link
            href="/signup"
            className="font-medium text-foreground underline-offset-4 hover:underline"
          >
            Signup
          </Link>
        </p>
      </div>
    </div>
  );
}
