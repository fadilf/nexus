"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

interface LogoProps {
  className?: string;
}

export default function Logo({ className = "h-7 w-7" }: LogoProps) {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [hovering, setHovering] = useState(false);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), []);

  const isDark = mounted && resolvedTheme === "dark";
  const primary = isDark ? "#2dd4bf" : "#0d9488";
  const secondary = isDark ? "#5eead4" : "#14b8a6";

  const bars = [
    { y: 20, width: 50, fill: primary },
    { y: 34, width: 38, fill: secondary },
    { y: 48, width: 46, fill: primary },
    { y: 62, width: 32, fill: secondary },
    { y: 76, width: 50, fill: primary },
  ];

  return (
    <svg
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
      onMouseEnter={() => setHovering(true)}
      onAnimationEnd={() => setHovering(false)}
    >
      {bars.map((bar, i) => (
        <rect
          key={bar.y}
          x="25"
          y={bar.y}
          width={bar.width}
          height="8"
          rx="4"
          fill={bar.fill}
          style={
            hovering
              ? {
                  animation: "logo-stretch 0.45s ease-in-out forwards",
                  animationDelay: `${i * 0.07}s`,
                  transformOrigin: "25px center",
                }
              : { transformOrigin: "25px center" }
          }
          onAnimationEnd={
            i === bars.length - 1
              ? (e) => {
                  e.stopPropagation();
                  setHovering(false);
                }
              : (e) => e.stopPropagation()
          }
        />
      ))}
      <style>{`
        @keyframes logo-stretch {
          0% { transform: scaleX(1); }
          35% { transform: scaleX(1.35); }
          65% { transform: scaleX(0.92); }
          100% { transform: scaleX(1); }
        }
      `}</style>
    </svg>
  );
}
