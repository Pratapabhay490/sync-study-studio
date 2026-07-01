import { useEffect, useRef, useState, type ReactNode, type CSSProperties } from "react";

type Direction = "up" | "down" | "left" | "right" | "fade" | "scale";

interface Props {
  children: ReactNode;
  direction?: Direction;
  delay?: number;
  duration?: number;
  distance?: number;
  once?: boolean;
  className?: string;
  as?: keyof React.JSX.IntrinsicElements;
  threshold?: number;
}

function initialTransform(direction: Direction, distance: number): string {
  switch (direction) {
    case "up": return `translate3d(0, ${distance}px, 0)`;
    case "down": return `translate3d(0, -${distance}px, 0)`;
    case "left": return `translate3d(${distance}px, 0, 0)`;
    case "right": return `translate3d(-${distance}px, 0, 0)`;
    case "scale": return "scale(0.92)";
    default: return "none";
  }
}

export function ScrollReveal({
  children,
  direction = "up",
  delay = 0,
  duration = 700,
  distance = 24,
  once = true,
  className,
  as: Tag = "div",
  threshold = 0.12,
}: Props) {
  const ref = useRef<HTMLElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof window === "undefined" || !("IntersectionObserver" in window)) {
      setVisible(true);
      return;
    }
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      setVisible(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setVisible(true);
            if (once) io.unobserve(entry.target);
          } else if (!once) {
            setVisible(false);
          }
        });
      },
      { threshold, rootMargin: "0px 0px -8% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [once, threshold]);

  const style: CSSProperties = {
    opacity: visible ? 1 : 0,
    transform: visible ? "none" : initialTransform(direction, distance),
    transition: `opacity ${duration}ms cubic-bezier(0.22, 1, 0.36, 1) ${delay}ms, transform ${duration}ms cubic-bezier(0.22, 1, 0.36, 1) ${delay}ms`,
    willChange: "opacity, transform",
  };

  const Component = Tag as any;
  return (
    <Component ref={ref as any} className={className} style={style}>
      {children}
    </Component>
  );
}

export default ScrollReveal;
