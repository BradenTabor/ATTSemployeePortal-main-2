/**
 * PPEAutoSuggest — Suggests common PPE items based on job/context.
 * Can be used in JSA PPE step or other forms; accepts value + onChange for controlled input.
 */

import { useMemo, useState } from "react";
import { HardHat } from "lucide-react";

const COMMON_PPE = [
  "Hard hat",
  "Safety glasses",
  "Hearing protection",
  "Gloves",
  "High-vis vest",
  "Steel-toe boots",
  "Chaps (chainsaw)",
  "Face shield",
  "Respirator",
];

export interface PPEAutoSuggestProps {
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  className?: string;
  "aria-label"?: string;
}

export default function PPEAutoSuggest({
  value = "",
  onChange,
  placeholder = "Search or add PPE…",
  className = "",
  "aria-label": ariaLabel = "PPE item",
}: PPEAutoSuggestProps) {
  const [open, setOpen] = useState(false);
  const filtered = useMemo(() => {
    const v = value.trim().toLowerCase();
    if (!v) return COMMON_PPE;
    return COMMON_PPE.filter((item) => item.toLowerCase().includes(v));
  }, [value]);

  return (
    <div className={`relative ${className}`}>
      <div className="flex rounded-lg border border-white/10 bg-white/5 overflow-hidden focus-within:ring-2 focus-within:ring-emerald-400/50">
        <span className="flex items-center pl-3 text-white/50" aria-hidden>
          <HardHat className="w-4 h-4" />
        </span>
        <input
          type="text"
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder={placeholder}
          aria-label={ariaLabel}
          aria-autocomplete="list"
          aria-expanded={open && filtered.length > 0}
          role="combobox"
          className="flex-1 min-w-0 bg-transparent px-3 py-2 text-white placeholder:text-white/40 text-sm focus:outline-none"
        />
      </div>
      {open && filtered.length > 0 && (
        <ul
          className="absolute z-10 mt-1 w-full rounded-lg border border-white/10 bg-gray-900 py-1 shadow-lg max-h-48 overflow-y-auto"
          role="listbox"
        >
          {filtered.map((item) => (
            <li
              key={item}
              role="option"
              className="px-3 py-2 text-sm text-white/90 hover:bg-white/10 cursor-pointer"
              onMouseDown={() => {
                onChange?.(item);
                setOpen(false);
              }}
            >
              {item}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
