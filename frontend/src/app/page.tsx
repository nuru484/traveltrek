import Header from "@/components/index/Header";
import HeroSection from "@/components/index/HeroSection";
import DeparturesSection from "@/components/index/DeparturesSection";
import EngineeringSection from "@/components/index/EngineeringSection";
import ManifestSection from "@/components/index/ManifestSection";
import GateCallSection from "@/components/index/GateCallSection";
import Footer from "@/components/index/Footer";

// Fully static: the landing is the portfolio pitch, and the live showcase
// (real rows from the public API) lives on its own page at /demo — the gate
// call below hands off to it, so this page renders with zero backend calls.
const page = () => (
  // pb clears the phone bottom nav bar rendered by Header.
  <div className="min-h-screen pb-16 md:pb-0">
    <Header />
    <HeroSection />
    <DeparturesSection />
    <EngineeringSection />
    <ManifestSection />
    <GateCallSection />
    <Footer />
  </div>
);

export default page;
