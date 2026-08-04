// The passenger log: latest published reviews from /public/reviews/recent,
// rendered as stamped log entries. Renders nothing when no reviews have been
// published (or the backend is down). Moved from the landing page's
// TestimonialsSection when the demo got its own page.
import { RatingValue } from "@/components/ui/rating";
import type { IPublicReview } from "@/types/review.types";
import { reviewTargetLine } from "./showcase-logic";

const PassengerLog = ({ reviews }: { reviews: IPublicReview[] }) => {
  if (reviews.length === 0) return null;

  return (
    <section className="bg-hero-band">
      <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-primary">
          Passenger log
        </p>
        <h2 className="mt-3 max-w-xl text-3xl font-semibold tracking-tight sm:text-4xl">
          What travellers <span className="italic">wrote back.</span>
        </h2>
        <p className="mt-4 max-w-md text-sm leading-relaxed text-muted-foreground">
          Verified reviews from completed bookings in the demo. Customers can
          only review trips they actually took.
        </p>

        <ul className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {reviews.map((review) => (
            <li
              key={review.id}
              className="flex h-full flex-col gap-3 rounded-xl border border-foreground/15 bg-card p-5"
            >
              <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
                <RatingValue value={review.rating} />
                <span className="truncate font-mono text-[9px] uppercase tracking-[0.15em] text-muted-foreground">
                  {reviewTargetLine(review.target)}
                </span>
              </div>
              {review.title && (
                <p className="text-base font-semibold leading-snug">
                  {review.title}
                </p>
              )}
              {review.comment && (
                <p className="line-clamp-4 text-sm leading-relaxed text-muted-foreground">
                  {review.comment}
                </p>
              )}
              <p className="mt-auto border-t border-dashed border-foreground/15 pt-3 font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
                - {review.reviewer}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
};

export default PassengerLog;
