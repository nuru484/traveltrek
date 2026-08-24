// test/component/review-comment.test.tsx
//
// The clamped review body: the toggle only shows up when the clamp actually
// hides something, and it swaps the clamp off and back on.
import { afterEach, describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ReviewComment } from "@/components/reviews/review-comment";

// jsdom lays nothing out, so the two heights the component compares are
// stubbed to say "the text overflows its four lines" or "it fits".
function stubOverflow(overflows: boolean) {
  Object.defineProperty(HTMLElement.prototype, "scrollHeight", {
    configurable: true,
    value: overflows ? 200 : 80,
  });
  Object.defineProperty(HTMLElement.prototype, "clientHeight", {
    configurable: true,
    value: 80,
  });
}

afterEach(() => {
  Reflect.deleteProperty(HTMLElement.prototype, "scrollHeight");
  Reflect.deleteProperty(HTMLElement.prototype, "clientHeight");
});

describe("ReviewComment", () => {
  it("shows the comment without a toggle when it fits the clamp", () => {
    stubOverflow(false);
    render(<ReviewComment comment="Short and sweet." />);

    expect(screen.getByText("Short and sweet.")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Show more" })
    ).not.toBeInTheDocument();
  });

  it("expands and re-collapses a comment longer than the clamp", async () => {
    stubOverflow(true);
    const user = userEvent.setup();
    render(<ReviewComment comment="A very long stay report." />);

    const body = screen.getByText("A very long stay report.");
    expect(body).toHaveClass("line-clamp-4");

    await user.click(screen.getByRole("button", { name: "Show more" }));
    expect(body).not.toHaveClass("line-clamp-4");

    await user.click(screen.getByRole("button", { name: "Show less" }));
    expect(body).toHaveClass("line-clamp-4");
  });
});
