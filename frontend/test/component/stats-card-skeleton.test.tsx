// test/component/stats-card-skeleton.test.tsx
//
// Skeleton-fidelity smoke: the stats-card skeleton must mirror the loaded
// StatsCard's structural anatomy (boarding-pass label row with the dotted
// leader, the dashed tear line, same card padding) so nothing shifts when
// data lands.
import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { StatsCard } from "@/components/dashboard/stats-card";
import { StatsCardSkeleton } from "@/components/dashboard/skeletons";

// The structural classes that define the card's anatomy. If StatsCard's
// layout changes, the skeleton must change with it — this test pins the two
// together.
const STRUCTURAL_SELECTORS = [
  // Card body padding
  ".px-5.py-5",
  // Dotted leader between the label and the code tag
  ".border-dotted",
  // Dashed tear line above the footer (trend / badge pills)
  ".border-dashed.border-foreground\\/20",
];

describe("StatsCardSkeleton fidelity", () => {
  it("shares the loaded card's structural anatomy", () => {
    const loaded = render(
      <StatsCard
        title="Bookings"
        code="BKG"
        value={42}
        subtitle="All time"
        trend={{ direction: "up", percentage: 10 }}
        details={[{ label: "Pending", value: 3 }]}
      />,
    );
    const skeleton = render(<StatsCardSkeleton pills={2} />);

    for (const selector of STRUCTURAL_SELECTORS) {
      expect(
        loaded.container.querySelector(selector),
        `loaded card should contain ${selector}`,
      ).not.toBeNull();
      expect(
        skeleton.container.querySelector(selector),
        `skeleton should contain ${selector}`,
      ).not.toBeNull();
    }
  });

  it("renders badge-pill placeholders for the footer chips", () => {
    const { container } = render(<StatsCardSkeleton pills={3} />);
    expect(container.querySelectorAll(".rounded-full")).toHaveLength(3);
  });
});
