// src/components/reviews/review-comment.tsx
//
// A review body inside a card grid. Comments run to 2000 characters, so the
// text clamps to four lines to keep the cards in a row the same height and
// expands in place when there is more to read.
"use client";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export function ReviewComment({
  comment,
  className,
}: {
  comment: string;
  className?: string;
}) {
  const bodyRef = useRef<HTMLParagraphElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [isClamped, setIsClamped] = useState(false);

  // How much text the clamp hides depends on the column width, so the body
  // measures itself and re-measures whenever the grid reflows. Measuring
  // stops while expanded - there is nothing hidden to detect then, and the
  // last collapsed reading is what keeps the toggle on screen.
  useEffect(() => {
    const body = bodyRef.current;
    if (!body || expanded) return;

    const measure = () =>
      setIsClamped(body.scrollHeight > body.clientHeight + 1);
    measure();

    const observer = new ResizeObserver(measure);
    observer.observe(body);
    return () => observer.disconnect();
  }, [comment, expanded]);

  return (
    <div className={cn("space-y-1", className)}>
      <p
        ref={bodyRef}
        className={cn(
          "text-sm leading-relaxed text-muted-foreground [overflow-wrap:anywhere]",
          !expanded && "line-clamp-4"
        )}
      >
        {comment}
      </p>
      {(isClamped || expanded) && (
        <button
          type="button"
          onClick={() => setExpanded((open) => !open)}
          aria-expanded={expanded}
          className="cursor-pointer text-xs font-medium text-foreground/70 underline-offset-4 transition-colors hover:text-foreground hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          {expanded ? "Show less" : "Show more"}
        </button>
      )}
    </div>
  );
}
