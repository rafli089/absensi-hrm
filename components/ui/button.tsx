import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  // text-body = body, focus ring 3px per README2, scale-0.98 per §Prinsip 5
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[var(--radius-md)] text-body font-medium transition-colors duration-200 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[var(--brand)]/25 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary:
          "bg-[var(--brand-hover)] text-white shadow-[var(--shadow-sm)] hover:brightness-95 active:scale-[0.98]",
        secondary:
          "bg-[var(--surface)] text-[var(--ink)] border border-black/[0.12] shadow-[var(--shadow-sm)] hover:bg-[var(--bg)] active:scale-[0.98]",
        ghost: "text-[var(--ink)] hover:bg-black/[0.04] active:scale-[0.98]",
        danger:
          "bg-[var(--danger-ink)] text-white shadow-[var(--shadow-sm)] hover:brightness-95 active:scale-[0.98]",
        link: "text-[var(--brand-ink)] underline-offset-4 hover:underline p-0 h-auto",
      },
      size: {
        sm: "h-9 px-3 text-caption",
        md: "h-10 px-4",
        lg: "h-11 px-5",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />;
  },
);
Button.displayName = "Button";

export { buttonVariants };
