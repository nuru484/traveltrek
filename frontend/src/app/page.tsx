import Header from "@/components/index/Header";
import HeroSection from "@/components/index/HeroSection";
import DeparturesSection from "@/components/index/DeparturesSection";
import EngineeringSection from "@/components/index/EngineeringSection";
import ManifestSection from "@/components/index/ManifestSection";
import LiveShowcaseSection from "@/components/index/LiveShowcaseSection";
import TestimonialsSection from "@/components/index/TestimonialsSection";
import Footer from "@/components/index/Footer";
import { fetchShowcaseData } from "@/lib/public-api";

// The live showcase re-fetches the public API on a 5-minute ISR window
// (each fetch in lib/public-api.ts carries next.revalidate = 300).
const page = async () => {
  // Failures are swallowed into empty lists inside the fetchers, so a
  // stopped backend degrades the live sections instead of erroring the page.
  const showcase = await fetchShowcaseData();

  return (
    // pb clears the phone bottom nav bar rendered by Header.
    <div className="min-h-screen pb-16 md:pb-0">
      <Header />
      <HeroSection />
      <DeparturesSection />
      <EngineeringSection />
      <ManifestSection />
      <LiveShowcaseSection data={showcase} />
      <TestimonialsSection reviews={showcase.reviews} />
      <Footer />
    </div>
  );
};

export default page;
