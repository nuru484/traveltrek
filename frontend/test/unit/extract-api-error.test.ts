// Transport-level and fallback failures must read like something a person
// can act on — never "Failed to fetch", "Bad gateway" or a JSON blob. Real
// backend envelope messages and field errors pass through untouched.
import { describe, expect, it } from "vitest";
import { extractApiErrorMessage } from "@/utils/extractApiErrorMessage";

const NETWORK =
  "Can't reach the server right now. Check your internet connection and try again.";

describe("extractApiErrorMessage — friendly transport errors", () => {
  it("collapses FETCH_ERROR to the network message (raw cause hidden)", () => {
    const result = extractApiErrorMessage({
      status: "FETCH_ERROR",
      error: "TypeError: Failed to fetch",
    });
    expect(result.message).toBe(NETWORK);
    expect(result.hasFieldErrors).toBe(false);
  });

  it("translates a bare 'Failed to fetch' Error message", () => {
    expect(
      extractApiErrorMessage(new TypeError("Failed to fetch")).message
    ).toBe(NETWORK);
  });

  it("gives timeouts an actionable message", () => {
    expect(extractApiErrorMessage({ status: "TIMEOUT_ERROR" }).message).toBe(
      "The request took too long. Please check your connection and try again."
    );
  });

  it("maps bodyless 5xx statuses to temporary-unavailable copy", () => {
    for (const status of [502, 503, 504]) {
      expect(extractApiErrorMessage({ status, data: undefined }).message).toBe(
        "The server is temporarily unavailable. Please try again in a moment."
      );
    }
  });

  it("never shows an HTTP number for unknown statuses", () => {
    const { message } = extractApiErrorMessage({ status: 418, data: undefined });
    expect(message).toBe("Something went wrong. Please try again.");
    expect(message).not.toMatch(/\d{3}/);
  });

  it("passes real backend envelope messages through untouched", () => {
    const result = extractApiErrorMessage({
      status: 401,
      data: { status: "error", message: "Invalid credentials" },
    });
    expect(result.message).toBe("Invalid credentials");
  });

  it("still maps backend validation field errors", () => {
    const result = extractApiErrorMessage({
      status: 400,
      data: {
        status: "error",
        message: "Validation Error",
        details: {
          errors: [{ field: "email", message: "Invalid email address" }],
        },
      },
    });
    expect(result.hasFieldErrors).toBe(true);
    expect(result.fieldErrors).toEqual({ email: "Invalid email address" });
  });

  it("hides unrecognized error shapes behind the generic fallback", () => {
    const { message } = extractApiErrorMessage({ weird: { nested: true } });
    expect(message).toBe("Something went wrong. Please try again.");
    expect(message).not.toContain("{");
  });
});
