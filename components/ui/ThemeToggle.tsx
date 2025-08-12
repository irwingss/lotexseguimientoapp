"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ThemeToggle() {
  const [theme, setTheme] = useState<"dark" | "light">(() => {
    if (typeof window === "undefined") return "dark";
    try {
      const t = localStorage.getItem("theme");
      return t === "light" ? "light" : "dark";
    } catch {
      return "dark";
    }
  });

  useEffect(() => {
    const classes = document.documentElement.classList;
    if (theme === "light") {
      classes.remove("dark");
    } else {
      classes.add("dark");
    }
    try {
      localStorage.setItem("theme", theme);
    } catch {}
  }, [theme]);

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label="Toggle theme"
      onClick={() => setTheme((t) => (t === "light" ? "dark" : "light"))}
      className="h-8 w-8"
    >
      {theme === "light" ? (
        <Sun className="h-4 w-4" />
      ) : (
        <Moon className="h-4 w-4" />
      )}
    </Button>
  );
}
