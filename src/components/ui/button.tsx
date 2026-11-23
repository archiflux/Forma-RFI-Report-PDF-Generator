import * as React from "react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "accent" | "secondary" | "ghost";
type Size = "sm" | "md" | "lg";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

// Holdpoint buttons: square; teal for the main action (with a light sheen on
// hover), citron for "next step / change", white with a slate border, ghost.
const variantStyles: Record<Variant, string> = {
  primary:
    "sb-sheen bg-[color:var(--bp-teal)] text-white shadow-hp-sm hover:bg-[color:var(--bp-teal-dark)] hover:shadow-hp-md focus-visible:outline-[color:var(--bp-teal)]",
  accent:
    "sb-sheen bg-[color:var(--bp-citron)] text-[color:var(--bp-citron-ink)] shadow-hp-sm hover:brightness-95 hover:shadow-hp-md focus-visible:outline-[color:var(--bp-teal)]",
  secondary:
    "bg-white text-[color:var(--bp-ink)] border border-[color:var(--bp-rule)] hover:bg-[color:var(--bp-fill)] focus-visible:outline-[color:var(--bp-teal)]",
  ghost:
    "bg-transparent text-[color:var(--slate-700)] hover:bg-[color:var(--bp-desk)] focus-visible:outline-[color:var(--bp-teal)]",
};

// `min-h-*` instead of `h-*` so buttons grow when their label wraps or
// outgrows the default height — text used to clip on labels like
// "Load full RFI detail". `whitespace-nowrap` keeps single-line labels on
// one line until the parent forces a wrap.
const sizeStyles: Record<Size, string> = {
  sm: "min-h-8 px-3 py-1.5 text-sm whitespace-nowrap",
  md: "min-h-10 px-4 py-2 text-sm whitespace-nowrap",
  lg: "min-h-12 px-6 py-2.5 text-base whitespace-nowrap",
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", ...props }, ref) => (
    <button
      ref={ref}
      className={cn(
        "inline-flex items-center justify-center gap-1.5 font-semibold transition-[background-color,box-shadow,transform] duration-150 active:scale-[0.97]",
        "disabled:opacity-50 disabled:pointer-events-none",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2",
        variantStyles[variant],
        sizeStyles[size],
        className,
      )}
      {...props}
    />
  ),
);
Button.displayName = "Button";
