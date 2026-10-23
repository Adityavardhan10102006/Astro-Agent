"use client";

import * as React from "react";
import { PrismaHero } from "@/components/ui/prisma-hero";

export default function PrismaHeroDemo() {
  const handleNavigate = (destination: string) => {
    console.log(`Navigating to ASTRO destination: ${destination}`);
  };

  return (
    <div className="relative min-h-screen w-full bg-background p-4 sm:p-8 flex items-center justify-center">
      <div className="w-full max-w-5xl">
        <PrismaHero
          brandName="ASTRO"
          statusBadge="Offline-First Privacy"
          primaryAction={{
            label: "Start Chatting",
            onClick: () => handleNavigate("chat-screen"),
          }}
          secondaryAction={{
            label: "Open Coding Studio",
            onClick: () => handleNavigate("studio-screen"),
          }}
          navItems={[
            { id: "chat", label: "AI Chat", onClick: () => handleNavigate("chat-screen") },
            { id: "studio", label: "Coding Studio", onClick: () => handleNavigate("studio-screen") },
            { id: "models", label: "Model Manager", onClick: () => handleNavigate("models-screen") },
            { id: "settings", label: "Settings", onClick: () => handleNavigate("settings-screen") },
          ]}
        />
      </div>
    </div>
  );
}
