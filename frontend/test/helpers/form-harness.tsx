// test/helpers/form-harness.tsx
//
// Renders a presentational form component (which takes `form` + `onSubmit` as
// props) inside a real react-hook-form instance, so component tests can fill
// fields and submit without each test re-wiring useForm/zodResolver. Select-only
// fields are satisfied via `defaultValues` to keep tests off brittle Radix
// interactions.
import * as React from "react";
import {
  useForm,
  type UseFormReturn,
  type FieldValues,
  type DefaultValues,
} from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

interface FormHarnessProps<T extends FieldValues> {
  // Zod schema; typed loosely to avoid resolver generic friction in tests.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  schema: any;
  defaultValues: DefaultValues<T>;
  render: (form: UseFormReturn<T>) => React.ReactNode;
}

export function FormHarness<T extends FieldValues>({
  schema,
  defaultValues,
  render,
}: FormHarnessProps<T>) {
  const form = useForm<T>({
    resolver: zodResolver(schema),
    defaultValues,
  });
  return <>{render(form)}</>;
}
