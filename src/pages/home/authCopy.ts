import type { LucideIcon } from "lucide-react";
import { ShieldCheck, TreePine, Lock } from "lucide-react";

export type AuthMode = "login" | "signup";

interface HeroCopy {
  title: string;
  subtitle: string;
}

/** Mode-aware headline shown in the brand panel (and above the card on mobile). */
export const AUTH_HERO: Record<AuthMode, HeroCopy> = {
  login: {
    title: "Welcome back",
    subtitle: "Sign in to reach your dashboard and stay connected with your crew.",
  },
  signup: {
    title: "Join the crew",
    subtitle: "Create your portal identity to get started in the field.",
  },
};

/** One-line value proposition under the wordmark on desktop. */
export const AUTH_VALUE_PROP =
  "The field operations portal for All Terrain Tree Service.";

export interface TrustSignal {
  icon: LucideIcon;
  label: string;
}

/** Credibility markers shown on the desktop brand panel only. */
export const AUTH_TRUST_SIGNALS: TrustSignal[] = [
  { icon: ShieldCheck, label: "Safety-first OSHA & ANSI workflows" },
  { icon: TreePine, label: "Built for tree & utility crews" },
  { icon: Lock, label: "Encrypted, role-based access" },
];

export const LICENSE_CLASS_OPTIONS = [
  { label: "Class A (CDL)", value: "Class A" },
  { label: "Class B (CDL)", value: "Class B" },
  { label: "Class C", value: "Class C" },
  { label: "Class D", value: "Class D" },
  { label: "Non-CDL / Chauffeur", value: "Non-CDL" },
  { label: "Other / Specialized", value: "Other" },
] as const;
