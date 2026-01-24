/**
 * useToastOverlay Hook
 * 
 * Custom hook to access the toast overlay context.
 * Exported from a separate file to avoid fast refresh warnings.
 */

import { useContext } from 'react';
import { ToastOverlayContext } from './ToastOverlayContext';
import type { ToastOverlayContextValue } from './types';

export function useToastOverlay(): ToastOverlayContextValue {
  const context = useContext(ToastOverlayContext);
  if (!context) {
    throw new Error('useToastOverlay must be used within a ToastOverlayProvider');
  }
  return context;
}
