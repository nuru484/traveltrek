import Header from "@/components/index/Header";
import HeroSection from "@/components/index/HeroSection";
import DeparturesSection from "@/components/index/DeparturesSection";
import EngineeringSection from "@/components/index/EngineeringSection";
import ManifestSection from "@/components/index/ManifestSection";
import Footer from "@/components/index/Footer";

const page = () => {
  return (
    <div className="min-h-screen">
      <Header />
      <HeroSection />
      <DeparturesSection />
      <EngineeringSection />
      <ManifestSection />
      <Footer />
    </div>
  );
};

export default page;
