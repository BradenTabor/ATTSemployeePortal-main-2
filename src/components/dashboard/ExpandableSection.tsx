import { useState, useEffect, useCallback, ReactNode, memo, cloneElement, isValidElement, useRef } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '../../lib/utils';
import { canopy } from '../../lib/glass';
import { getPersistedBool, setPersistedBool } from '../../lib/persistence';
import {
  getDeviceCapabilities,
  getQualitySettings,
  perfMark,
  perfMeasure,
  withWillChange,
} from '../../lib/mobilePerf';

// ============================================================================
// THEME
// ============================================================================

export type ExpandableSectionTheme = 'emerald' | 'blue';

interface ThemeConfig {
  eyebrow: string;
  accentWord: string;
  chevron: string;
  chevronOpen: string;
  vein: string;
  focusRing: string;
}

const themeConfig: Record<ExpandableSectionTheme, ThemeConfig> = {
  emerald: {
    eyebrow: 'text-verdant-300',
    accentWord: 'text-verdant-300',
    chevron: 'border-bone-50/[0.12] bg-ink-900 text-bone-300',
    chevronOpen: 'border-verdant-400/50 bg-verdant-500/15 text-verdant-200',
    vein: 'bg-[linear-gradient(90deg,transparent,#3DDC84,transparent)]',
    focusRing: 'focus-visible:ring-verdant-400/70',
  },
  blue: {
    eyebrow: 'text-glacier-300',
    accentWord: 'text-glacier-300',
    chevron: 'border-bone-50/[0.12] bg-ink-900 text-bone-300',
    chevronOpen: 'border-glacier-400/50 bg-glacier-500/15 text-glacier-200',
    vein: 'bg-[linear-gradient(90deg,transparent,#5EE898,transparent)]',
    focusRing: 'focus-visible:ring-glacier-400/70',
  },
};

// Props that will be passed to icon components (like DashboardAvatar)
export interface IconInteractionProps {
  /** Whether the section is currently expanded */
  isExpanded?: boolean;
  /** Whether the section header is being hovered */
  isHovered?: boolean;
  /** Triggers when section was just toggled - resets after animation */
  wasJustToggled?: boolean;
  /** Direction of the last toggle: 'expand' or 'collapse' */
  toggleDirection?: 'expand' | 'collapse' | null;
}

interface ExpandableSectionProps {
  /** Unique ID for ARIA attributes */
  id: string;
  /** Section heading */
  title: string;
  /** Optional subtitle/description */
  subtitle?: string;
  /** localStorage key for persistence */
  storageKey?: string;
  /** Initial open state (used if no persisted state) */
  defaultOpen?: boolean;
  /** Section content */
  children: ReactNode;
  /** Additional container classes */
  className?: string;
  /** Optional icon to display next to title */
  icon?: ReactNode;
  /** Header action button/element (e.g., "View all" link) */
  headerAction?: ReactNode;
  /** Accessible label for the toggle button (provides additional context for screen readers) */
  ariaLabel?: string;
  /** Color theme - defaults to emerald */
  theme?: ExpandableSectionTheme;
  /** Kept for API compatibility — the Canopy slot never draws its own chrome. */
  transparentIconContainer?: boolean;
  /** Optional two-digit index rendered as the instrument counter. */
  index?: number | string;
}

/**
 * ExpandableSection — Canopy instrument slab with a collapsible body.
 *
 * Performance notes:
 * - CSS grid-template-rows drives the height animation (GPU friendly, no measurement)
 * - Respects prefers-reduced-motion
 * - will-change only during the transition
 */
