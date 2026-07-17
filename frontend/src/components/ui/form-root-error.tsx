"use client";
// Persistent form-level error, rendered inline inside the form (the toast
// disappears; this stays until the next submission). Set it in a submit
// handler's catch with `form.setError("root", { message })` — react-hook-form
// clears root errors automatically when the form is submitted again.
import { useFormContext } from "react-hook-form";
import { AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export function FormRootError({ className }: { className?: string }) {
  const { formState } = useFormContext();
  const message = formState.errors.root?.message;

  if (!message) return null;

  return (
    <div
      role="alert"
      className={cn(
        "flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive",
        className,
      )}
    >
      <AlertCircle className="mt-0.5 h-4 w-4 flex-none" aria-hidden />
      <p className="min-w-0">{message}</p>
    </div>
  );
}
