/**
 * VoiceInputButton Component
 * 
 * Provides voice-to-text input functionality using the Web Speech API.
 * Includes graceful degradation for unsupported browsers (renders nothing).
 * 
 * @see directives/smart_form_defaults.md
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { Mic, MicOff, Loader2 } from 'lucide-react';
import { toast } from '../../lib/toast';

// Web Speech API types for browser compatibility
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message: string;
}

interface SpeechRecognitionInstance extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  onstart: ((this: SpeechRecognitionInstance, ev: Event) => void) | null;
  onresult: ((this: SpeechRecognitionInstance, ev: SpeechRecognitionEvent) => void) | null;
  onerror: ((this: SpeechRecognitionInstance, ev: SpeechRecognitionErrorEvent) => void) | null;
  onend: ((this: SpeechRecognitionInstance, ev: Event) => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

interface SpeechRecognitionConstructor {
  new(): SpeechRecognitionInstance;
}

// Extend Window interface for Web Speech API
declare global {
  interface Window {
    SpeechRecognition: SpeechRecognitionConstructor;
    webkitSpeechRecognition: SpeechRecognitionConstructor;
  }
}

export interface VoiceInputButtonProps {
  /**
   * Callback when transcription is complete.
   * @param text - The transcribed text
   */
  onTranscript: (text: string) => void;
  
  /**
   * Optional: Current value to append to (when appendMode is true)
   */
  currentValue?: string;
  
  /**
   * Whether the button should be disabled
   */
  disabled?: boolean;
  
  /**
   * If true, appends transcription to existing text with a space separator.
   * If false, replaces existing text entirely.
   * @default true
   */
  appendMode?: boolean;
  
  /**
   * Language for speech recognition (BCP 47 format)
   * @default 'en-US'
   */
  language?: string;
  
  /**
   * Optional class name for button styling customization
   */
  className?: string;
  
  /**
   * Size variant for the button
   * @default 'md'
   */
  size?: 'sm' | 'md' | 'lg';
}

/**
 * Voice input button that uses Web Speech API for speech-to-text.
 * 
 * Features:
 * - Graceful degradation (hides completely if browser doesn't support speech recognition)
 * - Append or replace mode for text handling
 * - Visual feedback during recording
 * - Error handling with user-friendly messages
 * 
 * @example
 * ```tsx
 * <VoiceInputButton
 *   onTranscript={(text) => setNotes(text)}
 *   currentValue={notes}
 *   appendMode={true}
 * />
 * ```
 */
export function VoiceInputButton({
  onTranscript,
  currentValue = '',
  disabled = false,
  appendMode = true,
  language = 'en-US',
  className = '',
  size = 'md',
}: VoiceInputButtonProps) {
  const [isListening, setIsListening] = useState(false);
  const [supported, setSupported] = useState(true);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);

  // Check for Web Speech API support on mount
  useEffect(() => {
    const SpeechRecognitionCtor = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognitionCtor) {
      // Use requestAnimationFrame to defer state update
      requestAnimationFrame(() => {
        setSupported(false);
      });
    }
  }, []);

  // Cleanup recognition on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
        recognitionRef.current = null;
      }
    };
  }, []);

  const startListening = useCallback(() => {
    const SpeechRecognitionCtor = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (!SpeechRecognitionCtor) {
      toast.error('Voice input is not supported in this browser');
      return;
    }

    try {
      const recognition = new SpeechRecognitionCtor();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = language;
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        setIsListening(true);
      };

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        const transcript = event.results[0][0].transcript;
        
        if (appendMode && currentValue) {
          // Append with space separator, but avoid double spaces
          const separator = currentValue.endsWith(' ') ? '' : ' ';
          onTranscript(currentValue + separator + transcript);
        } else {
          onTranscript(transcript);
        }
        
        setIsListening(false);
      };

      recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        console.error('Speech recognition error:', event.error);
        setIsListening(false);

        switch (event.error) {
          case 'not-allowed':
          case 'permission-denied':
            toast.error('Microphone access denied. Check browser permissions.');
            break;
          case 'no-speech':
            toast.info('No speech detected. Please try again.');
            break;
          case 'network':
            toast.error('Network error. Please check your connection.');
            break;
          case 'aborted':
            // Intentionally aborted, no need to show error
            break;
          default:
            toast.error('Voice input failed. Please try again.');
        }
      };

      recognition.onend = () => {
        setIsListening(false);
        recognitionRef.current = null;
      };

      recognition.start();
      recognitionRef.current = recognition;
    } catch (error) {
      console.error('Failed to start speech recognition:', error);
      toast.error('Failed to start voice input');
      setIsListening(false);
    }
  }, [language, appendMode, currentValue, onTranscript]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
    }
  }, []);

  const handleClick = useCallback(() => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  }, [isListening, startListening, stopListening]);

  // Graceful degradation: render nothing if browser doesn't support speech recognition
  if (!supported) {
    return null;
  }

  // Size variants
  const sizeClasses = {
    sm: 'p-1.5',
    md: 'p-2',
    lg: 'p-2.5',
  };

  const iconSizes = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6',
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled}
      className={`
        rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-1
        ${sizeClasses[size]}
        ${isListening 
          ? 'bg-red-500/20 ring-2 ring-red-400/50 animate-pulse' 
          : 'bg-amber-500/10 hover:bg-amber-500/20 focus:ring-amber-500/40'
        }
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        ${className}
      `}
      title={isListening ? 'Stop recording' : 'Voice input (click to speak)'}
      aria-label={isListening ? 'Stop voice recording' : 'Start voice recording'}
      aria-pressed={isListening}
    >
      {isListening ? (
        <MicOff className={`${iconSizes[size]} text-red-400`} />
      ) : (
        <Mic className={`${iconSizes[size]} text-amber-400`} />
      )}
    </button>
  );
}

/**
 * Voice input button with loading state indicator.
 * Use this when you need to show a loading state while processing the transcript.
 */
export function VoiceInputButtonWithLoading({
  isProcessing = false,
  ...props
}: VoiceInputButtonProps & { isProcessing?: boolean }) {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6',
  };

  if (isProcessing) {
    return (
      <div className={`p-2 rounded-lg bg-amber-500/10 ${props.className || ''}`}>
        <Loader2 className={`${sizeClasses[props.size || 'md']} text-amber-400 animate-spin`} />
      </div>
    );
  }

  return <VoiceInputButton {...props} />;
}

export default VoiceInputButton;
