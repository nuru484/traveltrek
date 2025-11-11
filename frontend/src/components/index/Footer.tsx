"use client";
import { motion } from "framer-motion";
import { Separator } from "@/components/ui/separator";
import {
  Mail,
  Phone,
  MapPin,
  Github,
  Linkedin,
  Facebook,
  Code,
  ExternalLink,
} from "lucide-react";

const Footer = () => {
  const currentYear = new Date().getFullYear();

  const contactInfo = [
    {
      icon: Mail,
      text: "abdulmajeednurudeen48@gmail.com",
      href: "mailto:abdulmajeednurudeen48@gmail.com",
    },
    {
      icon: Phone,
      text: "+233 54 648 8115",
      href: "tel:+233546488115",
    },
    {
      icon: MapPin,
      text: "Tamale, Ghana • Available for Remote",
      href: null,
    },
  ];

  const socialLinks = [
    {
      icon: Github,
      label: "GitHub Profile",
      href: "https://github.com/nuru484",
    },
    {
      icon: Linkedin,
      label: "LinkedIn",
      href: "https://www.linkedin.com/in/nurudeen-abdul-majeed-78266a182/",
    },
    {
      icon: Facebook,
      label: "Facebook",
      href: "https://www.facebook.com/profile.php?id=100080955712476",
    },
  ];

  const techStack = {
    Frontend: [
      "Next.js",
      "TypeScript",
      "Redux Toolkit",
      "Shadcn UI",
      "Framer Motion",
      "Zod",
    ],
    Backend: [
      "Express.js",
      "TypeScript",
      "PostgreSQL",
      "Prisma",
      "JWT",
      "Redis",
      "BullMQ",
    ],
  };

  const projectLinks = [
    {
      label: "View Source Code",
      href: "https://github.com/nuru484/traveltrek.git",
      icon: Github,
    },
    {
      label: "Portfolio",
      href: "https://manuru.dev",
      icon: ExternalLink,
    },
  ];

  const keyFeatures = [
    "Flight & Hotel Booking",
    "Secure Payment Integration",
    "Automated Booking Management",
    "Admin Dashboard & Reports",
    "Responsive Design",
    "Dark/Light Mode",
  ];

  return (
    <footer className="relative bg-card border-t border-border">
      {/* Subtle gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-background/50 to-transparent pointer-events-none" />

      <div className="relative container mx-auto px-4 sm:px-6 lg:px-8">
        {/* Main Footer Content */}
        <div className="py-12 lg:py-16">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
            {/* Developer Info Section */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              viewport={{ once: true }}
              className="lg:col-span-4"
            >
              <div className="mb-6">
                <h3 className="text-2xl lg:text-3xl font-bold mb-2 bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent">
                  Nurudeen Abdul-Majeed
                </h3>
                <p className="text-sm font-medium text-muted-foreground mb-4">
                  Full-Stack Developer
                </p>
                <p className="text-muted-foreground text-sm lg:text-base leading-relaxed">
                  A comprehensive travel and tour platform showcasing modern
                  full-stack development with flight booking, hotel
                  reservations, secure payments, automated booking management,
                  and admin reporting features.
                </p>
              </div>

              {/* Contact Information */}
              <div className="space-y-3">
                {contactInfo.map((contact, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, x: -10 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.4, delay: index * 0.1 }}
                    viewport={{ once: true }}
                  >
                    {contact.href ? (
                      <a
                        href={contact.href}
                        className="flex items-center gap-3 group"
                      >
                        <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-muted/60 flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                          <contact.icon className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                        </div>
                        <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">
                          {contact.text}
                        </span>
                      </a>
                    ) : (
                      <div className="flex items-center gap-3 group">
                        <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-muted/60 flex items-center justify-center">
                          <contact.icon className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <span className="text-sm text-muted-foreground">
                          {contact.text}
                        </span>
                      </div>
                    )}
                  </motion.div>
                ))}
              </div>

              {/* Project Links */}
              <div className="mt-6 flex flex-wrap gap-3">
                {projectLinks.map((link, index) => (
                  <motion.a
                    key={index}
                    href={link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary/10 hover:bg-primary/20 border border-primary/20 hover:border-primary/40 text-sm font-medium text-primary transition-all duration-200"
                  >
                    <link.icon className="h-4 w-4" />
                    {link.label}
                  </motion.a>
                ))}
              </div>
            </motion.div>

            {/* Tech Stack & Features */}
            <div className="lg:col-span-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Technology Stack */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.1 }}
                  viewport={{ once: true }}
                >
                  <div className="flex items-center gap-2 mb-4">
                    <Code className="h-5 w-5 text-primary" />
                    <h4 className="font-semibold text-foreground text-sm uppercase tracking-wide">
                      Technology Stack
                    </h4>
                  </div>

                  <div className="space-y-4">
                    {Object.entries(techStack).map(([category, techs]) => (
                      <div key={category}>
                        <p className="text-xs font-medium text-muted-foreground mb-2">
                          {category}
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {techs.map((tech) => (
                            <span
                              key={tech}
                              className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-muted/60 text-muted-foreground border border-border/50 hover:border-primary/30 hover:text-foreground transition-colors"
                            >
                              {tech}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </motion.div>

                {/* Key Features */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.2 }}
                  viewport={{ once: true }}
                >
                  <h4 className="font-semibold text-foreground mb-4 text-sm uppercase tracking-wide">
                    Key Features
                  </h4>
                  <ul className="space-y-2.5">
                    {keyFeatures.map((feature, index) => (
                      <motion.li
                        key={feature}
                        initial={{ opacity: 0, x: -10 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.3, delay: index * 0.05 }}
                        viewport={{ once: true }}
                        className="flex items-start gap-2 text-sm text-muted-foreground"
                      >
                        <span className="inline-block w-1.5 h-1.5 rounded-full bg-primary mt-1.5 flex-shrink-0" />
                        <span className="hover:text-foreground transition-colors">
                          {feature}
                        </span>
                      </motion.li>
                    ))}
                  </ul>
                </motion.div>
              </div>
            </div>
          </div>
        </div>

        <Separator className="bg-border/50" />

        {/* Bottom Bar */}
        <div className="py-6 lg:py-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            {/* Copyright */}
            <motion.div
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              transition={{ duration: 0.5 }}
              viewport={{ once: true }}
              className="flex flex-col sm:flex-row items-center gap-4 text-center sm:text-left"
            >
              <p className="text-sm text-muted-foreground">
                © {currentYear} Nurudeen Abdul-Majeed. Built to showcase
                full-stack capabilities.
              </p>
            </motion.div>

            {/* Social Links */}
            <motion.div
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              viewport={{ once: true }}
              className="flex items-center gap-3"
            >
              {socialLinks.map((social, index) => (
                <motion.a
                  key={`${social.label}-${index}`}
                  href={social.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  whileHover={{ scale: 1.1, y: -2 }}
                  whileTap={{ scale: 0.95 }}
                  className="w-10 h-10 rounded-full bg-muted/60 hover:bg-primary/10 border border-border/50 hover:border-primary/30 flex items-center justify-center transition-all duration-200 group"
                  aria-label={social.label}
                >
                  <social.icon className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                </motion.a>
              ))}
            </motion.div>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
