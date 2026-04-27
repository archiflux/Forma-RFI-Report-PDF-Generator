import * as React from "react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "ghost";
type Size = "sm" | "md" | "lg";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

const variantStyles: Record<Variant, string> = {
  primary:
    "bg-[color:var(--brand-primary)] text-white shadow-sm hover:bg-[color:var(--brand-secondary)] focus-visible:ring-[color:var(--brand-primary)]",
  secondary:
    "bg-[color:var(--brand-surface)] text-[color:var(--brand-primary)] border border-[color:var(--brand-border)] hover:border-[color:var(--brand-primary)] hover:bg-[color:var(--brand-canvas)] focus-visible:ring-[color:var(--brand-primary)]",
  ghost:
    "bg-transparent text-[color:var(--brand-primary)] hover:bg-[color:var(--brand-canvas)] focus-visible:ring-[color:var(--brand-primary)]",
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
        "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors",
        "disabled:opacity-50 disabled:pointer-events-none",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
        variantStyles[variant],
        sizeStyles[size],
        className,
      )}
      {...props}
    />
  ),
);
Button.displayName = "Button";
