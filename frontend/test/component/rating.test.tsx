// test/component/rating.test.tsx
//
// The shared star-rating vocabulary: aggregate display (valued / unreviewed),
// per-review star row, and the interactive picker.
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  RatingStars,
  RatingStarsInput,
  RatingValue,
} from "@/components/ui/rating";

describe("RatingStars", () => {
  it("renders the average and count for a rated item", () => {
    render(<RatingStars rating={{ average: 4.3, count: 12 }} />);
    expect(screen.getByText("4.3")).toBeInTheDocument();
    expect(screen.getByText("(12)")).toBeInTheDocument();
    expect(
      screen.getByLabelText("Rated 4.3 out of 5 from 12 reviews")
    ).toBeInTheDocument();
  });

  it("pads the average to one decimal", () => {
    render(<RatingStars rating={{ average: 5, count: 1 }} />);
    expect(screen.getByText("5.0")).toBeInTheDocument();
  });

  it("shows the unreviewed state when average is null", () => {
    render(<RatingStars rating={{ average: null, count: 0 }} />);
    expect(screen.getByText("No reviews yet")).toBeInTheDocument();
  });

  it("can hide the count on tight surfaces", () => {
    render(<RatingStars rating={{ average: 3.8, count: 4 }} hideCount />);
    expect(screen.getByText("3.8")).toBeInTheDocument();
    expect(screen.queryByText("(4)")).not.toBeInTheDocument();
  });
});

describe("RatingValue", () => {
  it("announces the score for assistive tech", () => {
    render(<RatingValue value={2} />);
    expect(screen.getByRole("img")).toHaveAccessibleName("2 out of 5 stars");
  });
});

describe("RatingStarsInput", () => {
  it("renders five radios and reports the clicked star", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<RatingStarsInput value={0} onChange={onChange} />);

    const radios = screen.getAllByRole("radio");
    expect(radios).toHaveLength(5);

    await user.click(screen.getByRole("radio", { name: "4 stars" }));
    expect(onChange).toHaveBeenCalledWith(4);
  });

  it("marks the current value as checked", () => {
    render(<RatingStarsInput value={3} onChange={() => {}} />);
    expect(screen.getByRole("radio", { name: "3 stars" })).toHaveAttribute(
      "aria-checked",
      "true"
    );
    expect(screen.getByRole("radio", { name: "5 stars" })).toHaveAttribute(
      "aria-checked",
      "false"
    );
  });

  it("disables every star when disabled", () => {
    render(<RatingStarsInput value={1} onChange={() => {}} disabled />);
    screen.getAllByRole("radio").forEach((radio) => {
      expect(radio).toBeDisabled();
    });
  });
});
