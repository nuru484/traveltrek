// test/component/signup-form.test.tsx
//
// SignupForm is presentational (takes form + onSubmit), so it renders inside
// the FormHarness with the real zod schema — the email-or-phone rule is
// exercised end to end through react-hook-form.
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SignupForm from "@/components/authentication/SignupForm";
import {
  signupFormSchema,
  type ISignupFormSchema,
} from "@/validation/auth-validation";
import { FormHarness } from "../helpers/form-harness";

const defaultValues: ISignupFormSchema = {
  name: "",
  contactMethod: "email",
  email: "",
  phone: "",
  password: "",
};

function renderSignup(onSubmit = vi.fn()) {
  render(
    <FormHarness<ISignupFormSchema>
      schema={signupFormSchema}
      defaultValues={defaultValues}
      render={(form) => (
        <SignupForm form={form} onSubmit={onSubmit} isLoading={false} />
      )}
    />
  );
  return onSubmit;
}

describe("SignupForm", () => {
  it("blocks submission when the chosen contact channel is empty", async () => {
    const user = userEvent.setup();
    const onSubmit = renderSignup();

    await user.type(screen.getByLabelText("Full name"), "Amina Fuseini");
    await user.click(screen.getByRole("button", { name: "Signup" }));

    expect(
      await screen.findByText("Provide an email or a phone number")
    ).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("submits with a name, an email and no password", async () => {
    const user = userEvent.setup();
    const onSubmit = renderSignup();

    await user.type(screen.getByLabelText("Full name"), "Amina Fuseini");
    await user.type(
      screen.getByPlaceholderText("you@example.com"),
      "amina@example.com"
    );
    await user.click(screen.getByRole("button", { name: "Signup" }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit.mock.calls[0][0]).toMatchObject({
      name: "Amina Fuseini",
      contactMethod: "email",
      email: "amina@example.com",
      password: "",
    });
  });

  it("enforces password bounds when a password is set", async () => {
    const user = userEvent.setup();
    const onSubmit = renderSignup();

    await user.type(screen.getByLabelText("Full name"), "Amina Fuseini");
    await user.type(
      screen.getByPlaceholderText("you@example.com"),
      "amina@example.com"
    );
    // The password input sits inside a wrapper div that receives the form
    // item id, so it is queried by placeholder rather than label.
    await user.type(
      screen.getByPlaceholderText("Leave blank to sign in with a code"),
      "abc"
    );
    await user.click(screen.getByRole("button", { name: "Signup" }));

    expect(
      await screen.findByText("Password must be at least 4 characters")
    ).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
