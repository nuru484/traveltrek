// test/unit/apply-server-field-errors.test.ts
//
// applyServerFieldErrors attaches server field errors only to names the
// form actually owns and returns the rest, so callers can surface unknown
// fields' messages on the root error instead of silently losing them.
import { describe, expect, it, vi } from "vitest";
import type { UseFormSetError } from "react-hook-form";
import { applyServerFieldErrors } from "@/utils/apply-server-field-errors";

type Values = { email: string; password: string };

describe("applyServerFieldErrors", () => {
  it("attaches known fields and returns no unmatched messages", () => {
    const setError = vi.fn() as unknown as UseFormSetError<Values>;

    const unmatched = applyServerFieldErrors(
      setError,
      { email: "Email is taken", password: "Too short" },
      ["email", "password"]
    );

    expect(setError).toHaveBeenCalledWith("email", {
      message: "Email is taken",
    });
    expect(setError).toHaveBeenCalledWith("password", {
      message: "Too short",
    });
    expect(unmatched).toEqual([]);
  });

  it("returns messages for fields the form does not render", () => {
    const setError = vi.fn() as unknown as UseFormSetError<Values>;

    const unmatched = applyServerFieldErrors(
      setError,
      { email: "Email is taken", token: "Token expired" },
      ["email", "password"]
    );

    expect(setError).toHaveBeenCalledTimes(1);
    expect(setError).toHaveBeenCalledWith("email", {
      message: "Email is taken",
    });
    expect(unmatched).toEqual(["Token expired"]);
  });
});
