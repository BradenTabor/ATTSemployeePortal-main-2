import { useEffect, useRef, type RefObject } from 'react';

/**
 * Autoplay a video when it enters the viewport, pause when it exits.
 * Sets preload="none" until visible, then loads and plays.
 */
export function useAutoplayOnVisible(
  videoRef: RefObject<HTMLVideoElement | null>,
  { threshold = 0.25, rootMargin = '100px' } = {}
) {
  const hasLoadedRef = useRef(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!video) return;
        if (entry.isIntersecting) {
          if (!hasLoadedRef.current) {
            video.load();
            hasLoadedRef.current = true;
          }
          video.play().catch(() => {});
        } else {
          video.pause();
        }
      },
      { threshold, rootMargin }
    );

    observer.observe(video);
    return () => observer.disconnect();
  }, [videoRef, threshold, rootMargin]);
}
