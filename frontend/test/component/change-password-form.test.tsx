// test/component/change-password-form.test.tsx
//
// The Settings → Password form over POST /auth/change-password. The mutation
// hook is mocked so the tests drive only payload shaping (blank current
// password = key ABSENT for the passwordless first-set) and the mapping of
// the backend's uniform 401 onto the current-password field.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ChangePasswordForm from "@/components/settings/ChangePasswordForm";

const changePassword = vi.fn();
vi.mock("@/redux/auth/authApi", () => ({
  useChangePasswordMutation: () => [changePassword, { isLoading: false }],
}));

beforeEach(() => {
  changePassword.mockReset();
  changePassword.mockReturnValue({
    unwrap: () => Promise.resolve({ message: "Password changed successfully." }),
  });
});

describe("ChangePasswordForm", () => {
  it("omits currentPassword entirely when left blank (first-set)", async () => {
    const user = userEvent.setup();
    render(<ChangePasswordForm />);

    await user.type(screen.getByLabelText("New password"), "new-secret");
    await user.type(
      screen.getByLabelText("Confirm new password"),
      "new-secret"
    );
    await user.click(screen.getByRole("button", { name: "Change password" }));

    expect(changePassword).toHaveBeenCalledWith({ newPassword: "new-secret" });
  });

  it("sends currentPassword when filled (rotation)", async () => {
    const user = userEvent.setup();
    render(<ChangePasswordForm />);

    await user.type(screen.getByLabelText("Current password"), "old-secret");
    await user.type(screen.getByLabelText("New password"), "new-secret");
    await user.type(
      screen.getByLabelText("Confirm new password"),
      "new-secret"
    );
    await user.click(screen.getByRole("button", { name: "Change password" }));

    expect(changePassword).toHaveBeenCalledWith({
      currentPassword: "old-secret",
      newPassword: "new-secret",
    });
  });

  it("blocks a mismatched confirmation before hitting the API", async () => {
    const user = userEvent.setup();
    render(<ChangePasswordForm />);

    await user.type(screen.getByLabelText("New password"), "new-secret");
    await user.type(screen.getByLabelText("Confirm new password"), "other");
    await user.click(screen.getByRole("button", { name: "Change password" }));

    expect(
      await screen.findByText("Passwords do not match")
    ).toBeInTheDocument();
    expect(changePassword).not.toHaveBeenCalled();
  });

  it("maps the uniform 401 to a current-password field error", async () => {
    changePassword.mockReturnValue({
      unwrap: () =>
        Promise.reject({
          status: 401,
          data: { status: "error", message: "Invalid credentials" },
        }),
    });

    const user = userEvent.setup();
    render(<ChangePasswordForm />);

    await user.type(screen.getByLabelText("Current password"), "wrong-pass");
    await user.type(screen.getByLabelText("New password"), "new-secret");
    await user.type(
      screen.getByLabelText("Confirm new password"),
      "new-secret"
    );
    await user.click(screen.getByRole("button", { name: "Change password" }));

    expect(
      await screen.findByText("Incorrect current password.")
    ).toBeInTheDocument();
  });

  it("maps the wrongly-present-currentPassword 400 onto the field", async () => {
    changePassword.mockReturnValue({
      unwrap: () =>
        Promise.reject({
          status: 400,
          data: {
            status: "error",
            message:
              "This account has no password yet — omit currentPassword to set one.",
          },
        }),
    });

    const user = userEvent.setup();
    render(<ChangePasswordForm />);

    await user.type(screen.getByLabelText("Current password"), "whatever");
    await user.type(screen.getByLabelText("New password"), "new-secret");
    await user.type(
      screen.getByLabelText("Confirm new password"),
      "new-secret"
    );
    await user.click(screen.getByRole("button", { name: "Change password" }));

    expect(
      await screen.findByText(
        "This account has no password yet — omit currentPassword to set one."
      )
    ).toBeInTheDocument();
  });
});
