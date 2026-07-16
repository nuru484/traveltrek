// test/component/review-dialog.test.tsx
//
// The review dialog: rating-required validation, the create submit flow
// (POST body shape, empty optionals dropped) and the edit flow (PUT with the
// review id). RTK Query hooks are mocked so tests drive only the form.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ReviewDialog } from "@/components/reviews/review-dialog";
import type { IReview } from "@/types/review.types";

const createReview = vi.fn();
const updateReview = vi.fn();

vi.mock("@/redux/reviewApi", () => ({
  useCreateReviewMutation: () => [createReview, { isLoading: false }],
  useUpdateReviewMutation: () => [updateReview, { isLoading: false }],
}));

vi.mock("react-hot-toast", () => ({
  default: { success: vi.fn(), error: vi.fn() },
}));

const REVIEW: IReview = {
  id: 42,
  bookingId: 10,
  rating: 3,
  title: "Decent",
  comment: "Could be better",
  status: "PUBLISHED",
  customer: { id: 7, name: "Ama Serwaa" },
  target: { type: "TOUR", id: 3, name: "Mole Safari" },
  createdAt: "2026-07-01T00:00:00.000Z",
  updatedAt: "2026-07-01T00:00:00.000Z",
};

beforeEach(() => {
  createReview.mockReset();
  updateReview.mockReset();
  createReview.mockReturnValue({ unwrap: () => Promise.resolve({}) });
  updateReview.mockReturnValue({ unwrap: () => Promise.resolve({}) });
});

describe("ReviewDialog (create)", () => {
  it("requires a star rating before submitting", async () => {
    const user = userEvent.setup();
    render(
      <ReviewDialog open onOpenChange={() => {}} bookingId={10} />
    );

    await user.click(screen.getByRole("button", { name: /submit review/i }));

    expect(await screen.findByText("Pick a star rating")).toBeInTheDocument();
    expect(createReview).not.toHaveBeenCalled();
  });

  it("submits the rating with title and comment", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(
      <ReviewDialog open onOpenChange={onOpenChange} bookingId={10} />
    );

    await user.click(screen.getByRole("radio", { name: "5 stars" }));
    await user.type(screen.getByLabelText(/title/i), "Unforgettable");
    await user.type(screen.getByLabelText(/comment/i), "Loved every day.");
    await user.click(screen.getByRole("button", { name: /submit review/i }));

    await waitFor(() => {
      expect(createReview).toHaveBeenCalledWith({
        bookingId: 10,
        rating: 5,
        title: "Unforgettable",
        comment: "Loved every day.",
      });
    });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("drops empty optional fields from the payload", async () => {
    const user = userEvent.setup();
    render(
      <ReviewDialog open onOpenChange={() => {}} bookingId={10} />
    );

    await user.click(screen.getByRole("radio", { name: "4 stars" }));
    await user.click(screen.getByRole("button", { name: /submit review/i }));

    await waitFor(() => {
      expect(createReview).toHaveBeenCalledWith({
        bookingId: 10,
        rating: 4,
        title: undefined,
        comment: undefined,
      });
    });
  });
});

describe("ReviewDialog (edit)", () => {
  it("hydrates from the review and PUTs with its id", async () => {
    const user = userEvent.setup();
    render(
      <ReviewDialog open onOpenChange={() => {}} review={REVIEW} />
    );

    // Existing values are hydrated.
    expect(screen.getByLabelText(/title/i)).toHaveValue("Decent");
    expect(
      screen.getByRole("radio", { name: "3 stars" })
    ).toHaveAttribute("aria-checked", "true");

    await user.click(screen.getByRole("radio", { name: "5 stars" }));
    await user.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() => {
      expect(updateReview).toHaveBeenCalledWith({
        id: 42,
        rating: 5,
        title: "Decent",
        comment: "Could be better",
      });
    });
    expect(createReview).not.toHaveBeenCalled();
  });
});
