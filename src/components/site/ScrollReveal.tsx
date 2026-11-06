"use client";

import { useEffect } from "react";

/*
 * Scroll reveal for the home page. Elements carry the `rv` class in the
 * server markup; home.css only hides them under `html.js`, which the (site)
 * layout sets before first paint when IntersectionObserver exists and reduced
 * motion is off. Siblings stagger in, then lose the class so hover
 * transitions go back to their own timing.
 */
export function ScrollReveal() {
  useEffect(() => {
    if (!document.documentElement.classList.contains("js")) return;
    const timers: number[] = [];
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (!e.isIntersecting) return;
          const el = e.target as HTMLElement;
          const sib = el.parentNode ? Array.prototype.indexOf.call(el.parentNode.children, el) : 0;
          el.style.transitionDelay = Math.min(sib, 6) * 70 + "ms";
          el.classList.add("in");
          io.unobserve(el);
          timers.push(
            window.setTimeout(() => {
              el.classList.remove("rv");
              el.style.transitionDelay = "";
            }, 1400),
          );
        });
      },
      { rootMargin: "0px 0px -8% 0px" },
    );
    document.querySelectorAll(".rv").forEach((el) => io.observe(el));
    return () => {
      io.disconnect();
      timers.forEach(clearTimeout);
    };
  }, []);

  return null;
}
