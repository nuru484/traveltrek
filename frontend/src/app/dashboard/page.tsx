// src/app/dashboard/page.tsx
import { DashboardOverview } from "@/components/dashboard/dashboard-overview";

const DashboardPage = () => {
  return (
    <div className="mx-auto w-full max-w-7xl py-6">
      <DashboardOverview />
    </div>
  );
};

export default DashboardPage;
