// test/component/confirm-email-change.test.tsx
//
// The public /confirm-email-change?token= page: posts the emailed token once
// on load and renders success / error / missing-token states with a path
// back to login (the confirm bumps the session epoch — everyone re-logs-in).
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import ConfirmEmailChangePage from "@/app/confirm-email-change/page";

let urlToken: string | null = "tok-123";
vi.mock("next/navigation", () => ({
  useSearchParams: () => ({
    get: (name: string) => (name === "token" ? urlToken : null),
  }),
}));

// The landing Header pulls in nav/auth machinery irrelevant to these states.
vi.mock("@/components/index/Header", () => ({
  default: () => <header />,
}));

type MutationState = {
  isLoading: boolean;
  isSuccess: boolean;
  isError: boolean;
  data?: { message: string };
  error?: unknown;
};

const confirmEmailChange = vi.fn();
let mutationState: MutationState;
vi.mock("@/redux/auth/authApi", () => ({
  useConfirmEmailChangeMutation: () => [confirmEmailChange, mutationState],
}));

beforeEach(() => {
  confirmEmailChange.mockReset();
  urlToken = "tok-123";
  mutationState = { isLoading: false, isSuccess: false, isError: false };
});

describe("ConfirmEmailChangePage", () => {
  it("posts the token exactly once on load", () => {
    mutationState = { isLoading: true, isSuccess: false, isError: false };
    render(<ConfirmEmailChangePage />);
    expect(confirmEmailChange).toHaveBeenCalledTimes(1);
    expect(confirmEmailChange).toHaveBeenCalledWith({ token: "tok-123" });
    expect(
      screen.getByText("Confirming your new email address…")
    ).toBeInTheDocument();
  });

  it("renders the success state with a login link", () => {
    mutationState = {
      isLoading: false,
      isSuccess: true,
      isError: false,
      data: { message: "Your email address has been updated." },
    };
    render(<ConfirmEmailChangePage />);
    expect(screen.getByText("Email address updated.")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Sign in with your new email" })
    ).toHaveAttribute("href", "/login");
  });

  it("renders the error state with the backend message", () => {
    mutationState = {
      isLoading: false,
      isSuccess: false,
      isError: true,
      error: {
        status: 401,
        data: { message: "Invalid or expired confirmation link" },
      },
    };
    render(<ConfirmEmailChangePage />);
    expect(
      screen.getByText("We couldn't confirm the change.")
    ).toBeInTheDocument();
    expect(
      screen.getByText("Invalid or expired confirmation link")
    ).toBeInTheDocument();
  });

  it("explains a missing token without posting anything", () => {
    urlToken = null;
    render(<ConfirmEmailChangePage />);
    expect(confirmEmailChange).not.toHaveBeenCalled();
    expect(screen.getByText("Invalid confirmation link.")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Back to sign in" })
    ).toHaveAttribute("href", "/login");
  });
});