function ExpandableSectionComponent({
  id,
  title,
  subtitle,
  storageKey,
  defaultOpen = true,
  children,
  className,
  icon,
  headerAction,
  ariaLabel,
  theme = 'emerald',
  index,
}: ExpandableSectionProps) {
  const themeStyles = themeConfig[theme];

  const [isOpen, setIsOpen] = useState(() => {
    if (storageKey) return getPersistedBool(storageKey, defaultOpen);
    return defaultOpen;
  });

  const [isHovered, setIsHovered] = useState(false);
  const [wasJustToggled, setWasJustToggled] = useState(false);
  const [toggleDirection, setToggleDirection] = useState<'expand' | 'collapse' | null>(null);
  const toggleTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  const caps = getDeviceCapabilities();
  const quality = getQualitySettings();

  useEffect(() => {
    return () => {
      if (toggleTimeoutRef.current) clearTimeout(toggleTimeoutRef.current);
    };
  }, []);

  const toggle = useCallback(() => {
    perfMark(`expand-section-${id}`);
    setIsOpen((prev) => {
      const newValue = !prev;
      if (storageKey) setPersistedBool(storageKey, newValue);
      setToggleDirection(newValue ? 'expand' : 'collapse');
      setWasJustToggled(true);
      if (quality.enableAnimations) {
        withWillChange(contentRef.current, 'grid-template-rows, opacity', 450);
      }
      if (toggleTimeoutRef.current) clearTimeout(toggleTimeoutRef.current);
      const animDuration = quality.enableAnimations ? 500 : 0;
      toggleTimeoutRef.current = setTimeout(() => {
        setWasJustToggled(false);
        setToggleDirection(null);
        perfMeasure(`expand-section-${id}`);
      }, animDuration);
      return newValue;
    });
  }, [storageKey, id, quality.enableAnimations]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        toggle();
      }
    },
    [toggle]
  );

  const handleMouseEnter = useCallback(() => {
    if (!caps.isMobile) setIsHovered(true);
  }, [caps.isMobile]);
  const handleMouseLeave = useCallback(() => setIsHovered(false), []);

  const toggleId = `${id}-toggle`;
  const contentId = `${id}-content`;

  const enhancedIcon = icon && isValidElement(icon)
    ? cloneElement(icon as React.ReactElement<IconInteractionProps>, {
        isExpanded: isOpen,
        isHovered,
        wasJustToggled,
        toggleDirection,
      })
    : icon;

  const shouldAnimate = quality.enableAnimations && !caps.prefersReducedMotion;

  const gridStyle: React.CSSProperties = shouldAnimate
    ? {
        display: 'grid',
        gridTemplateRows: isOpen ? '1fr' : '0fr',
        transition: 'grid-template-rows 450ms cubic-bezier(0.16, 1, 0.3, 1)',
      }
    : { display: isOpen ? 'block' : 'none' };

  const words = title.split(' ');

  return (
    <section
      className={cn(canopy.instrument, 'contain-layout', className)}
      style={{ contain: 'layout style' }}
      data-expanded={isOpen ? 'true' : 'false'}
    >
      {/* Header */}
      <div className="relative px-4 py-4 sm:px-6 sm:py-5">
        <div className="flex items-center justify-between gap-3">
          <button
            id={toggleId}
            type="button"
            onClick={toggle}
            onKeyDown={handleKeyDown}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            aria-expanded={isOpen ? 'true' : 'false'}
            aria-controls={contentId}
            aria-label={ariaLabel}
            className={cn(
              'group -m-2 flex min-h-[44px] flex-1 items-center gap-3.5 rounded-leaf-xs p-2 text-left',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-ink-950',
              themeStyles.focusRing
            )}
          >
            {enhancedIcon && (
              <span
                className={cn(
                  'relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-leaf-xs border border-bone-50/[0.1] bg-ink-950/70 sm:h-14 sm:w-14',
                  '[&_img]:h-full [&_img]:w-full [&_img]:object-contain [&_img]:transform-none',
                  shouldAnimate && !caps.isMobile && 'transition-transform duration-500 ease-canopy group-hover:-rotate-3'
                )}
              >
                {enhancedIcon}
              </span>
            )}

            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2.5">
                {index !== undefined && (
                  <span className={cn('type-instrument tabular-nums opacity-70', themeStyles.eyebrow)}>
                    {String(index).padStart(2, '0')}
                  </span>
                )}
                <span className="type-display truncate text-[1.35rem] font-light leading-none text-bone-50 sm:text-2xl">
                  {words.map((w, i) => (
                    <span key={`${w}-${i}`} className={i === words.length - 1 && words.length > 1 ? `italic ${themeStyles.accentWord}` : ''}>
                      {w}
                      {i < words.length - 1 && '\u00A0'}
                    </span>
                  ))}
                </span>
              </span>
              {subtitle && (
                <span className="mt-1.5 block truncate font-mono text-[10px] uppercase tracking-[0.18em] text-bone-400">
                  {subtitle}
                </span>
              )}
            </span>

            <span
              className={cn(
                'flex h-9 w-9 shrink-0 items-center justify-center rounded-leaf-xs border transition-[background-color,border-color,color] duration-500 ease-canopy',
                isOpen ? themeStyles.chevronOpen : themeStyles.chevron
              )}
            >
              <ChevronDown
                className="h-4 w-4"
                aria-hidden="true"
                style={{
                  transform: `rotate(${isOpen ? 180 : 0}deg)`,
                  transition: shouldAnimate ? 'transform 500ms cubic-bezier(0.16, 1, 0.3, 1)' : 'none',
                }}
              />
            </span>
          </button>

          {headerAction && <div className="ml-1 shrink-0">{headerAction}</div>}
        </div>

        {/* Hairline that draws when open */}
        <span
          aria-hidden
          className={cn(
            'pointer-events-none absolute inset-x-4 bottom-0 h-px origin-left transition-transform duration-700 ease-canopy sm:inset-x-6',
            themeStyles.vein,
            isOpen ? 'scale-x-100' : 'scale-x-0'
          )}
        />
      </div>

      {/* Collapsible content */}
      <div ref={contentRef} id={contentId} role="region" aria-labelledby={toggleId} style={gridStyle}>
        <div className="overflow-hidden">
          <div className={cn(shouldAnimate && 'transition-opacity duration-300', isOpen ? 'opacity-100' : 'opacity-0')}>
            <div className="px-4 pb-4 pt-4 sm:px-6 sm:pb-6">{children}</div>
          </div>
        </div>
      </div>
    </section>
  );
}

export const ExpandableSection = memo(ExpandableSectionComponent);
export default ExpandableSection;
