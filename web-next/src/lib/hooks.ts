import { useEffect, useLayoutEffect, useRef, useState } from 'react';

export function useDebouncedValue<T>(value: T, delayMs = 400): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(id);
  }, [value, delayMs]);
  return debounced;
}

/** Calls `onVisible` when the returned ref's element scrolls into view (infinite scroll). */
export function useInView<T extends Element>(onVisible: () => void, enabled = true) {
  const ref = useRef<T | null>(null);
  const callback = useRef(onVisible);
  useLayoutEffect(() => {
    callback.current = onVisible;
  });

  useEffect(() => {
    const el = ref.current;
    if (!el || !enabled) return;
    const observer = new IntersectionObserver(
      (entries) => entries.some((e) => e.isIntersecting) && callback.current(),
      { rootMargin: '600px 0px' }, // start loading well before the user hits the bottom
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [enabled]);

  return ref;
}

export function useDocumentTitle(title: string | undefined) {
  useEffect(() => {
    if (title) document.title = title;
  }, [title]);
}
