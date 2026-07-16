// src/app/dashboard/reviews/page.tsx
//
// One route, two audiences (same pattern as /dashboard/bookings):
//   - Staff (ADMIN/AGENT): the moderation queue — filterable list of every
//     review; ADMINs publish/hide/delete.
//   - Customers: "My reviews" — everything they've written, with edit
//     (30-day window) and delete.
"use client";
import { useSelector } from "react-redux";
import { RootState } from "@/redux/store";
import { PageHeader } from "@/components/ui/PageHeader";
import { AdminReviewList } from "@/components/reviews/admin-review-list";
import { MyReviewList } from "@/components/reviews/my-review-list";
import { isAdmin as isAdminUser, isStaff } from "@/utils/roles";

export default function ReviewsPage() {
  const user = useSelector((state: RootState) => state.auth.user);
  const staff = isStaff(user);
  const isAdmin = isAdminUser(user);

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6">
      <PageHeader
        title={staff ? "Reviews" : "My Reviews"}
        description={
          staff
            ? "Moderate customer reviews — publish, hide, or remove."
            : "Reviews you've written for completed trips."
        }
      />

      {staff ? <AdminReviewList isAdmin={isAdmin} /> : <MyReviewList />}
    </div>
  );
}
