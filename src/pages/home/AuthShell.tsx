import React from "react";

interface AuthShellProps {
  /** Brand panel content (logo, headline, trust signals). */
  brand: React.ReactNode;
  /** The form panel content. */
  children: React.ReactNode;
  /** Optional small footer rendered beneath the form. */
  footer?: React.ReactNode;
}

/**
 * CANOPY auth layout.
 *  - < xl: single column over the Understory. Brand above the form slab.
 *  - >= xl: asymmetric split. Left = brand + obsidian leaf hero floating in the
 *           atmosphere. Right = a calm ink panel with a hairline seam.
 *
 * The Understory atmosphere is rendered once at the app shell (App.tsx), so
 * this layout is transparent and simply sits on top of it.
 */
export const AuthShell: React.FC<AuthShellProps> = ({ brand, children, footer }) => {
  return (
    <main className="relative min-h-dvh-safe w-full overflow-hidden text-bone-100">
      <div className="relative z-20 grid min-h-dvh-safe grid-cols-1 xl:grid-cols-[1.1fr_0.9fr]">
        <section className="flex flex-col items-center justify-center px-6 pb-4 pt-[max(2.5rem,calc(env(safe-area-inset-top)+1rem))] text-center xl:items-start xl:px-16 xl:py-16 xl:text-left 2xl:px-24">
          {brand}
        </section>

        <section className="relative flex flex-col items-center justify-center px-4 pb-12 pt-2 xl:px-16 xl:py-16 2xl:px-24 xl:bg-ink-950/70 xl:backdrop-blur-[2px]">
          {/* seam */}
          <span aria-hidden className="pointer-events-none absolute inset-y-10 left-0 hidden w-px bg-[linear-gradient(180deg,transparent,rgba(61,220,132,0.45),transparent)] xl:block" />
          <div className="flex w-full max-w-md flex-col items-center">
            {children}
            {footer && <div className="mt-6 w-full">{footer}</div>}
          </div>
        </section>
      </div>
    </main>
  );
};
