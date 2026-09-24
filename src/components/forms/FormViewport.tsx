import { useLayoutEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

/** Full-screen form kept inside the visible iPhone viewport, including keyboard resize. */
export function FormViewport({ children }: { children: ReactNode }) {
  const root = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const viewport = window.visualViewport;
    const resize = () => {
      if (!root.current) return;
      root.current.style.height = `${viewport?.height ?? window.innerHeight}px`;
      root.current.style.top = `${viewport?.offsetTop ?? 0}px`;
    };
    resize();
    viewport?.addEventListener('resize', resize);
    viewport?.addEventListener('scroll', resize);
    window.addEventListener('resize', resize);
    return () => {
      viewport?.removeEventListener('resize', resize);
      viewport?.removeEventListener('scroll', resize);
      window.removeEventListener('resize', resize);
    };
  }, []);
  return createPortal(
    <div ref={root} data-testid="form-viewport"
      className="fixed inset-x-0 top-0 z-20 flex h-dvh-safe min-h-0 flex-col overflow-hidden bg-[#0B100D] pt-[env(safe-area-inset-top,0px)] pl-[env(safe-area-inset-left,0px)] pr-[env(safe-area-inset-right,0px)]">
      {children}
    </div>, document.body,
  );
}
