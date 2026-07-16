// test/component/login-two-factor.test.tsx
//
// The password login's 2FA branch: a { twoFactorRequired: true } answer swaps
// the credentials card to the code step, and verify completes the login. All
// auth hooks are mocked — the test drives the page's step machine.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import LoginPage from "@/app/login/page";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

const login = vi.fn();
const verify = vi.fn();
const resend = vi.fn();
vi.mock("@/redux/auth/authApi", () => ({
  useLoginMutation: () => [login, { isLoading: false }],
  useTwoFactorVerifyMutation: () => [verify, { isLoading: false }],
  useTwoFactorResendMutation: () => [resend, { isLoading: false }],
  useOtpRequestMutation: () => [vi.fn(), { isLoading: false }],
  useOtpVerifyMutation: () => [vi.fn(), { isLoading: false }],
  useGoogleSignInMutation: () => [vi.fn(), { isLoading: false }],
}));

const fillAndSubmitCredentials = async (
  user: ReturnType<typeof userEvent.setup>
) => {
  await user.type(screen.getByLabelText("Email"), "amina@example.com");
  // The "Password" tab panel is aria-labelled "Password" too — scope to the input.
  await user.type(
    screen.getByLabelText("Password", { selector: "input" }),
    "secret"
  );
  await user.click(screen.getByRole("button", { name: "Sign In" }));
};

beforeEach(() => {
  push.mockReset();
  login.mockReset();
  verify.mockReset();
  resend.mockReset();
  window.history.replaceState(null, "", "/login");
});

describe("LoginPage 2FA step", () => {
  it("logs straight in when the account has no 2FA", async () => {
    login.mockReturnValue({
      unwrap: () =>
        Promise.resolve({
          message: "Login successful",
          data: { id: 7, name: "Amina" },
        }),
    });

    const user = userEvent.setup();
    render(<LoginPage />);
    await fillAndSubmitCredentials(user);

    expect(push).toHaveBeenCalledWith("/dashboard");
    expect(screen.queryByLabelText("6-digit code")).not.toBeInTheDocument();
  });

  it("swaps to the code step on twoFactorRequired, then verifies", async () => {
    login.mockReturnValue({
      unwrap: () =>
        Promise.resolve({
          message: "Enter the verification code we just sent you.",
          data: { twoFactorRequired: true },
        }),
    });
    verify.mockReturnValue({
      unwrap: () =>
        Promise.resolve({
          message: "Login successful",
          data: { id: 7, name: "Amina" },
        }),
    });

    const user = userEvent.setup();
    render(<LoginPage />);
    await fillAndSubmitCredentials(user);

    // No redirect yet — the code step replaced the credential tabs.
    expect(push).not.toHaveBeenCalled();
    const codeInput = await screen.findByLabelText("6-digit code");

    await user.type(codeInput, "123456");
    await user.click(
      screen.getByRole("button", { name: "Verify & Sign In" })
    );

    expect(verify).toHaveBeenCalledWith({ code: "123456" });
    expect(push).toHaveBeenCalledWith("/dashboard");
  });

  it("returns to the credential tabs from the code step", async () => {
    login.mockReturnValue({
      unwrap: () =>
        Promise.resolve({
          message: "Enter the verification code we just sent you.",
          data: { twoFactorRequired: true },
        }),
    });

    const user = userEvent.setup();
    render(<LoginPage />);
    await fillAndSubmitCredentials(user);

    await screen.findByLabelText("6-digit code");
    await user.click(
      screen.getByRole("button", { name: "Back to sign in" })
    );

    expect(await screen.findByLabelText("Email")).toBeInTheDocument();
    expect(screen.queryByLabelText("6-digit code")).not.toBeInTheDocument();
  });
});
