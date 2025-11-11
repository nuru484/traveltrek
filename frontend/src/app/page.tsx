import HeroSection from "@/components/index/HeroSection";
import SystemFeaturesSection from "@/components/index/SystemFeaturesSection";
import Footer from "@/components/index/Footer";
import Header from "@/components/index/Header";

const page = () => {
  return (
    <div className="min-h-screen">
      <Header />
      <div className="container mx-auto">
        <HeroSection />
        <SystemFeaturesSection />
        <Footer />
      </div>
    </div>
  );
};

export default page;
