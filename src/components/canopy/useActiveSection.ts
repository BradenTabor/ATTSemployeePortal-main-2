import { useCallback, useEffect, useState } from "react";

/**
 * Tracks which of the given section ids is currently most visible inside the
 * nearest `[data-scroll-container]` (the app shell scrolls internally, so the
 * default viewport root would never fire).
 */
export function useActiveSection(ids: string[]): [string, (id: string) => void] {
  const [active, setActive] = useState(ids[0] ?? "");

  useEffect(() => {
    if (ids.length === 0) return;
    const first = document.getElementById(ids[0]);
    const root = first?.closest<HTMLElement>("[data-scroll-container]") ?? null;
    const ratios = new Map<string, number>();

    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) ratios.set(e.target.id, e.isIntersecting ? e.intersectionRatio : 0);
        let best = "";
        let bestRatio = 0;
        for (const id of ids) {
          const r = ratios.get(id) ?? 0;
          if (r > bestRatio) {
            bestRatio = r;
            best = id;
          }
        }
        if (best) setActive(best);
      },
      { root, threshold: [0, 0.15, 0.3, 0.5, 0.7, 1], rootMargin: "-20% 0px -50% 0px" }
    );

    for (const id of ids) {
      const el = document.getElementById(id);
      if (el) io.observe(el);
    }
    return () => io.disconnect();
  }, [ids]);

  const jump = useCallback((id: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "start" });
    setActive(id);
  }, []);

  return [active, jump];
}
