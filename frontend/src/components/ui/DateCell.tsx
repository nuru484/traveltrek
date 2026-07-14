// src/components/ui/DateCell.tsx
import { format } from "date-fns";

/**
 * Table cell for timestamps: the date, with the time in a small mono line
 * beneath it — the departures-board treatment.
 */
export function DateCell({ value }: { value: string | number | Date | null }) {
  if (!value) return <span className="text-sm text-muted-foreground">—</span>;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return <span className="text-sm text-muted-foreground">—</span>;
  }
  return (
    <div className="whitespace-nowrap">
      <div className="text-sm text-foreground">{format(date, "MMM d, yyyy")}</div>
      <div className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
        {format(date, "h:mm a")}
      </div>
    </div>
  );
}

export default DateCell;
