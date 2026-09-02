import { memo } from "react";
import { FeaturedAnnouncementSection } from "./dashboard/FeaturedAnnouncementSection";

/**
 * Legacy role themes. Retained so call sites keep compiling; every role now
 * renders the single Canopy broadcast slab (role identity lives in the hero,
 * not in the announcement surface).
 */
export type AnnouncementTheme = "emerald" | "bluewhite" | "purple" | "redwhite" | "ember";

interface ThemedAnnouncementCardProps {
  /** Retained for API compatibility. */
  theme?: AnnouncementTheme;
}

/**
 * ThemedAnnouncementCard — Canopy broadcast slab for role dashboards.
 */
function ThemedAnnouncementCardComponent() {
  return <FeaturedAnnouncementSection />;
}

export const ThemedAnnouncementCard = memo<ThemedAnnouncementCardProps>(ThemedAnnouncementCardComponent);
export default ThemedAnnouncementCard;
