import { useEffect } from "react";

/**
 * Auto-applies scroll-reveal to top-level sections within <main>.
 * Runs whenever the route pathname changes.
 */
export function useAutoReveal(pathname: string) {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

    // Wait for the new page to mount / animate in
    const raf = requestAnimationFrame(() => {
      const main = document.querySelector("main");
      if (!main) return;

      // Target direct children of the outer space-y / grid wrappers, plus explicit opt-ins.
      const selectors = [
        "[data-reveal]",
        "main > div > div > section",
        "main > div > div > div > section",
        "main section",
        "main > div > div > .clay",
        "main > div > div > div > .clay",
      ];
      const nodes = new Set<HTMLElement>();
      selectors.forEach((sel) => {
        main.querySelectorAll<HTMLElement>(sel).forEach((el) => nodes.add(el));
      });

      const targets = Array.from(nodes).filter((el) => {
        // Skip already-revealed or nested inside another reveal target
        if (el.dataset.revealApplied === "1") return false;
        return true;
      });

      // Stagger index per top-level group
      targets.forEach((el, i) => {
        el.dataset.revealApplied = "1";
        el.classList.add("reveal-init");
        el.style.transitionDelay = `${Math.min(i, 8) * 70}ms`;
      });

      if (!("IntersectionObserver" in window)) {
        targets.forEach((el) => el.classList.add("reveal-in"));
        return;
      }

      const io = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              (entry.target as HTMLElement).classList.add("reveal-in");
              io.unobserve(entry.target);
            }
          });
        },
        { threshold: 0.08, rootMargin: "0px 0px -6% 0px" },
      );
      targets.forEach((el) => io.observe(el));

      // Safety: reveal anything still hidden after 1.2s (e.g. above-the-fold on short pages)
      const t = window.setTimeout(() => {
        targets.forEach((el) => el.classList.add("reveal-in"));
      }, 1200);

      return () => {
        io.disconnect();
        window.clearTimeout(t);
      };
    });

    return () => cancelAnimationFrame(raf);
  }, [pathname]);
}
