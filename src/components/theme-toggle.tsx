
"use client";

import * as React from "react";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ThemeToggle() {
  // Initialize theme state to null initially to avoid hydration mismatch.
  // useEffect will set the actual theme based on localStorage/system preference.
  const [theme, setThemeState] = React.useState<"light" | "dark" | null>(null);
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
    const storedTheme = localStorage.getItem("theme") as "light" | "dark" | null;
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    
    let currentTheme: "light" | "dark";
    if (storedTheme) {
      currentTheme = storedTheme;
    } else {
      currentTheme = prefersDark ? "dark" : "light";
    }
    
    setThemeState(currentTheme);
    
    if (currentTheme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, []);

  const toggleTheme = () => {
    setThemeState((prevTheme) => {
      const newTheme = prevTheme === "light" ? "dark" : "light";
      localStorage.setItem("theme", newTheme);
      if (newTheme === "dark") {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
      return newTheme;
    });
  };

  if (!mounted || !theme) {
    // Render a placeholder or null until the component is mounted and theme is determined
    // This helps prevent hydration mismatch and flashing of incorrect theme
    return (
      <Button variant="outline" size="icon" disabled className="h-[2.5rem] w-[2.5rem]">
        <Sun className="h-[1.2rem] w-[1.2rem]" /> 
      </Button>
    );
  }

  return (
    <Button variant="outline" size="icon" onClick={toggleTheme} aria-label="Toggle theme" className="h-[2.5rem] w-[2.5rem]">
      {theme === "light" ? (
        <Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all" />
      ) : (
        <Moon className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all" />
      )}
      <span className="sr-only">Toggle theme</span>
    </Button>
  );
}
