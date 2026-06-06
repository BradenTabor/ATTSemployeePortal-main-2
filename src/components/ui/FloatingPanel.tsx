import React, {
  useEffect,
  useRef,
} from "react"
import { ArrowLeftIcon } from "lucide-react"
import { AnimatePresence, motion, MotionConfig, Variants } from "framer-motion"

import { cn } from "../../lib/utils"
import {
  FloatingPanelContext,
  useFloatingPanel,
  useFloatingPanelLogic,
} from "./useFloatingPanel"

const TRANSITION = {
  type: "spring" as const,
  bounce: 0.1,
  duration: 0.4,
}

interface FloatingPanelRootProps {
  children: React.ReactNode
  className?: string
  style?: React.CSSProperties
}

export function FloatingPanelRoot({
  children,
  className,
  style,
}: FloatingPanelRootProps) {
  const floatingPanelLogic = useFloatingPanelLogic()

  // Check if className contains fixed positioning to avoid conflict with relative
  const hasFixedPosition = className?.includes('fixed')

  return (
    <FloatingPanelContext.Provider value={floatingPanelLogic}>
      <MotionConfig transition={TRANSITION}>
        <div 
          className={cn(!hasFixedPosition && "relative", className)} 
          style={style}
        >
          {children}
        </div>
      </MotionConfig>
    </FloatingPanelContext.Provider>
  )
}

interface FloatingPanelTriggerProps {
  children: React.ReactNode
  className?: string
  title: string
}

export function FloatingPanelTrigger({
  children,
  className,
  title,
}: FloatingPanelTriggerProps) {
  const { openFloatingPanel, uniqueId, setTitle } = useFloatingPanel()
  const triggerRef = useRef<HTMLButtonElement>(null)

  const handleClick = () => {
    if (triggerRef.current) {
      openFloatingPanel(triggerRef.current.getBoundingClientRect())
      setTitle(title)
    }
  }

  return (
    <motion.button
      ref={triggerRef}
      layoutId={`floating-panel-trigger-${uniqueId}`}
      className={cn(
        "flex h-9 items-center border border-emerald-500/30 bg-[#041812] px-3 text-emerald-100",
        className
      )}
      style={{ borderRadius: 8 }}
      onClick={handleClick}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      aria-haspopup="dialog"
      aria-expanded="false"
    >
      <motion.div
        layoutId={`floating-panel-label-container-${uniqueId}`}
        className="flex items-center"
      >
        <motion.span
          layoutId={`floating-panel-label-${uniqueId}`}
          className="text-sm font-semibold"
        >
          {children}
        </motion.span>
      </motion.div>
    </motion.button>
  )
}

interface FloatingPanelContentProps {
  children: React.ReactNode
  className?: string
}

