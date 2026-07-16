// test/unit/showcase-logic.test.ts
//
// The landing showcase's degrade logic: which bands render for a given
// public-API result, and how booking CTAs route through the login redirect.
import { describe, expect, it } from "vitest";
import {
  demoHref,
  destinationLine,
  hasLiveInventory,
  hasTestimonials,
  reviewTargetLine,
} from "@/components/demo/showcase-logic";
import type { IShowcaseData } from "@/lib/public-api";
import type { ITour } from "@/types/tour.types";
import { loginRedirectPath } from "@/components/authentication/login-redirect-logic";

const EMPTY: IShowcaseData = {
  tours: [],
  destinations: [],
  hotels: [],
  flights: [],
  reviews: [],
};

describe("demoHref", () => {
  it("routes through /login with an encoded from param", () => {
    expect(demoHref("/dashboard/tours/3/detail")).toBe(
      "/login?from=%2Fdashboard%2Ftours%2F3%2Fdetail"
    );
  });

  it("produces targets the login redirect honors", () => {
    const href = demoHref("/dashboard/tours/3/detail");
    const search = href.slice(href.indexOf("?"));
    expect(loginRedirectPath(search)).toBe("/dashboard/tours/3/detail");
  });
});

describe("hasLiveInventory / hasTestimonials", () => {
  it("is false for the fully-degraded (backend down) payload", () => {
    expect(hasLiveInventory(EMPTY)).toBe(false);
    expect(hasTestimonials(EMPTY)).toBe(false);
  });

  it("is true as soon as any inventory list has rows", () => {
    expect(
      hasLiveInventory({ ...EMPTY, tours: [{ id: 1 } as ITour] })
    ).toBe(true);
    expect(
      hasLiveInventory({
        ...EMPTY,
        destinations: [
          {
            id: 1,
            name: "Accra",
            city: null,
            country: "Ghana",
            description: null,
            photo: null,
          },
        ],
      })
    ).toBe(true);
  });

  it("reviews drive the testimonials band, not the inventory flag", () => {
    const withReviews: IShowcaseData = {
      ...EMPTY,
      reviews: [
        {
          id: 1,
          rating: 5,
          title: null,
          comment: "Great",
          reviewer: "Ama",
          target: { type: "TOUR", id: 1, name: "Safari" },
          createdAt: "2026-07-01T00:00:00.000Z",
        },
      ],
    };
    expect(hasTestimonials(withReviews)).toBe(true);
    expect(hasLiveInventory(withReviews)).toBe(false);
  });
});

describe("display helpers", () => {
  it("destinationLine handles a null city", () => {
    expect(destinationLine({ city: "Tamale", country: "Ghana" })).toBe(
      "Tamale, Ghana"
    );
    expect(destinationLine({ city: null, country: "Ghana" })).toBe("Ghana");
  });

  it("reviewTargetLine names each target kind", () => {
    expect(reviewTargetLine({ type: "TOUR", name: "Mole Safari" })).toBe(
      "Mole Safari"
    );
    expect(
      reviewTargetLine({
        type: "ROOM",
        roomType: "Deluxe",
        hotel: { name: "Zaina Lodge" },
      })
    ).toBe("Zaina Lodge");
    expect(
      reviewTargetLine({
        type: "FLIGHT",
        airline: "Passion Air",
        flightNumber: "OP-321",
      })
    ).toBe("Passion Air · OP-321");
  });
});
