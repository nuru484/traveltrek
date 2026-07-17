// test/component/otp-login-form.test.tsx
//
// The passwordless login flow: request a code for an email or phone, then
// verify it. RTK Query hooks are mocked so the test drives only the
// component's step machine and payload shaping.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import OtpLoginForm from "@/components/authentication/OtpLoginForm";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

const requestOtp = vi.fn();
const verifyOtp = vi.fn();
vi.mock("@/redux/auth/authApi", () => ({
  useOtpRequestMutation: () => [requestOtp, { isLoading: false }],
  useOtpVerifyMutation: () => [verifyOtp, { isLoading: false }],
}));

beforeEach(() => {
  push.mockReset();
  requestOtp.mockReset();
  verifyOtp.mockReset();
  requestOtp.mockReturnValue({
    unwrap: () => Promise.resolve({ message: "Code sent" }),
  });
  verifyOtp.mockReturnValue({
    unwrap: () => Promise.resolve({ message: "ok", data: { id: 1 } }),
  });
  window.history.replaceState(null, "", "/login");
});

describe("OtpLoginForm", () => {
  it("requests a code then verifies it (happy path)", async () => {
    const user = userEvent.setup();
    render(<OtpLoginForm />);

    await user.type(
      screen.getByLabelText("Email or phone"),
      "amina@example.com"
    );
    await user.click(screen.getByRole("button", { name: "Send me a code" }));

    expect(requestOtp).toHaveBeenCalledWith({ email: "amina@example.com" });

    // Step 2: the verify screen shows the contact and takes the code.
    expect(await screen.findByLabelText("6-digit code")).toBeInTheDocument();
    expect(screen.getByText("amina@example.com")).toBeInTheDocument();

    await user.type(screen.getByLabelText("6-digit code"), "123456");
    await user.click(
      screen.getByRole("button", { name: "Verify & Sign In" })
    );

    expect(verifyOtp).toHaveBeenCalledWith({
      email: "amina@example.com",
      code: "123456",
    });
    expect(push).toHaveBeenCalledWith("/dashboard");
  });

  it("sends a phone contact as { phone }", async () => {
    const user = userEvent.setup();
    render(<OtpLoginForm />);

    await user.type(screen.getByLabelText("Email or phone"), "+233540000000");
    await user.click(screen.getByRole("button", { name: "Send me a code" }));

    expect(requestOtp).toHaveBeenCalledWith({ phone: "+233540000000" });
  });

  it("rejects an invalid contact before hitting the API", async () => {
    const user = userEvent.setup();
    render(<OtpLoginForm />);

    await user.type(screen.getByLabelText("Email or phone"), "not-a-contact");
    await user.click(screen.getByRole("button", { name: "Send me a code" }));

    expect(
      await screen.findByText("Enter a valid email address or phone number")
    ).toBeInTheDocument();
    expect(requestOtp).not.toHaveBeenCalled();
  });
});
