"use client";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Code2,
  Database,
  Lock,
  Zap,
  BarChart3,
  Smartphone,
  CreditCard,
  Calendar,
  RefreshCw,
  Shield,
  Moon,
  ArrowRight,
} from "lucide-react";
import Link from "next/link";

const SystemFeaturesSection = () => {
  const technicalFeatures = [
    {
      icon: Database,
      title: "Full-Stack Architecture",
      description:
        "Complete backend API with PostgreSQL, Prisma ORM, and Redis caching for optimal performance and data integrity.",
      color: "primary",
    },
    {
      icon: Lock,
      title: "Secure Authentication",
      description:
        "JWT-based authentication system with protected routes, role-based access control (RBAC), and session management.",
      color: "accent",
    },
    {
      icon: CreditCard,
      title: "Payment Integration",
      description:
        "Secure payment processing with transaction handling, payment validation, and automated confirmation workflows.",
      color: "primary",
    },
    {
      icon: Calendar,
      title: "Smart Booking System",
      description:
        "Real-time availability checking, automated booking confirmations, and intelligent conflict resolution for flights and hotels.",
      color: "accent",
    },
    {
      icon: RefreshCw,
      title: "Automated Job Processing",
      description:
        "BullMQ queue system for background tasks including booking expiration, payment processing, and notification dispatch.",
      color: "primary",
    },
    {
      icon: BarChart3,
      title: "Admin Dashboard & Reports",
      description:
        "Comprehensive analytics, booking management, user oversight, and system health monitoring with data visualization.",
      color: "accent",
    },
    {
      icon: Smartphone,
      title: "Responsive Design",
      description:
        "Mobile-first approach with fluid layouts, touch-optimized interfaces, and seamless cross-device experience.",
      color: "primary",
    },
    {
      icon: Moon,
      title: "Theme System",
      description:
        "Dynamic light/dark mode with persistent preferences, system detection, and smooth theme transitions.",
      color: "accent",
    },
  ];

  const systemCapabilities = [
    {
      icon: Shield,
      title: "Input Validation",
      value: "Zod + Express Validator",
      description: "Client & server-side validation",
    },
    {
      icon: Zap,
      title: "State Management",
      value: "Redux Toolkit",
      description: "Centralized app state control",
    },
    {
      icon: Code2,
      title: "Type Safety",
      value: "100% TypeScript",
      description: "End-to-end type coverage",
    },
  ];

  return (
    <section
      id="features"
      className="py-24 md:py-32 bg-background relative overflow-hidden"
    >
      {/* Subtle Background Pattern */}
      <div className="absolute inset-0 bg-grid-pattern opacity-[0.02] pointer-events-none" />

      <div className="container mx-auto px-4 md:px-6 lg:px-8 relative">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          className="text-center mb-12 md:mb-16"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
            viewport={{ once: true }}
          >
            <Badge
              variant="outline"
              className="mb-4 border-primary/20 text-primary bg-primary/5"
            >
              <Code2 className="h-3 w-3 mr-1" />
              Technical Implementation
            </Badge>
          </motion.div>

          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-4 tracking-tight">
            System Features & Capabilities
          </h2>
          <p className="text-base md:text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed mb-6">
            A production-ready travel booking platform demonstrating modern
            full-stack development practices, scalable architecture, and
            real-world functionality
          </p>

          {/* CTA Button */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            viewport={{ once: true }}
          >
            <Link href="/login">
              <Button
                size="lg"
                className="group shadow-lg hover:shadow-xl transition-all duration-300"
              >
                Try the System
                <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
              </Button>
            </Link>
          </motion.div>
        </motion.div>

        {/* Features Grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 md:gap-8">
          {technicalFeatures.map((feature, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.5,
                delay: index * 0.1,
                ease: "easeOut",
              }}
              viewport={{ once: true, margin: "-50px" }}
              className="group h-full"
            >
              <Card className="relative text-center h-full border border-border bg-card hover:border-primary/30 hover:shadow-lg transition-all duration-300 overflow-hidden">
                {/* Hover Background Effect */}
                <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

                <CardContent className="p-6 md:p-8 relative z-10 flex flex-col items-center h-full">
                  {/* Icon Container */}
                  <motion.div
                    whileHover={{ scale: 1.1, rotate: 5 }}
                    transition={{
                      type: "spring",
                      stiffness: 300,
                      damping: 15,
                    }}
                    className="relative mb-6"
                  >
                    {/* Glow Effect */}
                    <div className="absolute inset-0 bg-primary/20 rounded-full blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

                    {/* Icon Background */}
                    <div
                      className={`relative w-16 h-16 md:w-20 md:h-20 bg-gradient-to-br ${
                        feature.color === "primary"
                          ? "from-primary via-primary/90 to-accent"
                          : "from-accent via-accent/90 to-primary"
                      } rounded-2xl flex items-center justify-center shadow-md group-hover:shadow-xl transition-shadow duration-300`}
                    >
                      <feature.icon className="h-8 w-8 md:h-10 md:w-10 text-primary-foreground" />

                      {/* Decorative Corner */}
                      <div
                        className={`absolute -top-1 -right-1 w-3 h-3 ${
                          feature.color === "primary" ? "bg-accent" : "bg-primary"
                        } rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300`}
                      />
                    </div>
                  </motion.div>

                  {/* Content */}
                  <div className="flex-1 flex flex-col">
                    <h3 className="text-lg md:text-xl font-bold text-card-foreground mb-3 group-hover:text-primary transition-colors duration-200">
                      {feature.title}
                    </h3>

                    <p className="text-sm md:text-base text-muted-foreground leading-relaxed">
                      {feature.description}
                    </p>
                  </div>

                  {/* Hover Indicator */}
                  <motion.div
                    className="mt-6 w-8 h-1 bg-primary/20 rounded-full group-hover:w-full group-hover:bg-primary transition-all duration-300"
                    initial={{ width: "2rem" }}
                  />
                </CardContent>

                {/* Decorative Elements */}
                <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-accent/10 to-transparent rounded-bl-full opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                <div className="absolute bottom-0 left-0 w-16 h-16 bg-gradient-to-tr from-primary/10 to-transparent rounded-tr-full opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              </Card>
            </motion.div>
          ))}
        </div>

        {/* System Capabilities */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          viewport={{ once: true }}
          className="mt-16 md:mt-20"
        >
          <div className="bg-gradient-to-r from-primary/5 via-accent/5 to-primary/5 rounded-2xl p-8 md:p-12 border border-border/50">
            <div className="text-center mb-8">
              <h3 className="text-2xl md:text-3xl font-bold text-foreground mb-2">
                Core System Capabilities
              </h3>
              <p className="text-sm md:text-base text-muted-foreground">
                Built with industry-standard tools and best practices
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-8">
              {systemCapabilities.map((capability, index) => (
                <motion.div
                  key={index}
                  initial={{ scale: 0.9, opacity: 0 }}
                  whileInView={{ scale: 1, opacity: 1 }}
                  transition={{ duration: 0.5, delay: index * 0.1 }}
                  viewport={{ once: true }}
                  className="text-center space-y-3"
                >
                  <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10 mb-2">
                    <capability.icon className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm md:text-base font-semibold text-foreground mb-1">
                      {capability.title}
                    </p>
                    <p className="text-lg md:text-xl font-bold text-primary mb-1">
                      {capability.value}
                    </p>
                    <p className="text-xs md:text-sm text-muted-foreground">
                      {capability.description}
                    </p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default SystemFeaturesSection;