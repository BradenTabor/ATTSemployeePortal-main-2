/**
 * Dashboard Components Index
 * 
 * Central export point for all dashboard-related components.
 */

// Core components
export { DashboardAvatar } from './DashboardAvatar';
export { ExpandableSection } from './ExpandableSection';
export type { ExpandableSectionTheme } from './ExpandableSection';
export { CollapsibleSection } from './CollapsibleSection';

// Status cards
export { TodayComplianceStatus } from './TodayComplianceStatus';
export { RewardPointsCard } from './RewardPointsCard';
export { EnhancedRewardsCard } from './EnhancedRewardsCard';
export { MissionControlCard } from './MissionControlCard';
export { ComplianceHeroGrid } from './ComplianceHeroGrid';
export { CompactComplianceStrip } from './CompactComplianceStrip';

// Layout & Grid
export { 
  DashboardGrid, 
  DashboardSection, 
  DashboardCard, 
  HorizontalScroll, 
  StackedLayout 
} from './DashboardGrid';
export type { DashboardCardTheme } from './DashboardGrid';

// Navigation & Actions
export { QuickActionsBar } from './QuickActionsBar';
export { QuickLinksRow } from './QuickLinksRow';
export { FloatingActionButton } from './FloatingActionButton';
export { PinnedFavorites, usePinnedFavorites } from './PinnedFavorites';
export type { PinnedFavoritesTheme } from './PinnedFavorites';

// Header & Profile
export { WelcomeHeader } from './WelcomeHeader';
export type { WelcomeHeaderTheme } from './WelcomeHeader';
export { AvatarDropdownPortal } from './AvatarDropdownPortal';
export type { AvatarTheme } from './AvatarDropdownPortal';

// Mobile features
export { PullToRefresh } from './PullToRefresh';

// Featured content
export { FeaturedAnnouncementSection } from './FeaturedAnnouncementSection';

// Skeletons
export {
  WelcomeHeaderSkeleton,
  MissionControlSkeleton,
  QuickActionsSkeleton,
  EnhancedJobCardSkeleton,
  JobsSectionSkeleton,
  EnhancedAnnouncementSkeleton,
  EnhancedNavCardsSkeleton,
} from './EnhancedSkeletons';

// Empty states
export {
  EnhancedEmptyJobsState,
  AllFormsCompleteState,
  NoRewardsState,
  WeekendModeState,
  EmptyAnnouncementsState,
  LoadingErrorState,
} from './EnhancedEmptyStates';
