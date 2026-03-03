# Reference: Mobile, PWA & Accessibility Patterns

## Touch Targets — 44px Minimum Rule

All interactive elements must meet 44×44px minimum tap target size. Field workers use gloves.

```tsx
// Standard input — min-h enforced
<input className="min-h-[44px] px-4 py-3 text-base ..." />

// Standard button — min-h via size system
<Button size="md">  {/* min-h-[40px] — use size="lg" for primary form submit */}

// Icon-only button — needs explicit sizing
<button className="w-11 h-11 flex items-center justify-center rounded-xl ..." aria-label="Delete">
  <Trash2 className="w-4 h-4" />
</button>

// Nav tab (bottom bar) — extra tall
<button className="flex-1 min-h-[56px] flex flex-col items-center justify-center gap-0.5 ..." />
```

---

## Bottom Navigation (Mobile)

```tsx
// Shell — fixed bottom, pb-safe for iPhone home bar
<nav
  className="fixed bottom-0 left-0 right-0 bg-gray-900/95 backdrop-blur-xl border-t border-white/10 pb-safe z-[400] md:hidden"
  aria-label="Main navigation"
>
  <div className="flex items-stretch">
    {navItems.map(item => <NavTab key={item.path} item={item} />)}
  </div>
</nav>

// Page content — offset for bottom nav height + safe area
<main className="pb-[calc(3.5rem+env(safe-area-inset-bottom))] md:pb-0">
  {/* page content */}
</main>
```

---

## Forms on Mobile

```tsx
// ⚠️ CRITICAL: text-base (16px) on all inputs — prevents iOS auto-zoom
<input className="text-base ..." />   // ✅ Never text-sm on inputs

// Prevent scroll jump when keyboard appears
// Don't: <div style={{ height: '100svh', overflow: 'hidden' }}>
// Do:
<div className="min-h-screen overflow-y-auto">

// Fixed bottom submit button (common on long mobile forms)
<div className="
  fixed bottom-0 left-0 right-0
  px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-3
  bg-gray-950/90 backdrop-blur-md border-t border-white/10
  md:static md:border-0 md:bg-transparent md:p-0 md:pb-0
">
  <Button size="lg" className="w-full">
    {isOnline ? 'Submit' : 'Save for Later'}
  </Button>
</div>
```

---

## Responsive Table Patterns

```tsx
// Option 1: Horizontal scroll (always needed — min-w prevents columns crushing)
<div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0">
  <table className="w-full min-w-[640px]">
    ...
  </table>
</div>

// Option 2: Card list on mobile / table on desktop (for simpler data)
<>
  {/* Mobile: card-based list */}
  <div className="space-y-3 md:hidden">
    {data.map(item => (
      <div key={item.id} className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-medium text-white">{item.title}</p>
            <p className="text-xs text-white/60 mt-0.5">{item.subtitle}</p>
          </div>
          <StatusBadge status={item.status} />
        </div>
        <div className="flex items-center gap-2 mt-3">
          <Button size="sm" variant="ghost">View</Button>
        </div>
      </div>
    ))}
  </div>

  {/* Desktop: full table */}
  <div className="hidden md:block">
    <DataTable data={data} columns={columns} />
  </div>
</>
```

---

## Modal → Full-Screen Sheet on Mobile

```tsx
<AnimatePresence>
  {isOpen && (
    <>
      {/* Backdrop */}
      <motion.div
        variants={fadeIn}
        initial="hidden" animate="visible" exit="exit"
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[500]"
        onClick={onClose}
      />

      {/* Panel */}
      <motion.div
        variants={scaleIn}
        initial="hidden" animate="visible" exit="exit"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-heading"
        className="
          fixed inset-0 md:inset-auto
          md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2
          md:w-[520px] md:max-h-[85vh]
          bg-gray-900 md:backdrop-blur-2xl md:bg-white/[0.08]
          md:border md:border-white/15 md:rounded-2xl
          md:shadow-2xl md:shadow-black/40
          overflow-y-auto z-[500]
          pb-[env(safe-area-inset-bottom)] md:pb-0
        "
      >
        {/* Mobile drag handle */}
        <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mt-3 md:hidden" aria-hidden="true" />

        {/* Sticky header */}
        <div className="flex items-center justify-between p-6 border-b border-white/10 sticky top-0 bg-gray-900/95 md:bg-transparent backdrop-blur-md z-10">
          <h2 id="modal-heading" className="text-lg font-semibold text-white">{title}</h2>
          <button onClick={onClose} className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-white/10 text-white/60 hover:text-white transition-colors" aria-label="Close">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">{children}</div>
      </motion.div>
    </>
  )}
</AnimatePresence>
```

---

## Floating Action Button (FAB)

FAB is mobile-only. Hidden on desktop. Positioned above the bottom nav.

```tsx
<motion.button
  variants={scaleIn}
  initial="hidden"
  animate="visible"
  className="
    fixed bottom-[calc(4rem+env(safe-area-inset-bottom))] right-4
    w-14 h-14 rounded-2xl
    bg-blue-600 hover:bg-blue-500 active:bg-blue-700
    shadow-lg shadow-blue-600/30
    flex items-center justify-center
    transition-colors duration-150
    md:hidden
    z-[300]
  "
  aria-label="New inspection"
  onClick={onFabClick}
>
  <Plus className="w-6 h-6 text-white" />
</motion.button>
```

