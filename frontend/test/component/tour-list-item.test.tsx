// test/component/tour-list-item.test.tsx
//
// The tour card's cover-photo + rating treatment: photo banner when a
// photo exists, placeholder otherwise, and the rating aggregate either way.
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { TourListItem } from "@/components/tours/tour-list-item";
import { ITour, TourStatus, TourType } from "@/types/tour.types";

const TOUR: ITour = {
  id: 3,
  name: "Mole Safari Adventure",
  description: "Elephants at dawn.",
  type: TourType.WILDLIFE,
  status: TourStatus.UPCOMING,
  duration: 4,
  price: 250_000,
  maxGuests: 20,
  guestsBooked: 12,
  startDate: "2026-08-10T08:00:00.000Z",
  endDate: "2026-08-14T18:00:00.000Z",
  destination: { id: 1, name: "Mole National Park", city: null, country: "Ghana" },
  photo: "https://res.cloudinary.com/demo/image/upload/tour.jpg",
  rating: { average: 4.6, count: 9 },
  createdAt: "2026-06-01T00:00:00.000Z",
  updatedAt: "2026-06-01T00:00:00.000Z",
};

describe("TourListItem", () => {
  it("renders the cover photo with the tour name as alt text", () => {
    render(<TourListItem tour={TOUR} />);
    const photo = screen.getByRole("img", { name: "Mole Safari Adventure" });
    expect(photo).toBeInTheDocument();
    expect(photo).toHaveAttribute("src", expect.stringContaining("tour"));
  });

  it("renders the rating aggregate, price and destination", () => {
    render(<TourListItem tour={TOUR} />);
    expect(screen.getByText("4.6")).toBeInTheDocument();
    expect(screen.getByText("(9)")).toBeInTheDocument();
    expect(screen.getByText(/GH₵/)).toBeInTheDocument();
    expect(screen.getByText("Mole National Park")).toBeInTheDocument();
    expect(screen.getByText("8 spots left")).toBeInTheDocument();
  });

  it("falls back to a placeholder and 'No reviews yet' without photo/reviews", () => {
    render(
      <TourListItem
        tour={{ ...TOUR, photo: null, rating: { average: null, count: 0 } }}
      />
    );
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(screen.getByText("No reviews yet")).toBeInTheDocument();
  });

  it("links to the tour detail page", () => {
    render(<TourListItem tour={TOUR} />);
    expect(screen.getByRole("link")).toHaveAttribute(
      "href",
      "/dashboard/tours/3/detail"
    );
  });
});
