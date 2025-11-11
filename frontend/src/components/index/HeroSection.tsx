"use client";
import Link from "next/link";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ArrowRight,
  Code2,
  Plane,
  Hotel,
  MapPin,
  Database,
  Shield,
  Zap,
  Github,
} from "lucide-react";

const HeroSection = () => {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Background Image */}
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: `url(/assets/hero-travel.jpg)` }}
      >
        <div className="absolute inset-0 bg-gradient-to-br from-background/95 via-background/60 to-background/30" />
        <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-transparent to-transparent" />
      </div>

      {/* Pattern Overlay */}
      <div
        className="absolute inset-0 opacity-[0.03] dark:opacity-[0.05]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23000000' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }}
      />

      {/* Main Content */}
      <div className="relative z-10 container mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Left Column */}
            <div className="text-center lg:text-left space-y-8">
              {/* Badge */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 backdrop-blur-sm border border-primary/30 text-foreground"
              >
                <Code2 className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium">
                  Full-Stack Portfolio Project
                </span>
              </motion.div>

              {/* Heading */}
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.1 }}
              >
                <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold text-foreground leading-[1.1] tracking-tight">
                  Travel Trek
                  <span className="block mt-2 bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent">
                    Booking Platform
                  </span>
                </h1>
              </motion.div>

              {/* Subheading */}
              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.2 }}
                className="text-lg sm:text-xl text-muted-foreground leading-relaxed max-w-2xl mx-auto lg:mx-0"
              >
                A production-ready travel booking system built with modern
                technologies. Features secure authentication, payment
                processing, real-time bookings, and comprehensive admin tools.
              </motion.p>

              {/* Tech Stack Pills */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.25 }}
                className="flex flex-wrap gap-2 justify-center lg:justify-start"
              >
                {[
                  "Next.js",
                  "Express.js",
                  "TypeScript",
                  "PostgreSQL",
                  "Redis",
                ].map((tech) => (
                  <Badge
                    key={tech}
                    variant="secondary"
                    className="px-3 py-1 text-xs font-medium bg-muted/60 hover:bg-muted transition-colors"
                  >
                    {tech}
                  </Badge>
                ))}
              </motion.div>

              {/* CTA Buttons */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.3 }}
                className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start"
              >
                <Link href="/login" passHref>
                  <Button
                    size="default"
                    className="bg-primary text-primary-foreground hover:bg-primary/90 shadow-md hover:shadow-lg transition-all duration-300 text-base px-6 py-3 group relative overflow-hidden cursor-pointer"
                  >
                    <span className="relative z-10 flex items-center">
                      Try the Platform
                      <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                    </span>
                    <div className="absolute inset-0 bg-gradient-to-r from-primary to-accent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  </Button>
                </Link>

                <Link
                  href="https://github.com/nuru484/traveltrek.git"
                  target="_blank"
                  rel="noopener noreferrer"
                  passHref
                >
                  <Button
                    size="default"
                    variant="outline"
                    className="border border-border bg-card/80 backdrop-blur-md text-foreground hover:bg-card/95 hover:border-primary/50 hover:text-foreground transition-all duration-300 text-base px-6 py-3 group cursor-pointer"
                  >
                    <Github className="mr-2 h-5 w-5 group-hover:scale-110 transition-transform" />
                    View Source Code
                  </Button>
                </Link>
              </motion.div>

              {/* Technical Highlights */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.4 }}
                className="flex flex-wrap items-center justify-center lg:justify-start gap-6 sm:gap-8 pt-4"
              >
                <div className="text-center lg:text-left">
                  <div className="text-2xl sm:text-3xl font-bold text-primary flex items-center justify-center lg:justify-start gap-2">
                    <Database className="w-6 h-6" />
                    REST API
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Full Backend
                  </div>
                </div>
                <div className="w-px h-12 bg-border hidden sm:block" />
                <div className="text-center lg:text-left">
                  <div className="text-2xl sm:text-3xl font-bold text-accent flex items-center justify-center lg:justify-start gap-2">
                    <Shield className="w-6 h-6" />
                    Secure
                  </div>
                  <div className="text-sm text-muted-foreground">
                    JWT Auth & RBAC
                  </div>
                </div>
                <div className="w-px h-12 bg-border hidden sm:block" />
                <div className="text-center lg:text-left">
                  <div className="text-2xl sm:text-3xl font-bold text-primary flex items-center justify-center lg:justify-start gap-2">
                    <Zap className="w-6 h-6" />
                    Real-time
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Live Bookings
                  </div>
                </div>
              </motion.div>
            </div>

            {/* Right Column (System Features) */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8, delay: 0.3 }}
              className="hidden lg:grid grid-cols-2 gap-4 auto-rows-fr"
            >
              {[
                {
                  name: "Flight Booking",
                  icon: Plane,
                  description: "Search & reserve flights",
                  color: "primary",
                },
                {
                  name: "Hotel Reservations",
                  icon: Hotel,
                  description: "Book accommodations",
                  color: "accent",
                },
                {
                  name: "Tour Management",
                  icon: MapPin,
                  description: "Explore destinations",
                  color: "primary",
                },
                {
                  name: "Payment System",
                  icon: Shield,
                  description: "Secure transactions",
                  color: "accent",
                },
              ].map((feature, index) => (
                <motion.div
                  key={feature.name}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.5 + index * 0.1 }}
                  className="group relative bg-card/80 backdrop-blur-md border border-border rounded-xl p-5 hover:bg-card/95 hover:shadow-lg hover:-translate-y-1 transition-all duration-300 cursor-pointer"
                >
                  <div
                    className={`mb-3 p-2.5 rounded-lg ${
                      feature.color === "primary"
                        ? "bg-primary/10"
                        : "bg-accent/10"
                    } w-fit`}
                  >
                    <feature.icon
                      className={`w-7 h-7 ${
                        feature.color === "primary"
                          ? "text-primary"
                          : "text-accent"
                      }`}
                    />
                  </div>
                  <div>
                    <h3
                      className={`font-semibold text-card-foreground text-sm mb-1 group-hover:${
                        feature.color === "primary"
                          ? "text-primary"
                          : "text-accent"
                      } transition-colors`}
                    >
                      {feature.name}
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      {feature.description}
                    </p>
                  </div>
                  <div
                    className={`absolute top-2 right-2 w-2 h-2 rounded-full ${
                      feature.color === "primary" ? "bg-primary" : "bg-accent"
                    } opacity-50 group-hover:opacity-100 transition-opacity`}
                  />
                </motion.div>
              ))}
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
