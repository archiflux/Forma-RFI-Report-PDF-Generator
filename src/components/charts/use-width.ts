"use client";

import { useCallback, useRef, useState } from "react";

// Width of an element in CSS pixels, tracked with ResizeObserver. Uses a
// callback ref so measuring starts whenever the element mounts, including
// after a "no data yet" placeholder has been replaced.
export function useWidth<T extends Element>(): [(el: T | null) => void, number] {
  const [width, setWidth] = useState(0);
  const observer = useRef<ResizeObserver | null>(null);
  const ref = useCallback((el: T | null) => {
    observer.current?.disconnect();
    observer.current = null;
    if (!el) return;
    setWidth(Math.round(el.getBoundingClientRect().width));
    const ro = new ResizeObserver(([e]) => setWidth(Math.round(e?.contentRect.width ?? 0)));
    ro.observe(el);
    observer.current = ro;
  }, []);
  return [ref, width];
}
