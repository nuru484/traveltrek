// test/component/table-bits.test.tsx
//
// The dual-render building blocks: the card list is the mobile half
// (md:hidden), rows are tappable, and the action/leading slots never trigger
// the row's navigation.
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  RowCard,
  RowCardEmpty,
  RowCardList,
  SkeletonRowCards,
} from "@/components/ui/table-bits";

describe("RowCardList / RowCard", () => {
  it("renders as the mobile half (hidden from md up)", () => {
    render(
      <RowCardList>
        <RowCard>
          <span>Amina</span>
        </RowCard>
      </RowCardList>
    );
    const list = screen.getByRole("list");
    expect(list.className).toContain("md:hidden");
  });

  it("opens on row tap", async () => {
    const user = userEvent.setup();
    const onOpen = vi.fn();
    render(
      <RowCardList>
        <RowCard onOpen={onOpen}>
          <span>Amina</span>
        </RowCard>
      </RowCardList>
    );
    await user.click(screen.getByText("Amina"));
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it("does not open when the action or leading control is tapped", async () => {
    const user = userEvent.setup();
    const onOpen = vi.fn();
    const onAction = vi.fn();
    render(
      <RowCardList>
        <RowCard
          onOpen={onOpen}
          leading={<input type="checkbox" aria-label="Select row" />}
          action={
            <button type="button" onClick={onAction}>
              Menu
            </button>
          }
        >
          <span>Amina</span>
        </RowCard>
      </RowCardList>
    );
    await user.click(screen.getByRole("button", { name: "Menu" }));
    await user.click(screen.getByRole("checkbox", { name: "Select row" }));
    expect(onAction).toHaveBeenCalledTimes(1);
    expect(onOpen).not.toHaveBeenCalled();
  });

  it("renders matching skeleton rows and an empty state", () => {
    const { container, rerender } = render(
      <RowCardList>
        <SkeletonRowCards rows={3} />
      </RowCardList>
    );
    expect(container.querySelectorAll("li")).toHaveLength(3);

    rerender(
      <RowCardList>
        <RowCardEmpty title="No bookings found" hint="Try adjusting filters" />
      </RowCardList>
    );
    expect(screen.getByText("No bookings found")).toBeInTheDocument();
    expect(screen.getByText("Try adjusting filters")).toBeInTheDocument();
  });
});
