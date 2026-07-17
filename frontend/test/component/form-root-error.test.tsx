// test/component/form-root-error.test.tsx
//
// FormRootError renders formState.errors.root as a persistent inline alert:
// hidden while there is no root error, visible after a failed submit sets
// one, and cleared automatically by react-hook-form on the next submission.
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useForm } from "react-hook-form";
import { Form } from "@/components/ui/form";
import { FormRootError } from "@/components/ui/form-root-error";

const ROOT_MESSAGE = "Invalid credentials.";

/** Minimal form mirroring the login/signup catch: reject → root error. */
function Harness({ submit }: { submit: () => Promise<void> }) {
  const form = useForm({ defaultValues: { name: "" } });

  const onSubmit = async () => {
    try {
      await submit();
    } catch {
      form.setError("root", { message: ROOT_MESSAGE });
    }
  };

  return (
    <Form {...form}>
      <form noValidate onSubmit={form.handleSubmit(onSubmit)}>
        <FormRootError />
        <button type="submit">Save</button>
      </form>
    </Form>
  );
}

describe("FormRootError", () => {
  it("renders nothing while there is no root error", () => {
    render(<Harness submit={() => Promise.resolve()} />);

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("shows the root error message after a failed submit", async () => {
    const user = userEvent.setup();
    render(<Harness submit={() => Promise.reject(new Error("nope"))} />);

    await user.click(screen.getByRole("button", { name: "Save" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(ROOT_MESSAGE);
  });

  it("auto-clears the root error on the next submission", async () => {
    const user = userEvent.setup();
    const submit = vi
      .fn<() => Promise<void>>()
      .mockRejectedValueOnce(new Error("nope"))
      .mockResolvedValueOnce(undefined);
    render(<Harness submit={submit} />);

    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByRole("alert")).toBeInTheDocument();

    // react-hook-form drops root errors when the form is submitted again.
    await user.click(screen.getByRole("button", { name: "Save" }));
    await vi.waitFor(() =>
      expect(screen.queryByRole("alert")).not.toBeInTheDocument()
    );
  });
});
