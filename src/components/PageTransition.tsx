import { useEffect, useRef, useState, type ReactNode } from "react";
import { useRouterState } from "@tanstack/react-router";

/**
 * Black-hole route transition: a singularity collapses from the click origin,
 * pulls the page in, then releases the new view with a warp-out.
 */
export function PageTransition({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [phase, setPhase] = useState<"idle" | "collapse" | "release">("idle");
  const origin = useRef({ x: 50, y: 50 });
  const first = useRef(true);

  // Track the last pointer position so the singularity opens where the user tapped.
  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      origin.current = {
        x: (e.clientX / window.innerWidth) * 100,
        y: (e.clientY / window.innerHeight) * 100,
      };
    };
    window.addEventListener("pointerdown", onDown, { passive: true });
    return () => window.removeEventListener("pointerdown", onDown);
  }, []);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    setPhase("collapse");
    const a = window.setTimeout(() => setPhase("release"), 380);
    const b = window.setTimeout(() => setPhase("idle"), 1000);
    return () => {
      window.clearTimeout(a);
      window.clearTimeout(b);
    };
  }, [pathname]);

  return (
    <div className="relative">
      {phase !== "idle" && (
        <div
          aria-hidden
          className="pointer-events-none fixed inset-0 z-[60] overflow-hidden"
          style={
            {
              "--hx": `${origin.current.x}%`,
              "--hy": `${origin.current.y}%`,
            } as React.CSSProperties
          }
        >
          <div className={phase === "collapse" ? "blackhole-in" : "blackhole-out"} />
          <div className={phase === "collapse" ? "blackhole-ring" : "blackhole-ring-out"} />
          <div className="blackhole-dust" />
        </div>
      )}
      <div key={pathname} className={phase === "collapse" ? "warp-suck" : "warp-emerge"}>
        {children}
      </div>
    </div>
  );
}