export function FloatingPanelContent({
  children,
  className,
}: FloatingPanelContentProps) {
  const { isOpen, closeFloatingPanel, uniqueId, triggerRect, title } =
    useFloatingPanel()
  const contentRef = useRef<HTMLDivElement>(null)

  // Lock body scroll when panel is open
  useEffect(() => {
    if (isOpen) {
      // Store original overflow style
      const originalOverflow = document.body.style.overflow
      const originalPaddingRight = document.body.style.paddingRight
      
      // Calculate scrollbar width to prevent layout shift
      const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth
      
      // Lock scroll
      document.body.style.overflow = 'hidden'
      if (scrollbarWidth > 0) {
        document.body.style.paddingRight = `${scrollbarWidth}px`
      }
      
      return () => {
        // Restore original styles
        document.body.style.overflow = originalOverflow
        document.body.style.paddingRight = originalPaddingRight
      }
    }
  }, [isOpen])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        contentRef.current &&
        !contentRef.current.contains(event.target as Node)
      ) {
        closeFloatingPanel()
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [closeFloatingPanel])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeFloatingPanel()
    }
    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [closeFloatingPanel])

  // Calculate panel position - opens upward from bottom-left FAB
  // Accounts for iOS safe-area-insets (notch/home indicator)
  const getPanelPosition = () => {
    if (!triggerRect) {
      return { left: 16, bottom: 16 }
    }
    
    const panelWidth = 340
    const panelHeight = 400 // approximate max height
    const padding = 16
    
    // Get safe area inset if available (for iOS devices with notch/home indicator)
    // Note: This is computed at render time; CSS env() handles the actual value
    const safeAreaBottom = parseInt(
      getComputedStyle(document.documentElement)
        .getPropertyValue('--safe-area-inset-bottom') || '0'
    ) || 0
    
    // Position panel above the trigger, aligned to the left
    let left = triggerRect.left
    // Add safe area inset to ensure panel clears the home indicator
    let bottom = window.innerHeight - triggerRect.top + 12 + safeAreaBottom // 12px gap above trigger
    
    // Ensure panel doesn't overflow right edge
    if (left + panelWidth > window.innerWidth - padding) {
      left = window.innerWidth - panelWidth - padding
    }
    
    // Ensure panel doesn't overflow top
    if (bottom + panelHeight > window.innerHeight - padding) {
      bottom = window.innerHeight - panelHeight - padding
    }
    
    return { left, bottom }
  }

  const variants: Variants = {
    hidden: { opacity: 0, scale: 0.9, y: 20 },
    visible: { opacity: 1, scale: 1, y: 0 },
  }

  const position = getPanelPosition()

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop with blur - prevents touch scroll propagation */}
          <motion.div
            initial={{ opacity: 0, backdropFilter: "blur(0px)" }}
            animate={{ opacity: 1, backdropFilter: "blur(8px)" }}
            exit={{ opacity: 0, backdropFilter: "blur(0px)" }}
            className="fixed inset-0 z-[9998] bg-black/40 touch-none"
            onTouchMove={(e) => e.preventDefault()}
          />
          {/* Panel */}
          <motion.div
            ref={contentRef}
            layoutId={`floating-panel-${uniqueId}`}
            className={cn(
              "fixed z-[9999] overflow-hidden max-h-[80vh] flex flex-col",
              // Premium glass morphism with emerald theme
              "bg-gradient-to-br from-[#04150f]/98 via-[#041812]/95 to-[#03120c]/98",
              "border border-emerald-500",
              "shadow-[0_0_25px_4px_rgba(245,244,244,0.35),0_0_60px_-12px_rgba(16,185,129,0.4)]",
              "backdrop-blur-xl",
              // Ensure panel content can be scrolled
              "overscroll-contain",
              className
            )}
            style={{
              borderRadius: 16,
              left: position.left,
              bottom: position.bottom,
              transformOrigin: "bottom left",
            }}
            initial="hidden"
            animate="visible"
            exit="hidden"
            variants={variants}
            role="dialog"
            aria-modal="true"
            aria-labelledby={`floating-panel-title-${uniqueId}`}
          >
            {/* Inner glow accent */}
            <div className="absolute inset-0 rounded-[16px] bg-gradient-to-b from-emerald-500/10 via-transparent to-transparent pointer-events-none" />
            
            <FloatingPanelTitle>{title}</FloatingPanelTitle>
            {children}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

interface FloatingPanelTitleProps {
  children: React.ReactNode
}

function FloatingPanelTitle({ children }: FloatingPanelTitleProps) {
  const { uniqueId } = useFloatingPanel()

  return (
    <motion.div
      layoutId={`floating-panel-label-container-${uniqueId}`}
      className="px-5 py-4 border-b border-emerald-500/20 bg-gradient-to-r from-emerald-500/5 to-transparent shadow-[0_0_25px_4px_rgba(15,15,15,0.35)]"
    >
      <motion.div
        layoutId={`floating-panel-label-${uniqueId}`}
        className="text-base font-bold bg-gradient-to-r from-white via-emerald-100 to-white/80 bg-clip-text text-transparent"
        id={`floating-panel-title-${uniqueId}`}
      >
        {children}
      </motion.div>
    </motion.div>
  )
}

interface FloatingPanelFormProps {
  children: React.ReactNode
  onSubmit?: (note: string) => void
  className?: string
}

export function FloatingPanelForm({
  children,
  onSubmit,
  className,
}: FloatingPanelFormProps) {
  const { note, closeFloatingPanel } = useFloatingPanel()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit?.(note)
    closeFloatingPanel()
  }

  return (
    <form
      className={cn("flex h-full flex-col", className)}
      onSubmit={handleSubmit}
    >
      {children}
    </form>
  )
}

interface FloatingPanelLabelProps {
  children: React.ReactNode
  htmlFor: string
  className?: string
}

export function FloatingPanelLabel({
  children,
  htmlFor,
  className,
}: FloatingPanelLabelProps) {
  const { note } = useFloatingPanel()

  return (
    <motion.label
      htmlFor={htmlFor}
      style={{ opacity: note ? 0 : 1 }}
      className={cn(
        "block mb-2 text-sm font-medium text-emerald-100",
        className
      )}
    >
      {children}
    </motion.label>
  )
}

interface FloatingPanelTextareaProps {
  className?: string
  id?: string
}

