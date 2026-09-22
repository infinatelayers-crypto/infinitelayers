"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/context/theme-context";

export function ThemeToggle({ className = "" }: { className?: string }) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      title={isDark ? "Light mode" : "Dark mode"}
      className={`group relative inline-flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border border-border bg-surface text-fg-muted transition hover:border-accent/40 hover:text-fg ${className}`}
    >
      <Sun
        className={`absolute h-[18px] w-[18px] transition-all duration-500 ${
          isDark
            ? "translate-y-8 rotate-90 opacity-0"
            : "translate-y-0 rotate-0 opacity-100"
        }`}
        strokeWidth={2}
      />
      <Moon
        className={`absolute h-[18px] w-[18px] transition-all duration-500 ${
          isDark
            ? "translate-y-0 rotate-0 opacity-100"
            : "-translate-y-8 -rotate-90 opacity-0"
        }`}
        strokeWidth={2}
      />
    </button>
  );
}
