// src/components/authentication/SignupForm.tsx
"use client";
import Link from "next/link";
import { UseFormReturn } from "react-hook-form";
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
import { ISignupFormSchema } from "@/validation/auth-validation";

const LABEL_CLASS =
  "font-mono text-[10px] font-normal uppercase tracking-[0.18em] text-muted-foreground";
const INPUT_CLASS =
  "h-11 rounded-lg border-foreground/20 bg-background text-[15px] shadow-none";

interface SignupFormProps {
  form: UseFormReturn<ISignupFormSchema>;
  onSubmit: (data: ISignupFormSchema) => Promise<void>;
  isLoading: boolean;
}

/**
 * Minimal registration in the landing page's document voice: a name and at
 * least one contact channel. The system sends a default password to that
 * channel; the profile is completed later inside the app.
 */
export default function SignupForm({
  form,
  onSubmit,
  isLoading,
}: SignupFormProps) {
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
                <FormLabel className={LABEL_CLASS}>Full name</FormLabel>
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

          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel className={LABEL_CLASS}>Email</FormLabel>
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

          <FormField
            control={form.control}
            name="phone"
            render={({ field }) => (
              <FormItem>
                <FormLabel className={LABEL_CLASS}>Phone</FormLabel>
                <FormControl>
                  <Input
                    type="tel"
                    placeholder="+233 54 000 0000"
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

          <p className="text-xs leading-relaxed text-muted-foreground">
            One contact is enough — email or phone. We&apos;ll send your
            default password there, and you can complete your profile once
            you&apos;re in.
          </p>

          <Button
            type="submit"
            disabled={isLoading}
            className="h-11 w-full cursor-pointer rounded-full bg-foreground font-medium text-background hover:bg-foreground/90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating account...
              </>
            ) : (
              "Create account"
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
