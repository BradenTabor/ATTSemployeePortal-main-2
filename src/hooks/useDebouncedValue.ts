import { useEffect, useState } from "react";

/**
 * Returns a debounced copy of any primitive or object value.
 * Updates are delayed until the specified timeout has elapsed
 * without the input value changing.
 */
export function useDebouncedValue<T>(value: T, delay = 300) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timeout = setTimeout(() => setDebouncedValue(value), delay);
    return () => {
      clearTimeout(timeout);
    };
  }, [value, delay]);

  return debouncedValue;
}