---

## Offline Banner Placement

The offline banner lives inside `DashboardLayout`, before any page content. It is full-width and persistent.

```tsx
// In DashboardLayout.tsx — renders immediately below the nav
{!isOnline && (
  <div
    role="status"
    aria-live="assertive"
    className="bg-gray-800/90 backdrop-blur-md border-b border-gray-700 px-4 py-2.5 flex items-center gap-2"
    style={{ zIndex: Z.offlineBanner }}
  >
    <WifiOff className="w-4 h-4 text-gray-400 flex-shrink-0" aria-hidden="true" />
    <span className="text-sm text-gray-300">
      You're offline — changes will sync when you reconnect
    </span>
    {queueCount > 0 && (
      <span className="ml-auto text-xs text-gray-500 tabular-nums">{queueCount} pending</span>
    )}
  </div>
)}
```

---

## Keyboard Focus Management

```tsx
// Move focus to modal on open — use a ref on the first focusable element
const firstFocusRef = useRef<HTMLButtonElement>(null);

useEffect(() => {
  if (isOpen) {
    // Small delay to allow animation to start
    requestAnimationFrame(() => firstFocusRef.current?.focus());
  }
}, [isOpen]);

// Return focus to trigger on close
const triggerRef = useRef<HTMLButtonElement>(null);
// ... pass triggerRef to the element that opens the modal

// Wizard step change — focus the new step heading
const stepHeadingRef = useRef<HTMLHeadingElement>(null);
useEffect(() => {
  stepHeadingRef.current?.focus();
}, [currentStep]);

// tabIndex={-1} makes non-interactive elements programmatically focusable
<h2 ref={stepHeadingRef} tabIndex={-1} className="focus:outline-none ...">
  Step {currentStep + 1}: {stepTitle}
</h2>
```

---

## PWA Install Prompt

```tsx
// Show only on mobile, only when not already installed as PWA
{isMobileDevice && !isPwaInstalled && showInstallPrompt && (
  <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-4 mb-4 flex items-center gap-3">
    <div className="w-10 h-10 bg-blue-500/20 rounded-xl flex items-center justify-center flex-shrink-0">
      <Smartphone className="w-5 h-5 text-blue-400" />
    </div>
    <div className="flex-1 min-w-0">
      <p className="text-sm font-medium text-white">Install ATTS</p>
      <p className="text-xs text-white/60 mt-0.5">Works offline and loads instantly</p>
    </div>
    <Button size="sm" onClick={handleInstall}>Install</Button>
    <button
      onClick={dismissInstallPrompt}
      className="w-8 h-8 flex items-center justify-center text-white/40 hover:text-white/70 transition-colors"
      aria-label="Dismiss"
    >
      <X className="w-4 h-4" />
    </button>
  </div>
)}
```

---

## Android Back Button (Modal/Drawer Close)

```tsx
// In Modal or Drawer component — handles Android hardware back button
useEffect(() => {
  if (!isOpen) return;

  const handlePopState = () => {
    onClose();
  };

  // Push a history state so the back button has something to pop
  window.history.pushState({ modal: true }, '');
  window.addEventListener('popstate', handlePopState);

  return () => {
    window.removeEventListener('popstate', handlePopState);
    // If modal closes programmatically (not via back button), clean up history
    if (window.history.state?.modal) {
      window.history.back();
    }
  };
}, [isOpen, onClose]);
```

---

## WCAG Contrast Quick Reference

| Combination | Ratio | Status | Notes |
|---|---|---|---|
| `text-white/80` on `bg-gray-900` | ~10:1 | ✅ AAA | Body text standard |
| `text-white/60` on `bg-gray-900` | ~6:1 | ✅ AA | Secondary text |
| `text-white/40` on `bg-gray-900` | ~3:1 | ⚠️ | Captions only |
| `text-amber-400` on `bg-gray-900` | ~5:1 | ✅ AA | Admin role |
| `text-red-400` on `bg-gray-900` | ~4.6:1 | ✅ AA | Safety officer — margin is tight |
| `text-blue-400` on `bg-gray-900` | ~4.8:1 | ✅ AA | Foreman role |
| `text-green-400` on `bg-gray-900` | ~5.2:1 | ✅ AA | Employee role |
| `text-orange-400` on `bg-gray-900` | ~5.5:1 | ✅ AA | Mechanic role |
| `text-purple-300` on `bg-gray-900` | ~6.5:1 | ✅ AA | General foreman role |
| `text-teal-400` on `bg-gray-900` | ~5.5:1 | ✅ AA | Manager role |
| `text-white` on `bg-blue-600` | ~4.5:1 | ✅ AA | Button text on primary |
| `text-white` on `bg-red-600` | ~4.2:1 | ✅ AA | Danger button — don't darken further |

**Rule:** Never place `text-white/40` or dimmer on important content. Only captions and timestamps.
