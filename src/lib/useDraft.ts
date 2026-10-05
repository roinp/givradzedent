"use client";

import { useEffect, useState } from "react";

/**
 * Form state that survives closing the modal: unsaved input is kept in
 * sessionStorage under `key` and restored the next time the form opens.
 */
export function useDraft<T extends object>(key: string, initial: T) {
  const storageKey = `draft:${key}`;
  const [{ start, restored }] = useState(() => {
    try {
      const raw = sessionStorage.getItem(storageKey);
      if (raw) return { start: { ...initial, ...JSON.parse(raw) } as T, restored: true };
    } catch {}
    return { start: initial, restored: false };
  });
  const [value, setValue] = useState<T>(start);
  const [initialJson] = useState(() => JSON.stringify(initial));

  useEffect(() => {
    try {
      const json = JSON.stringify(value);
      if (json === initialJson) sessionStorage.removeItem(storageKey);
      else sessionStorage.setItem(storageKey, json);
    } catch {}
  }, [storageKey, value, initialJson]);

  function clear() {
    try {
      sessionStorage.removeItem(storageKey);
    } catch {}
  }

  function reset() {
    clear();
    setValue(JSON.parse(initialJson));
  }

  return { value, setValue, restored, clear, reset };
}
