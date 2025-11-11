import HeroSection from "@/components/index/HeroSection";
import ServicesSection from "@/components/index/ServicesSection";
import Footer from "@/components/index/Footer";
import Header from "@/components/index/Header";

const page = () => {
  return (
    <div className="min-h-screen">
      <Header />
      <div className="container mx-auto">
        <HeroSection />
        <ServicesSection />
        <Footer />
      </div>
    </div>
  );
};

export default page;
