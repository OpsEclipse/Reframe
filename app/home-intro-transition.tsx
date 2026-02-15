"use client";

import { useEffect } from "react";

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
}

export default function HomeIntroTransition() {
  useEffect(() => {
    const root = document.getElementById("ch26-home");
    if (!root) return;

    if (prefersReducedMotion()) {
      root.setAttribute("data-ch26-stage", "final");
      return;
    }

    // Ensure the "intro" state paints first, then begin the slow transition.
    const timeout = window.setTimeout(() => {
      root.setAttribute("data-ch26-stage", "final");
    }, 120);

    return () => {
      window.clearTimeout(timeout);
    };
  }, []);

  return null;
}
