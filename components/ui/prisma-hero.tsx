"use client";

import * as React from "react";
import { motion, useInView, useReducedMotion, type Variants } from "framer-motion";
import { MessageSquare, Code2, Cpu, Settings, ArrowRight, ShieldCheck, HardDrive } from "lucide-react";
import { cn } from "@/lib/utils";

// ----------------------------------------------------------------------
// 1. WordsPullUp Component & Props
// ----------------------------------------------------------------------
export interface WordsPullUpProps {
  words: string;
  wrapperFramerProps?: Variants;
  framerProps?: Variants;
  className?: string;
  as?: React.ElementType;
}

export const WordsPullUp: React.FC<WordsPullUpProps> = ({
  words,
  wrapperFramerProps = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.08,
        delayChildren: 0.1,
      },
    },
  },
  framerProps = {
    hidden: { y: 20, opacity: 0 },
    show: {
      y: 0,
      opacity: 1,
      transition: {
        duration: 0.5,
        ease: [0.16, 1, 0.3, 1],
      },
    },
  },
  className = "",
  as: Component = "h1",
}) => {
  const containerRef = React.useRef<HTMLElement>(null);
  const isInView = useInView(containerRef, { once: true, margin: "-40px" });
  const shouldReduceMotion = useReducedMotion();
  const splitWords = words.split(" ");

  const MotionComponent = motion.create(Component as keyof React.JSX.IntrinsicElements);

  if (shouldReduceMotion) {
    return <Component className={className}>{words}</Component>;
  }

  return (
    <MotionComponent
      ref={containerRef as any}
      variants={wrapperFramerProps}
      initial="hidden"
      animate={isInView ? "show" : "hidden"}
      className={cn("flex flex-wrap items-baseline gap-x-[0.25em]", className)}
    >
      {splitWords.map((word, i) => (
        <span key={`${word}-${i}`} className="inline-block overflow-hidden py-1 -my-1">
          <motion.span variants={framerProps} className="inline-block">
            {word === "" ? "\u00A0" : word}
          </motion.span>
        </span>
      ))}
    </MotionComponent>
  );
};

// ----------------------------------------------------------------------
// 2. WordsPullUpMultiStyle Component & Props
// ----------------------------------------------------------------------
export interface TextSegment {
  text: string;
  className?: string;
}

export interface WordsPullUpMultiStyleProps {
  segments: TextSegment[];
  wrapperFramerProps?: Variants;
  framerProps?: Variants;
  className?: string;
  as?: React.ElementType;
}

export const WordsPullUpMultiStyle: React.FC<WordsPullUpMultiStyleProps> = ({
  segments,
  wrapperFramerProps = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.06,
        delayChildren: 0.15,
      },
    },
  },
  framerProps = {
    hidden: { y: 16, opacity: 0 },
    show: {
      y: 0,
      opacity: 1,
      transition: {
        duration: 0.45,
        ease: [0.16, 1, 0.3, 1],
      },
    },
  },
  className = "",
  as: Component = "div",
}) => {
  const containerRef = React.useRef<HTMLElement>(null);
  const isInView = useInView(containerRef, { once: true, margin: "-40px" });
  const shouldReduceMotion = useReducedMotion();

  const MotionComponent = motion.create(Component as keyof React.JSX.IntrinsicElements);

  if (shouldReduceMotion) {
    return (
      <Component className={cn("flex flex-wrap items-baseline gap-x-[0.25em]", className)}>
        {segments.map((seg, idx) => (
          <span key={idx} className={seg.className}>
            {seg.text}{" "}
          </span>
        ))}
      </Component>
    );
  }

  return (
    <MotionComponent
      ref={containerRef as any}
      variants={wrapperFramerProps}
      initial="hidden"
      animate={isInView ? "show" : "hidden"}
      className={cn("flex flex-wrap items-baseline gap-x-[0.25em]", className)}
    >
      {segments.map((segment, segIdx) => {
        const words = segment.text.split(" ");
        return (
          <span
            key={segIdx}
            className={cn("inline-flex flex-wrap items-baseline gap-x-[0.25em]", segment.className)}
          >
            {words.map((word, wordIdx) => (
              <span key={`${word}-${wordIdx}`} className="inline-block overflow-hidden py-0.5 -my-0.5">
                <motion.span variants={framerProps} className="inline-block">
                  {word === "" ? "\u00A0" : word}
                </motion.span>
              </span>
            ))}
          </span>
        );
      })}
    </MotionComponent>
  );
};

