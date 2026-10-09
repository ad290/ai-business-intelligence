import { useEffect, useState } from "react";

export type Breakpoint = "mobile" | "tablet" | "desktop";

export function getBreakpoint(width: number): Breakpoint {
  if (width < 640) {
    return "mobile";
  }

  if (width < 1024) {
    return "tablet";
  }

  return "desktop";
}

export function useBreakpoint(): Breakpoint {
  const [breakpoint, setBreakpoint] = useState<Breakpoint>(() =>
    getBreakpoint(window.innerWidth)
  );

  useEffect(() => {
    const update = () => setBreakpoint(getBreakpoint(window.innerWidth));

    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  return breakpoint;
}

export function chartHeightForBreakpoint(breakpoint: Breakpoint): number {
  switch (breakpoint) {
    case "mobile":
      return 220;
    case "tablet":
      return 280;
    default:
      return 320;
  }
}

export function yAxisWidthForBreakpoint(breakpoint: Breakpoint): number {
  return breakpoint === "mobile" ? 40 : 56;
}
