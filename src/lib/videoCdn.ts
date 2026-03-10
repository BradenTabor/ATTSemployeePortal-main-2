/**
 * Video CDN base URL for bandwidth optimization.
 * Set VITE_VIDEO_CDN_BASE_URL in env to serve videos from an external CDN (e.g. Cloudflare R2)
 * instead of Vercel. When unset, videos are served from same origin (public/videos/).
 */
const VIDEO_CDN_BASE = (import.meta.env.VITE_VIDEO_CDN_BASE_URL as string | undefined)?.trim().replace(/\/$/, "") ?? "";

export function getVideoUrl(path: string): string {
  if (!path.startsWith("/")) return path;
  return VIDEO_CDN_BASE ? `${VIDEO_CDN_BASE}${path}` : path;
}
