/**
 * iOS-specific type declarations
 * 
 * Extends Navigator interface with iOS-specific properties
 */

interface Navigator {
  /**
   * iOS Safari-specific property indicating if the app is running
   * in standalone mode (installed to home screen).
   * 
   * @see https://developer.apple.com/documentation/webkitjs/window/1631213-standalone
   */
  standalone?: boolean;
}
