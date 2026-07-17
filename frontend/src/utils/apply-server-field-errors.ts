// src/utils/apply-server-field-errors.ts
//
// Maps extractApiErrorMessage's fieldErrors onto react-hook-form fields.
// Server field names don't always match a form's schema (e.g. the backend
// validates payload keys the form never renders), so only names the form
// actually owns are attached; every other message is RETURNED so the caller
// can surface it on the form's root error instead of silently losing it.
import type { FieldValues, Path, UseFormSetError } from "react-hook-form";

export function applyServerFieldErrors<TFieldValues extends FieldValues>(
  setError: UseFormSetError<TFieldValues>,
  fieldErrors: Record<string, string>,
  formFields: readonly string[]
): string[] {
  const unmatched: string[] = [];

  Object.entries(fieldErrors).forEach(([field, message]) => {
    if (formFields.includes(field)) {
      setError(field as Path<TFieldValues>, { message });
    } else {
      unmatched.push(message);
    }
  });

  return unmatched;
}
