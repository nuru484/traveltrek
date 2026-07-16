import type { Metadata } from "next";
import DemoTopBar from "@/components/demo/DemoTopBar";
import DemoBoard from "@/components/demo/DemoBoard";
import LiveInventory from "@/components/demo/LiveInventory";
import PassengerLog from "@/components/demo/PassengerLog";
import Footer from "@/components/index/Footer";
import { fetchShowcaseData } from "@/lib/public-api";

export const metadata: Metadata = {
  title: "Live demo",
  description:
    "Real tours, hotels, flights and reviews from the running Travel Trek system, served by its public API. Sign in with a demo account and book any of it.",
};

// The board re-fetches the public API on a 5-minute ISR window (each fetch
// in lib/public-api.ts carries next.revalidate = 300). Failures are
// swallowed into empty lists inside the fetchers, so a stopped backend
// degrades to the board's "demo idle" state instead of erroring the page.
const page = async () => {
  const showcase = await fetchShowcaseData();

  return (
    <div className="min-h-screen">
      <DemoTopBar />
      <DemoBoard data={showcase} />
      <LiveInventory data={showcase} />
      <PassengerLog reviews={showcase.reviews} />
      <Footer numbered={false} />
    </div>
  );
};

export default page;
