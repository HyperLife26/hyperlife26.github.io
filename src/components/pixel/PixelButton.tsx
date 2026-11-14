import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

export const pixelButtonVariants = cva(
  "pixel-label pixel-focus inline-flex items-center justify-center gap-2 border-[3px] select-none transition-transform duration-75 active:translate-x-[3px] active:translate-y-[3px] active:shadow-none disabled:pointer-events-none disabled:opacity-40 cursor-pointer",
  {
    variants: {
      variant: {
        gold: "bg-gold text-space border-space shadow-[4px_4px_0_0_var(--space)] hover:brightness-110",
        pink: "bg-pink text-space border-space shadow-[4px_4px_0_0_var(--space)] hover:brightness-110",
        sky: "bg-sky text-space border-space shadow-[4px_4px_0_0_var(--space)] hover:brightness-110",
        ghost:
          "bg-panel-raised text-foreground border-space shadow-[4px_4px_0_0_var(--space)] hover:bg-muted hover:text-gold",
        outline: "bg-transparent text-foreground border-lavender hover:bg-panel-raised hover:text-gold",
      },
      size: {
        sm: "h-9 px-3",
        md: "h-11 px-5",
        lg: "h-14 px-7 text-xs",
      },
    },
    defaultVariants: { variant: "ghost", size: "md" },
  },
);

export interface PixelButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof pixelButtonVariants> {}

export const PixelButton = forwardRef<HTMLButtonElement, PixelButtonProps>(
  ({ className, variant, size, type = "button", ...props }, ref) => (
    <button ref={ref} type={type} className={cn(pixelButtonVariants({ variant, size }), className)} {...props} />
  ),
);
PixelButton.displayName = "PixelButton";
