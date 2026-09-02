import { lazy, ReactNode, Suspense } from "react";
import { InstrumentBar } from "../components/canopy/InstrumentBar";

// Only renders when a graded test result is waiting; keep its hooks/UI out of the startup bundle.
const CertificationResultOverlay = lazy(() =>
  import("../components/certifications/CertificationResultOverlay").then((m) => ({
    default: m.CertificationResultOverlay,
  }))
);

interface DashboardLayoutProps {
  title?: string;
  children: ReactNode;
  hideHeader?: boolean;
  /** When true, the page renders the visible document <h1>; layout shows logo only (no duplicate title). */
  pageHeading?: boolean;
}

/**
 * DashboardLayout — the CANOPY shell.
 *
 *   ┌───────────────────────────────────────────┐
 *   │ Understory (WebGL atmosphere) — rendered  │
 *   │ ONCE by <AppAtmosphere> in App.tsx so the │
 *   │ shader survives route changes.            │
 *   │  ┌─────────────────────────────────────┐  │
 *   │  │ InstrumentBar                       │  │
 *   │  │ ───────── vein ─────────            │  │
 *   │  │ <main>                              │  │
 *   │  └─────────────────────────────────────┘  │
 *   │  ◐ Return dock (mounted at router root)   │
 *   └───────────────────────────────────────────┘
 *
 * Height uses the dynamic viewport (100dvh) so the scroll container never
 * hides its last rows behind the mobile browser toolbar. The return dock is
 * rendered once by <AnimatedRoutes> so it stays fixed through route
 * transitions instead of remounting with each page.
 */
export default function DashboardLayout({
  title,
  children,
  hideHeader = false,
  pageHeading = false,
}: DashboardLayoutProps) {
  return (
    <div className="relative h-dvh-safe w-full overflow-hidden text-bone-100">
      <div
        data-scroll-container
        // Padding is floored by the iOS safe-area insets (viewport-fit=cover) so
        // the InstrumentBar clears the status bar / Dynamic Island in standalone
        // mode and content never sits under the notch in landscape.
        className={`relative z-10 h-full overflow-y-auto overflow-x-hidden scroll-container scroll-smooth-touch px-[max(1rem,env(safe-area-inset-left))] sm:px-[max(2rem,env(safe-area-inset-left))] lg:px-[max(3rem,env(safe-area-inset-left))] ${
          hideHeader
            ? "pt-[env(safe-area-inset-top)]"
            : "pt-[max(1.25rem,env(safe-area-inset-top))] sm:pt-[max(1.75rem,env(safe-area-inset-top))]"
        } pb-6 safe-area-inset-bottom`}
      >
        {!hideHeader && (
          <InstrumentBar title={title} hideTitle={pageHeading} className="mx-auto mb-8 w-full max-w-[1400px]" />
        )}

        <main className="flex w-full flex-col items-center justify-start pb-8">
          {title && !pageHeading && <h1 className="sr-only">{title}</h1>}
          {children}
        </main>
      </div>

      <Suspense fallback={null}>
        <CertificationResultOverlay />
      </Suspense>
    </div>
  );
}