// ----------------------------------------------------------------------
// 3. Navigation & Action Types for ASTRO
// ----------------------------------------------------------------------
export interface HeroNavItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  active?: boolean;
  onClick?: () => void;
}

export interface HeroAction {
  label: string;
  onClick?: () => void;
  icon?: React.ReactNode;
  variant?: "primary" | "secondary" | "ghost";
}

export interface PrismaHeroProps {
  /** The main wordmark, defaults to "ASTRO" */
  brandName?: string;
  /** Superscript or status pill label, e.g. "Offline-First" */
  statusBadge?: string;
  /** Multi-styled animated tagline segments */
  taglineSegments?: TextSegment[];
  /** Concise description paragraph */
  description?: string;
  /** Navigation destinations in ASTRO */
  navItems?: HeroNavItem[];
  /** Primary CTA button (e.g. "Start Chatting") */
  primaryAction?: HeroAction;
  /** Secondary CTA button (e.g. "Coding Studio") */
  secondaryAction?: HeroAction;
  /** Optional noise overlay texture */
  showNoise?: boolean;
  /** Optional custom className */
  className?: string;
}

// ----------------------------------------------------------------------
// 4. Main PrismaHero Component (Adapted to ASTRO)
// ----------------------------------------------------------------------
export const PrismaHero: React.FC<PrismaHeroProps> = ({
  brandName = "ASTRO",
  statusBadge = "Offline-First • Private AI",
  taglineSegments = [
    { text: "Private, local intelligence", className: "font-semibold text-foreground tracking-tight" },
    { text: "engineered for your laptop.", className: "italic font-serif text-primary/90" },
  ],
  description = "ASTRO runs fully offline on AMD Ryzen hardware. No cloud accounts, zero telemetry, local RAG knowledge retrieval, and direct desktop assistance.",
  navItems = [
    { id: "chat", label: "AI Chat", icon: <MessageSquare className="size-3.5" /> },
    { id: "studio", label: "Coding Studio", icon: <Code2 className="size-3.5" /> },
    { id: "models", label: "Model Manager", icon: <Cpu className="size-3.5" /> },
    { id: "settings", label: "Settings", icon: <Settings className="size-3.5" /> },
  ],
  primaryAction = {
    label: "Start Chatting",
    icon: <ArrowRight className="size-4" />,
    variant: "primary",
  },
  secondaryAction = {
    label: "Coding Studio",
    icon: <Code2 className="size-4" />,
    variant: "secondary",
  },
  showNoise = true,
  className = "",
}) => {
  const shouldReduceMotion = useReducedMotion();

  return (
    <div
      className={cn(
        "relative flex min-h-[580px] w-full flex-col justify-between overflow-hidden rounded-2xl border border-border bg-card/60 p-6 sm:p-10 text-foreground backdrop-blur-md shadow-lg",
        className
      )}
      style={{
        backgroundImage:
          "radial-gradient(circle at 50% 0%, rgba(59, 130, 246, 0.14) 0%, rgba(16, 185, 129, 0.05) 45%, transparent 75%)",
      }}
    >
      {/* Optional Noise Effect (Safe offline SVG-based noise) */}
      {showNoise && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-[0.03] mix-blend-overlay"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
          }}
        />
      )}

      {/* Top Floating Navigation Bar */}
      <header className="relative z-10 flex w-full items-center justify-between gap-4 border-b border-border/50 pb-5">
        <div className="flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-xl bg-primary/10 border border-primary/20 text-primary shadow-sm font-bold text-sm tracking-widest">
            A
          </div>
          <div className="flex flex-col">
            <span className="font-bold text-sm leading-tight tracking-wider text-foreground">
              {brandName}
            </span>
            <span className="text-[10px] text-muted-foreground font-mono flex items-center gap-1">
              <ShieldCheck className="size-3 text-emerald-500" />
              100% Offline
            </span>
          </div>
        </div>

        {/* Desktop Navigation Links */}
        {navItems && navItems.length > 0 && (
          <nav aria-label="ASTRO Destinations" className="hidden md:flex items-center gap-1 rounded-full border border-border/60 bg-muted/40 p-1 backdrop-blur-sm">
            {navItems.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={item.onClick}
                className={cn(
                  "flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  item.active
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                )}
              >
                {item.icon}
                <span>{item.label}</span>
              </button>
            ))}
          </nav>
        )}

        {/* Top Status Pill */}
        <div className="flex items-center gap-2">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-[11px] font-medium text-emerald-400">
            <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span>{statusBadge}</span>
          </div>
        </div>
      </header>

      {/* Central Content Section */}
      <main className="relative z-10 my-auto flex flex-col items-center text-center py-10 sm:py-14 max-w-4xl mx-auto">
        {/* Giant Hero Wordmark with Status Superscript */}
        <div className="relative inline-flex items-baseline justify-center select-none">
          <WordsPullUp
            words={brandName}
            className="text-6xl sm:text-8xl md:text-9xl font-extrabold tracking-tighter text-foreground drop-shadow-sm"
          />
          <span
            className="absolute -top-1 -right-6 sm:-right-8 text-xs sm:text-sm font-mono px-2 py-0.5 rounded-full bg-primary/10 border border-primary/20 text-primary"
            title="Local Engine"
          >
            v0.1
          </span>
        </div>

        {/* Multi-styled animated tagline */}
        <div className="mt-4 sm:mt-6 text-xl sm:text-2xl md:text-3xl text-center justify-center">
          <WordsPullUpMultiStyle segments={taglineSegments} className="justify-center text-center" />
        </div>

        {/* Concise Description */}
        <p className="mt-4 max-w-2xl text-xs sm:text-sm text-muted-foreground leading-relaxed">
          {description}
        </p>

        {/* Call to Action Buttons */}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3.5">
          {primaryAction && (
            <button
              type="button"
              onClick={primaryAction.onClick}
              className="group inline-flex items-center gap-2 rounded-full bg-primary px-6 py-2.5 text-xs sm:text-sm font-semibold text-primary-foreground shadow-md transition-all duration-200 hover:opacity-90 hover:shadow-primary/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.98]"
            >
              <span>{primaryAction.label}</span>
              <span className="flex size-5 items-center justify-center rounded-full bg-primary-foreground/20 text-primary-foreground transition-transform duration-200 group-hover:translate-x-0.5">
                {primaryAction.icon || <ArrowRight className="size-3" />}
              </span>
            </button>
          )}

          {secondaryAction && (
            <button
              type="button"
              onClick={secondaryAction.onClick}
              className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-5 py-2.5 text-xs sm:text-sm font-medium text-foreground transition-all duration-200 hover:bg-accent hover:border-border/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.98]"
            >
              {secondaryAction.icon}
              <span>{secondaryAction.label}</span>
            </button>
          )}
        </div>
      </main>

      {/* Footer Info Strip */}
      <footer className="relative z-10 flex flex-wrap items-center justify-between gap-3 border-t border-border/50 pt-4 text-[11px] text-muted-foreground">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5">
            <HardDrive className="size-3 text-primary" />
            Hardware: AMD Ryzen 5 Ready
          </span>
          <span className="hidden sm:inline">•</span>
          <span className="hidden sm:inline">Default Model: Qwen2.5-Coder-7B</span>
        </div>
        <div className="flex items-center gap-1 font-mono text-[10px]">
          <span>Protected Workspace: Zero Outbound Telemetry</span>
        </div>
      </footer>
    </div>
  );
};

// Backwards compatibility alias
export const AstroHero = PrismaHero;
export default PrismaHero;
