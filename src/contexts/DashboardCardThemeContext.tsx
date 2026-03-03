/**
 * Dashboard card theme — Provider only. Hook and context live in dashboardCardTheme.ts
 * so this file only exports a component (fast refresh).
 */

import { useMemo, type ReactNode } from "react";
import {
  DashboardCardThemeContext,
  type DashboardCardThemeValue,
} from "./dashboardCardTheme";

interface DashboardCardThemeProviderProps {
  cardClass: string;
  subtleClass: string;
  children: ReactNode;
}

export function DashboardCardThemeProvider({
  cardClass,
  subtleClass,
  children,
}: DashboardCardThemeProviderProps) {
  const value: DashboardCardThemeValue = useMemo(
    () => ({ cardClass, subtleClass }),
    [cardClass, subtleClass]
  );
  return (
    <DashboardCardThemeContext.Provider value={value}>
      {children}
    </DashboardCardThemeContext.Provider>
  );
}
