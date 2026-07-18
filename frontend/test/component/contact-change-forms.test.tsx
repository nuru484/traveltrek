// test/component/contact-change-forms.test.tsx
//
// The Settings -> Contact inline change forms. Mutations are mocked; the tests drive the
// payload shapes (exactly one re-auth proof: currentPassword | code), the
// email "check your new inbox" state, and the phone request → OTP → confirm
// step (which refreshes the session afterwards).
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  ChangeEmailForm,
  ChangePhoneForm,
} from "@/components/settings/contact-change-forms";

const changeEmail = vi.fn();
const changePhone = vi.fn();
const confirmPhoneChange = vi.fn();
const reauthChallenge = vi.fn();
const refreshToken = vi.fn();

vi.mock("@/redux/auth/authApi", () => ({
  useChangeEmailMutation: () => [changeEmail, { isLoading: false }],
  useChangePhoneMutation: () => [changePhone, { isLoading: false }],
  useConfirmPhoneChangeMutation: () => [
    confirmPhoneChange,
    { isLoading: false },
  ],
  useReauthChallengeMutation: () => [reauthChallenge, { isLoading: false }],
}));

vi.mock("@/redux/apiSlice", () => ({
  useRefreshTokenMutation: () => [refreshToken],
}));

const resolved = (message: string) => ({
  unwrap: () => Promise.resolve({ message }),
});

beforeEach(() => {
  vi.clearAllMocks();
  changeEmail.mockReturnValue(resolved("Almost done - confirm from the link."));
  changePhone.mockReturnValue(resolved("Enter the code we sent."));
  confirmPhoneChange.mockReturnValue(resolved("Phone updated."));
  reauthChallenge.mockReturnValue(resolved("Code sent."));
  refreshToken.mockReturnValue(resolved("ok"));
});

describe("ChangeEmailForm", () => {
  it("password re-auth posts {newEmail, currentPassword} then shows the inbox state", async () => {
    const user = userEvent.setup();
    render(<ChangeEmailForm onClose={() => {}} />);

    await user.type(
      screen.getByLabelText("New email address"),
      "new@example.com"
    );
    await user.type(screen.getByLabelText("Current password"), "secret-pass");
    await user.click(
      screen.getByRole("button", { name: "Send confirmation link" })
    );

    expect(changeEmail).toHaveBeenCalledWith({
      newEmail: "new@example.com",
      currentPassword: "secret-pass",
    });
    expect(
      await screen.findByText("Check your new inbox")
    ).toBeInTheDocument();
  });

  it("code re-auth posts {newEmail, code} - no currentPassword", async () => {
    const user = userEvent.setup();
    render(<ChangeEmailForm onClose={() => {}} />);

    await user.type(
      screen.getByLabelText("New email address"),
      "new@example.com"
    );
    await user.click(screen.getByRole("radio", { name: "Send me a code" }));
    await user.click(screen.getByRole("button", { name: "Send code" }));
    expect(reauthChallenge).toHaveBeenCalledTimes(1);

    await user.type(screen.getByLabelText("6-digit code"), "123456");
    await user.click(
      screen.getByRole("button", { name: "Send confirmation link" })
    );

    expect(changeEmail).toHaveBeenCalledWith({
      newEmail: "new@example.com",
      code: "123456",
    });
  });
});

describe("ChangePhoneForm", () => {
  it("walks request -> OTP -> confirm and refreshes the session", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<ChangePhoneForm onClose={onClose} />);

    await user.type(
      screen.getByLabelText("New phone number"),
      "+233540000000"
    );
    await user.type(screen.getByLabelText("Current password"), "secret-pass");
    await user.click(
      screen.getByRole("button", { name: "Text verification code" })
    );

    expect(changePhone).toHaveBeenCalledWith({
      newPhone: "+233540000000",
      currentPassword: "secret-pass",
    });

    // OTP step: the code sent to the NEW phone confirms the change.
    await user.type(await screen.findByLabelText("6-digit code"), "654321");
    await user.click(
      screen.getByRole("button", { name: "Confirm new number" })
    );

    expect(confirmPhoneChange).toHaveBeenCalledWith({ code: "654321" });
    // The backend re-minted this session; the stored user is refreshed.
    await vi.waitFor(() => expect(refreshToken).toHaveBeenCalledTimes(1));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("rejects a malformed OTP before hitting the API", async () => {
    const user = userEvent.setup();
    render(<ChangePhoneForm onClose={() => {}} />);

    await user.type(
      screen.getByLabelText("New phone number"),
      "+233540000000"
    );
    await user.type(screen.getByLabelText("Current password"), "secret-pass");
    await user.click(
      screen.getByRole("button", { name: "Text verification code" })
    );

    await user.type(await screen.findByLabelText("6-digit code"), "12");
    await user.click(
      screen.getByRole("button", { name: "Confirm new number" })
    );

    expect(confirmPhoneChange).not.toHaveBeenCalled();
    expect(
      screen.getByText("Enter the 6-digit code we texted to the new number")
    ).toBeInTheDocument();
  });
});