export function FloatingPanelTextarea({
  className,
  id,
}: FloatingPanelTextareaProps) {
  const { note, setNote } = useFloatingPanel()

  return (
    <textarea
      id={id}
      className={cn(
        "h-full w-full resize-none rounded-md bg-transparent px-4 py-3 text-sm text-white outline-none placeholder:text-emerald-200/40",
        className
      )}
      autoFocus
      value={note}
      onChange={(e) => setNote(e.target.value)}
      aria-label="Note input"
      placeholder="Enter your note..."
    />
  )
}

interface FloatingPanelHeaderProps {
  children: React.ReactNode
  className?: string
}

export function FloatingPanelHeader({
  children,
  className,
}: FloatingPanelHeaderProps) {
  return (
    <motion.div
      className={cn(
        "px-5 py-3 font-semibold text-emerald-100",
        className
      )}
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
    >
      {children}
    </motion.div>
  )
}

interface FloatingPanelBodyProps {
  children: React.ReactNode
  className?: string
}

export function FloatingPanelBody({
  children,
  className,
}: FloatingPanelBodyProps) {
  return (
    <motion.div
      className={cn(
        "p-4 overflow-y-auto overscroll-contain",
        // Custom scrollbar styling for the emerald theme
        "scrollbar-thin scrollbar-track-transparent scrollbar-thumb-emerald-500/30 hover:scrollbar-thumb-emerald-500/50",
        className
      )}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
    >
      {children}
    </motion.div>
  )
}

interface FloatingPanelFooterProps {
  children: React.ReactNode
  className?: string
}

export function FloatingPanelFooter({
  children,
  className,
}: FloatingPanelFooterProps) {
  return (
    <motion.div
      className={cn(
        "flex justify-between px-5 py-4 border-t border-emerald-500/20",
        // Add safe area padding for iOS home indicator
        "pb-[max(1rem,env(safe-area-inset-bottom,0px))]",
        className
      )}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
    >
      {children}
    </motion.div>
  )
}

interface FloatingPanelCloseButtonProps {
  className?: string
}

export function FloatingPanelCloseButton({
  className,
}: FloatingPanelCloseButtonProps) {
  const { closeFloatingPanel } = useFloatingPanel()

  return (
    <motion.button
      type="button"
      className={cn(
        "flex items-center gap-2 px-3 py-1.5 rounded-lg",
        "text-emerald-200/80 hover:text-emerald-100",
        "bg-emerald-500/10 hover:bg-emerald-500/20",
        "border border-emerald-500/20 hover:border-emerald-500/40",
        "transition-colors",
        className
      )}
      onClick={closeFloatingPanel}
      aria-label="Close floating panel"
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
    >
      <ArrowLeftIcon size={14} className="text-emerald-300" />
      <span className="text-xs font-medium hover:scale-[1.02]">Close</span>
    </motion.button>
  )
}

interface FloatingPanelSubmitButtonProps {
  className?: string
}

export function FloatingPanelSubmitButton({
  className,
}: FloatingPanelSubmitButtonProps) {
  return (
    <motion.button
      className={cn(
        "relative ml-1 flex h-8 shrink-0 select-none items-center justify-center rounded-lg",
        "border border-emerald-500/30 bg-emerald-500/20 px-3",
        "text-sm text-emerald-100 font-medium",
        "transition-colors hover:bg-emerald-500/30 hover:border-emerald-400/50",
        "focus-visible:ring-2 focus-visible:ring-emerald-400/50",
        className
      )}
      type="submit"
      aria-label="Submit note"
      whileTap={{ scale: 0.98 }}
    >
      Submit
    </motion.button>
  )
}

interface FloatingPanelButtonProps {
  children: React.ReactNode
  onClick?: () => void
  className?: string
}

export function FloatingPanelButton({
  children,
  onClick,
  className,
}: FloatingPanelButtonProps) {
  return (
    <motion.button
      className={cn(
        "flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left",
        "text-sm text-white/90 font-medium",
        "bg-emerald-500/5 hover:bg-emerald-500/15",
        "border border-transparent hover:border-emerald-500/30",
        "transition-all duration-200",
        className
      )}
      onClick={onClick}
      whileHover={{ x: 4 }}
      whileTap={{ scale: 0.98 }}
    >
      {children}
    </motion.button>
  )
}

// Named exports
export {
  FloatingPanelRoot as Root,
  FloatingPanelTrigger as Trigger,
  FloatingPanelContent as Content,
  FloatingPanelForm as Form,
  FloatingPanelLabel as Label,
  FloatingPanelTextarea as Textarea,
  FloatingPanelHeader as Header,
  FloatingPanelBody as Body,
  FloatingPanelFooter as Footer,
  FloatingPanelCloseButton as CloseButton,
  FloatingPanelSubmitButton as SubmitButton,
  FloatingPanelButton as Button,
}

