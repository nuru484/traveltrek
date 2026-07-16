// src/components/authentication/OtpLoginForm.tsx
//
// Passwordless "email me a code" login: request a 6-digit code for an email
// or phone, then verify it. The request step always succeeds on the wire (no
// account enumeration), so the UI moves to the code step unconditionally.
"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
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
import {
  useOtpRequestMutation,
  useOtpVerifyMutation,
} from "@/redux/auth/authApi";
import { extractApiErrorMessage } from "@/utils/extractApiErrorMessage";
import {
  contactToPayload,
  IOtpRequestFormSchema,
  IOtpVerifyFormSchema,
  otpRequestFormSchema,
  otpVerifyFormSchema,
} from "@/validation/auth-validation";

const INPUT_CLASS =
  "h-11 rounded-lg border-foreground/20 bg-background text-[15px] shadow-none placeholder:text-muted-foreground/50";

export default function OtpLoginForm() {
  const router = useRouter();
  const [step, setStep] = React.useState<"request" | "verify">("request");
  const [contact, setContact] = React.useState("");

  const [requestOtp, { isLoading: isRequesting }] = useOtpRequestMutation();
  const [verifyOtp, { isLoading: isVerifying }] = useOtpVerifyMutation();

  const requestForm = useForm<IOtpRequestFormSchema>({
    resolver: zodResolver(otpRequestFormSchema),
    defaultValues: { contact: "" },
  });

  const verifyForm = useForm<IOtpVerifyFormSchema>({
    resolver: zodResolver(otpVerifyFormSchema),
    defaultValues: { code: "" },
  });

  const onRequest = async (data: IOtpRequestFormSchema) => {
    try {
      const result = await requestOtp(contactToPayload(data.contact)).unwrap();
      setContact(data.contact);
      verifyForm.reset({ code: "" });
      setStep("verify");
      toast.success(result.message);
    } catch (err) {
      toast.error(
        extractApiErrorMessage(err).message ||
          "Could not send the code. Please try again."
      );
    }
  };

  const onVerify = async (data: IOtpVerifyFormSchema) => {
    try {
      await verifyOtp({
        ...contactToPayload(contact),
        code: data.code,
      }).unwrap();
      toast.success("Login successful! Redirecting...");
      router.push("/dashboard");
    } catch (err) {
      toast.error(
        extractApiErrorMessage(err).message ||
          "Invalid or expired code. Please try again."
      );
    }
  };

  if (step === "verify") {
    return (
      <div className="w-full">
        <Form {...verifyForm}>
          <form
            onSubmit={verifyForm.handleSubmit(onVerify)}
            className="w-full space-y-6"
          >
            <p className="text-sm text-muted-foreground break-words [overflow-wrap:anywhere]">
              If an account exists for{" "}
              <span className="font-medium text-foreground">{contact}</span>, a
              6-digit code is on its way. Enter it below.
            </p>

            <FormField
              control={verifyForm.control}
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
                      className={`${INPUT_CLASS} text-center font-mono text-lg tracking-[0.5em]`}
                      disabled={isVerifying}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage className="text-xs" />
                </FormItem>
              )}
            />

            <Button
              type="submit"
              className="h-11 w-full cursor-pointer rounded-full bg-foreground font-medium text-background hover:bg-foreground/90 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isVerifying}
            >
              {isVerifying ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Verifying...
                </>
              ) : (
                "Verify & Sign In"
              )}
            </Button>

            <div className="flex items-center justify-between text-sm">
              <button
                type="button"
                onClick={() => setStep("request")}
                className="cursor-pointer font-medium text-foreground underline-offset-4 hover:underline"
                disabled={isVerifying}
              >
                Use a different contact
              </button>
              <button
                type="button"
                onClick={() => onRequest({ contact })}
                className="cursor-pointer text-muted-foreground underline-offset-4 hover:underline disabled:opacity-60"
                disabled={isRequesting || isVerifying}
              >
                {isRequesting ? "Resending..." : "Resend code"}
              </button>
            </div>
          </form>
        </Form>
      </div>
    );
  }

  return (
    <div className="w-full">
      <Form {...requestForm}>
        <form
          onSubmit={requestForm.handleSubmit(onRequest)}
          className="w-full space-y-6"
        >
          <FormField
            control={requestForm.control}
            name="contact"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email or phone</FormLabel>
                <FormControl>
                  <Input
                    placeholder="your.email@example.com or +233540000000"
                    autoComplete="username"
                    className={INPUT_CLASS}
                    disabled={isRequesting}
                    {...field}
                  />
                </FormControl>
                <FormMessage className="text-xs" />
              </FormItem>
            )}
          />

          <p className="text-xs leading-relaxed text-muted-foreground">
            We&apos;ll send a one-time 6-digit code to sign you in — no
            password needed.
          </p>

          <Button
            type="submit"
            className="h-11 w-full cursor-pointer rounded-full bg-foreground font-medium text-background hover:bg-foreground/90 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isRequesting}
          >
            {isRequesting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Sending code...
              </>
            ) : (
              "Email me a code"
            )}
          </Button>
        </form>
      </Form>
    </div>
  );
}
