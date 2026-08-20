import { useEffect } from "react";

/**
 * Auto-applies scroll-reveal to the top-level blocks of whatever page is
 * rendered inside <main>. Runs whenever the route pathname changes and
 * re-scans a few times so async-loaded content also gets revealed.
 */
export function useAutoReveal(pathname: string) {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

    const timeouts: number[] = [];
    let io: IntersectionObserver | null = null;

    if ("IntersectionObserver" in window) {
      io = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              (entry.target as HTMLElement).classList.add("reveal-in");
              io?.unobserve(entry.target);
            }
          });
        },
        { threshold: 0.08, rootMargin: "0px 0px -6% 0px" },
      );
    }

    function apply() {
      const main = document.querySelector("main");
      if (!main) return;

      // Walk down through single-child wrappers to find the real page container,
      // so every page gets reveal on its top-level blocks (universal).
      let container: HTMLElement = main;
      let guard = 0;
      while (
        guard++ < 5 &&
        container.childElementCount === 1 &&
        container.firstElementChild instanceof HTMLElement
      ) {
        container = container.firstElementChild;
      }

      const nodes = new Set<HTMLElement>();
      Array.from(container.children).forEach((el) => {
        if (el instanceof HTMLElement) nodes.add(el);
      });
      main.querySelectorAll<HTMLElement>("[data-reveal]").forEach((el) => nodes.add(el));

      const targets = Array.from(nodes).filter((el) => {
        if (el.dataset.revealApplied === "1") return false;
        // Skip nodes managed by <ScrollReveal /> (they set inline opacity/transition)
        if (el.style.transition && el.style.opacity !== "") return false;
        const pos = getComputedStyle(el).position;
        if (pos === "fixed" || pos === "sticky") return false;
        if (el.offsetHeight === 0) return false;
        return true;
      });

      if (!targets.length) return;

      targets.forEach((el, i) => {
        el.dataset.revealApplied = "1";
        el.classList.add("reveal-init");
        el.style.transitionDelay = `${Math.min(i, 8) * 70}ms`;
      });

      if (!io) {
        targets.forEach((el) => el.classList.add("reveal-in"));
        return;
      }
      targets.forEach((el) => io!.observe(el));

      // Safety: reveal anything still hidden shortly after (short pages, no scroll)
      timeouts.push(
        window.setTimeout(() => {
          targets.forEach((el) => el.classList.add("reveal-in"));
        }, 1200),
      );
    }

    const raf = requestAnimationFrame(apply);
    // Re-scan for content that mounts after async data loads.
    [250, 700, 1500].forEach((ms) => timeouts.push(window.setTimeout(apply, ms)));

    return () => {
      cancelAnimationFrame(raf);
      timeouts.forEach((t) => window.clearTimeout(t));
      io?.disconnect();
    };
  }, [pathname]);
}
