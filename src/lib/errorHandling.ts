/**
 * Error Handling Utilities
 * 
 * Provides standardized error parsing and user-friendly message conversion
 * for Supabase errors and other API errors.
 */

import { logger } from './logger';

export type ErrorCode = 'VALIDATION_FAILED' | 'NETWORK_ERROR' | 'SERVER_ERROR' | 'AUTH_ERROR' | 'RLS_VIOLATION';

export interface ParsedError {
  message: string;
  details?: string;
  code: ErrorCode;
  isTimeout: boolean;
  userMessage: string;
}

interface SupabaseErrorLike {
  message?: string;
  details?: string;
  hint?: string;
  code?: string;
}

/**
 * Parses an error and converts it to a user-friendly format
 * 
 * @param error - The error to parse (can be Error, Supabase error, or unknown)
 * @param formType - Optional form type for telemetry (e.g., 'jsa', 'dvir', 'equipment')
 * @returns Parsed error with user-friendly message
 */
export function parseFormError(
  error: unknown,
  formType?: string
): ParsedError {
  let errorMessage = 'An unexpected error occurred';
  let errorDetails: string | undefined;
  let errorCode: ErrorCode = 'SERVER_ERROR';
  let isTimeout = false;

  // Handle Error instances
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    
    // Check for timeout patterns
    if (msg.includes('timeout') || msg.includes('deadline exceeded') || msg.includes('network')) {
      isTimeout = true;
      errorMessage = 'Request timed out';
      errorDetails = 'The request took too long. Please check your connection and try again.';
      errorCode = 'NETWORK_ERROR';
    } else {
      errorMessage = error.message;
      
      // Infer error code from message
      if (msg.includes('network') || msg.includes('fetch')) {
        errorCode = 'NETWORK_ERROR';
      } else if (msg.includes('auth') || msg.includes('unauthorized') || msg.includes('forbidden')) {
        errorCode = 'AUTH_ERROR';
      } else if (msg.includes('validation') || msg.includes('invalid')) {
        errorCode = 'VALIDATION_FAILED';
      } else if (msg.includes('rls') || msg.includes('permission') || msg.includes('policy')) {
        errorCode = 'RLS_VIOLATION';
      }
    }
  }
  // Handle Supabase error objects
  else if (error && typeof error === 'object' && 'message' in error) {
    const supabaseError = error as SupabaseErrorLike;
    
    if (supabaseError.message) {
      const msg = supabaseError.message.toLowerCase();
      
      // Check for timeout in Supabase errors
      if (msg.includes('timeout') || msg.includes('deadline exceeded')) {
        isTimeout = true;
        errorMessage = 'Request timed out';
        errorDetails = 'The database request took too long. Please try again.';
        errorCode = 'NETWORK_ERROR';
      } else {
        errorMessage = supabaseError.message;
      }
    }
    
    if (!isTimeout && supabaseError.details) {
      errorDetails = typeof supabaseError.details === 'string'
        ? supabaseError.details
        : JSON.stringify(supabaseError.details);
    }
    
    if (!isTimeout && supabaseError.hint) {
      errorDetails = errorDetails
        ? `${errorDetails}. Hint: ${supabaseError.hint}`
        : `Hint: ${supabaseError.hint}`;
    }
    
    if (!isTimeout && supabaseError.code) {
      // Map Supabase error codes to our error codes
      const code = supabaseError.code.toUpperCase();
      if (code.includes('TIMEOUT') || code.includes('NETWORK')) {
        errorCode = 'NETWORK_ERROR';
      } else if (code.includes('AUTH') || code.includes('UNAUTHORIZED') || code.includes('FORBIDDEN')) {
        errorCode = 'AUTH_ERROR';
      } else if (code.includes('VALIDATION') || code.includes('INVALID')) {
        errorCode = 'VALIDATION_FAILED';
      } else if (code.includes('RLS') || code.includes('PERMISSION') || code.includes('POLICY')) {
        errorCode = 'RLS_VIOLATION';
      }
    }
  }
  // Handle other error types
  else if (error) {
    try {
      errorMessage = JSON.stringify(error);
    } catch {
      errorMessage = String(error);
    }
  }

  // Build user-friendly message
  const userMessage = isTimeout
    ? errorDetails || errorMessage
    : errorDetails
      ? `${errorMessage}${errorDetails ? ` (${errorDetails})` : ''}`
      : errorMessage;

  // Log error for debugging
  if (formType) {
    logger.error(`[${formType.toUpperCase()}] Submission failed`, {
      error,
      errorMessage,
      errorDetails,
      errorCode,
      isTimeout,
    });
  }

  return {
    message: errorMessage,
    details: errorDetails,
    code: errorCode,
    isTimeout,
    userMessage,
  };
}

/**
 * Gets a toast title based on error type
 */
export function getErrorToastTitle(isTimeout: boolean, code: ErrorCode): string {
  if (isTimeout) {
    return 'Connection Timeout';
  }
  
  switch (code) {
    case 'NETWORK_ERROR':
      return 'Network Error';
    case 'AUTH_ERROR':
      return 'Authentication Error';
    case 'VALIDATION_FAILED':
      return 'Validation Error';
    case 'RLS_VIOLATION':
      return 'Permission Denied';
    default:
      return 'Submission Failed';
  }
}
