/**
 * Dashboard card theme — context, default value, and hook.
 * Provider component lives in DashboardCardThemeContext.tsx for fast refresh.
 */

import { createContext, useContext } from "react";
import { glass } from "../lib/glass";

export interface DashboardCardThemeValue {
  cardClass: string;
  subtleClass: string;
}

export const defaultDashboardCardTheme: DashboardCardThemeValue = {
  cardClass: glass.card,
  subtleClass: glass.subtle,
};

export const DashboardCardThemeContext =
  createContext<DashboardCardThemeValue>(defaultDashboardCardTheme);

export function useDashboardCardTheme(): DashboardCardThemeValue {
  return useContext(DashboardCardThemeContext);
}
