import * as React from "react";

import { cn } from "@hypershelf/lib/utils";

type TextareaProps = React.ComponentProps<"textarea"> & {
  autosizeFrom?: number;
  autosizeTo?: number;
  minRows?: number;
  maxRows?: number;
};

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  (
    {
      className,
      style,
      autosizeFrom,
      autosizeTo,
      minRows,
      maxRows,
      onInput,
      value,
      placeholder,
      ...props
    },
    forwardedRef,
  ) => {
    const ref = React.useRef<HTMLTextAreaElement>(null);
    const sizerRef = React.useRef<HTMLDivElement>(null);
    const sizerOuterRef = React.useRef<HTMLDivElement>(null);

    const measureCore = React.useCallback(
      (wrapMode: "whitespace" | "anywhere") => {
        const el = ref.current;
        const sizer = sizerRef.current;
        const sizerOuter = sizerOuterRef.current;
        if (!el || !sizer || !sizerOuter) return null;

        const cs = window.getComputedStyle(el);

        sizer.style.font = cs.font;
        sizer.style.fontWeight = cs.fontWeight;
        sizer.style.fontStyle = cs.fontStyle;
        sizer.style.letterSpacing = cs.letterSpacing;
        sizer.style.textTransform = cs.textTransform;
        sizer.style.whiteSpace = "pre-wrap";
        sizer.style.wordBreak =
          wrapMode === "anywhere" ? "break-word" : "normal";
        sizer.style.overflowWrap =
          wrapMode === "anywhere" ? "anywhere" : "normal";
        sizerOuter.style.padding = cs.padding;

        const content =
          (value ? String(value) : el.value) || (placeholder ?? "");
        sizer.textContent = content;

        const borderY =
          (parseFloat(cs.borderTopWidth) || 0) +
          (parseFloat(cs.borderBottomWidth) || 0);
        const paddingY =
          (parseFloat(cs.paddingTop) || 0) +
          (parseFloat(cs.paddingBottom) || 0);
        const paddingX =
          (parseFloat(cs.paddingLeft) || 0) +
          (parseFloat(cs.paddingRight) || 0);
        const borderX =
          (parseFloat(cs.borderLeftWidth) || 0) +
          (parseFloat(cs.borderRightWidth) || 0);

        const baseWidth =
          typeof autosizeTo === "number" && autosizeTo > 0
            ? autosizeTo
            : el.clientWidth || Math.ceil(sizer.scrollWidth);

        sizer.style.width = `${baseWidth}px`;

        const baseRect = sizer.getBoundingClientRect();
        const lineHeight =
          parseFloat(cs.lineHeight) || Math.max(1, baseRect.height);
        const linesAtBase = Math.max(
          1,
          Math.ceil(baseRect.height / lineHeight),
        );

        const overflowedAtBase =
          Math.ceil(sizer.scrollWidth) > Math.ceil(sizer.clientWidth);

        let low = Math.max(1, autosizeFrom ?? 1);
        let high = Math.max(low, baseWidth);
        let bestW = high;
        let bestH = baseRect.height;

        while (low <= high) {
          const mid = Math.floor((low + high) / 2);
          if (mid <= 0) break;

          sizer.style.width = `${mid}px`;
          const currentRect = sizer.getBoundingClientRect();
          const currentLines = Math.max(
            1,
            Math.ceil(currentRect.height / lineHeight),
          );
          const overflowed =
            Math.ceil(sizer.scrollWidth) > Math.ceil(sizer.clientWidth);

          const valid =
            currentLines <= linesAtBase &&
            (wrapMode === "anywhere" ? true : !overflowed);

          if (valid) {
            bestW = mid;
            bestH = currentRect.height;
            high = mid - 1;
          } else {
            low = mid + 1;
          }
        }

        const minH = minRows ? Math.ceil(lineHeight * minRows) : undefined;
        const maxH = maxRows ? Math.floor(lineHeight * maxRows) : undefined;

        const measuredH = bestH;
        const clampedH = Math.min(
          maxH ?? measuredH,
          Math.max(measuredH, minH ?? measuredH),
        );

        const measuredW = bestW;
        const minW = autosizeFrom ?? measuredW;
        const maxW = baseWidth;
        const clampedW = Math.min(maxW, Math.max(measuredW, minW));

        const realH = clampedH + paddingY + borderY;
        const realW = clampedW + paddingX + borderX;

        el.style.height = `${realH}px`;
        el.style.overflowY = maxH && realH >= maxH ? "auto" : "hidden";
        el.style.width = `${realW}px`;
        el.style.overflowX =
          typeof autosizeTo === "number" && realW >= autosizeTo
            ? "auto"
            : "hidden";
        el.style.whiteSpace = "pre-wrap";
        el.style.wordBreak = wrapMode === "anywhere" ? "break-word" : "normal";
        el.style.overflowWrap = wrapMode === "anywhere" ? "anywhere" : "normal";

        return { overflowedAtBase };
      },
      [autosizeFrom, autosizeTo, minRows, maxRows, value, placeholder],
    );

    const measure = React.useCallback(() => {
      const el = ref.current;
      const sizer = sizerRef.current;
      if (!el || !sizer) return;

      const firstPass = measureCore("whitespace");
      if (firstPass?.overflowedAtBase) {
        measureCore("anywhere");
      }
    }, [measureCore]);

    const setRefs = React.useCallback(
      (node: HTMLTextAreaElement | null) => {
        ref.current = node;
        if (typeof forwardedRef === "function") forwardedRef(node);
        else if (forwardedRef) forwardedRef.current = node;
        if (node) measure();
      },
      [forwardedRef, measure],
    );

    React.useLayoutEffect(() => {
      measure();
    }, [measure]);

    const handleInput: React.ComponentProps<"textarea">["onInput"] = (e) => {
      onInput?.(e);
      measure();
    };

    return (
      <>
        <textarea
          ref={setRefs}
          data-slot="textarea"
          value={value}
          placeholder={placeholder}
          onInput={handleInput}
          className={cn(
            "px-3 py-2 text-base shadow-xs md:text-sm flex rounded-md border border-input bg-transparent transition-[color,box-shadow] outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:bg-input/30 dark:aria-invalid:ring-destructive/40",
            className,
          )}
          style={{
            ...style,
            resize: "none",
            ...(autosizeFrom ? { minWidth: autosizeFrom } : {}),
            ...(autosizeTo ? { maxWidth: autosizeTo } : {}),
            overflowX: "hidden",
            overflowY: "hidden",
            whiteSpace: "pre-wrap",
            wordBreak: "normal",
            overflowWrap: "normal",
          }}
          {...props}
        />
        <div
          className="absolute"
          style={{ visibility: "hidden" }}
          ref={sizerOuterRef}
        >
          <div
            ref={sizerRef}
            aria-hidden="true"
            style={{
              whiteSpace: "pre-wrap",
              wordBreak: "normal",
              overflowWrap: "normal",
            }}
          />
        </div>
      </>
    );
  },
);

Textarea.displayName = "Textarea";

export { Textarea };
