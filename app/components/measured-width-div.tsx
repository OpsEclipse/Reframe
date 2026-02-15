"use client";

import type { ComponentPropsWithoutRef } from "react";
import { forwardRef, useLayoutEffect, useRef } from "react";

type MeasuredWidthDivProps = ComponentPropsWithoutRef<"div"> & {
  cssVarName: `--${string}`;
};

export default forwardRef<HTMLDivElement, MeasuredWidthDivProps>(function MeasuredWidthDiv(
  { cssVarName, style, ...props },
  forwardedRef,
) {
  const localRef = useRef<HTMLDivElement | null>(null);
  const setRefs = (node: HTMLDivElement | null) => {
    localRef.current = node;
    if (!forwardedRef) return;
    if (typeof forwardedRef === "function") {
      forwardedRef(node);
      return;
    }
    forwardedRef.current = node;
  };

  useLayoutEffect(() => {
    const el = localRef.current;
    if (!el) return;

    const update = () => {
      // Use layout width so we lock to the current content width in pixels.
      const width = Math.ceil(el.getBoundingClientRect().width);
      el.style.setProperty(cssVarName, `${width}px`);
    };

    // Measure after first paint to avoid forcing synchronous layout during hydration.
    const raf = window.requestAnimationFrame(update);

    // Font loading can change text metrics after mount; re-measure when ready.
    const fontReady = (document as Document & { fonts?: FontFaceSet }).fonts?.ready;
    fontReady?.then(() => update()).catch(() => {});

    return () => {
      window.cancelAnimationFrame(raf);
    };
  }, [cssVarName]);

  return <div ref={setRefs} style={style} {...props} />;
});
