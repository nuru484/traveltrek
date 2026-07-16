// test/component/two-factor-settings.test.tsx
//
// Settings → Two-factor: status card rendering and the enable flow
// (challenge → 6-digit code → enable). RTK Query hooks are mocked so the
// tests drive only the component's step machine.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import TwoFactorSettings from "@/components/settings/TwoFactorSettings";
import type { ITwoFactorStatus } from "@/types/auth";

const challenge = vi.fn();
const enable = vi.fn();
const disable = vi.fn();

let statusResult: {
  data?: { message: string; data: ITwoFactorStatus };
  error?: unknown;
  isError: boolean;
  isLoading: boolean;
  refetch: () => void;
};

vi.mock("@/redux/auth/authApi", () => ({
  useTwoFactorStatusQuery: () => statusResult,
  useTwoFactorChallengeMutation: () => [challenge, { isLoading: false }],
  useTwoFactorEnableMutation: () => [enable, { isLoading: false }],
  useTwoFactorDisableMutation: () => [disable, { isLoading: false }],
}));

const statusOf = (status: ITwoFactorStatus) => ({
  data: { message: "ok", data: status },
  isError: false,
  isLoading: false,
  refetch: vi.fn(),
});

beforeEach(() => {
  challenge.mockReset();
  enable.mockReset();
  disable.mockReset();
  challenge.mockReturnValue({
    unwrap: () =>
      Promise.resolve({ message: "We sent you a verification code." }),
  });
  enable.mockReturnValue({
    unwrap: () =>
      Promise.resolve({ message: "Two-factor authentication is now on." }),
  });
  statusResult = statusOf({ enabled: false, channel: "email" });
});

describe("TwoFactorSettings", () => {
  it("renders the disabled status with the channel badge", () => {
    render(<TwoFactorSettings />);

    expect(screen.getByText("Off")).toBeInTheDocument();
    expect(screen.getByText("Codes via email")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /turn on two-factor/i })
    ).toBeInTheDocument();
  });

  it("renders the enabled status", () => {
    statusResult = statusOf({ enabled: true, channel: "sms" });
    render(<TwoFactorSettings />);

    expect(screen.getByText("Enabled")).toBeInTheDocument();
    expect(screen.getByText("Codes via SMS")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /turn off two-factor/i })
    ).toBeInTheDocument();
  });

  it("walks the enable flow: challenge, code entry, enable", async () => {
    const user = userEvent.setup();
    render(<TwoFactorSettings />);

    await user.click(
      screen.getByRole("button", { name: /turn on two-factor/i })
    );
    expect(challenge).toHaveBeenCalledTimes(1);

    const codeInput = await screen.findByLabelText("6-digit code");
    await user.type(codeInput, "123456");
    await user.click(
      screen.getByRole("button", { name: /verify & turn on/i })
    );

    expect(enable).toHaveBeenCalledWith({ code: "123456" });
    // Back to the idle state once the flag flips.
    expect(
      await screen.findByRole("button", { name: /turn on two-factor/i })
    ).toBeInTheDocument();
    expect(disable).not.toHaveBeenCalled();
  });

  it("surfaces the no-channel 400 from the challenge", async () => {
    challenge.mockReturnValue({
      unwrap: () =>
        Promise.reject({
          status: 400,
          data: {
            status: "error",
            message:
              "Add an email address or phone number to your profile before using two-factor authentication.",
          },
        }),
    });

    const user = userEvent.setup();
    render(<TwoFactorSettings />);

    await user.click(
      screen.getByRole("button", { name: /turn on two-factor/i })
    );

    // The step never advances to code entry.
    expect(screen.queryByLabelText("6-digit code")).not.toBeInTheDocument();
  });
});
