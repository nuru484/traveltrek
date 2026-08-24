// test/component/error-boundary.test.tsx
//
// The route-segment error boundary reports the caught error to Sentry on
// mount, then renders the branded fallback with a working retry button.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import * as Sentry from "@sentry/nextjs";
import Error from "@/app/error";

vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
}));

const captureException = vi.mocked(Sentry.captureException);

beforeEach(() => {
  captureException.mockReset();
});

describe("Error boundary", () => {
  it("reports the error to Sentry once on mount", () => {
    const error = new globalThis.Error("boom");

    render(<Error error={error} reset={() => {}} />);

    expect(captureException).toHaveBeenCalledTimes(1);
    expect(captureException).toHaveBeenCalledWith(error);
  });

  it("renders the fallback and wires the retry button", async () => {
    const reset = vi.fn();
    render(<Error error={new globalThis.Error("boom")} reset={reset} />);

    expect(
      screen.getByRole("heading", { name: "Something went wrong." }),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(reset).toHaveBeenCalledTimes(1);
  });
});
