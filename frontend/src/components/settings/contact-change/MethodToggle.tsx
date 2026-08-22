// src/components/settings/contact-change/MethodToggle.tsx
//
// The two-way re-auth proof toggle shared by both contact-change dialogs:
// the account password, or a code sent to the account's current contact
// (the passwordless path).
"use client";
import * as React from "react";
import { type ReauthMethod } from "../contact-change-logic";

/** Toggle between the two re-auth proofs (password / emailed-texted code). */
export function MethodToggle({
  method,
  onChange,
  disabled,
}: {
  method: ReauthMethod;
  onChange: (method: ReauthMethod) => void;
  disabled?: boolean;
}) {
  const options: Array<{ value: ReauthMethod; label: string }> = [
    { value: "password", label: "Use my password" },
    { value: "code", label: "Send me a code" },
  ];
  return (
    <div
      role="radiogroup"
      aria-label="How do you want to confirm it's you?"
      className="grid grid-cols-2 gap-2"
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={method === option.value}
          disabled={disabled}
          onClick={() => onChange(option.value)}
          className={`cursor-pointer rounded-lg border px-3 py-2 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
            method === option.value
              ? "border-foreground bg-foreground text-background"
              : "border-border text-muted-foreground hover:text-foreground"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
