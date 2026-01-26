import { useNavigate } from "react-router-dom";
import { HardHat, TreeDeciduous, X } from "lucide-react";

interface JsaTypePickerProps {
  open: boolean;
  onClose: () => void;
}

const OPTIONS = [
  {
    id: "daily",
    title: "Daily JSA",
    description: "Standard job safety analysis for general operations.",
    icon: HardHat,
    to: "/forms/jsa",
  },
  {
    id: "tree-felling",
    title: "Tree Felling JSA",
    description: "Specialized JSA for tree felling and removal work.",
    icon: TreeDeciduous,
    to: "/forms/jsa/tree-felling",
  },
] as const;

export function JsaTypePicker({ open, onClose }: JsaTypePickerProps) {
  const navigate = useNavigate();

  if (!open) return null;

  const handleSelect = (to: string) => {
    onClose();
    navigate(to);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="jsa-picker-title"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-md rounded-xl border border-white/10 bg-neutral-900 p-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 id="jsa-picker-title" className="text-base font-semibold text-white">
            Choose JSA type
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/50 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-900"
            aria-label="Close JSA type picker"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>
        <div className="space-y-2">
          {OPTIONS.map((opt) => {
            const Icon = opt.icon;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => handleSelect(opt.to)}
                className="flex w-full items-center gap-3 rounded-lg border border-white/10 bg-white/5 p-3 text-left transition hover:bg-white/10 hover:border-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/50 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-900"
                aria-label={`Open ${opt.title}: ${opt.description}`}
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-500/20" aria-hidden>
                  <Icon className="h-5 w-5 text-emerald-400" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-white">{opt.title}</p>
                  <p className="text-xs text-gray-400">{opt.description}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
