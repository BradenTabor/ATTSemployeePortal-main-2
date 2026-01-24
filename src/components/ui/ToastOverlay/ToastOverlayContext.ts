/**
 * Toast Overlay Context
 * 
 * Exported from a separate file to avoid fast refresh warnings.
 * Contains only the context creation, which is a non-component export.
 */

import { createContext } from 'react';
import type { ToastOverlayContextValue } from './types';

export const ToastOverlayContext = createContext<ToastOverlayContextValue | null>(null);
