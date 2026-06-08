import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full text-sm font-semibold cursor-pointer transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 disabled:cursor-not-allowed [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 active:translate-y-0.5 active:scale-[0.98]",
  {
    variants: {
      variant: {
        default:
          "bg-gradient-primary text-primary-foreground shadow-clay-sm hover:-translate-y-0.5 hover:shadow-glow",
        destructive:
          "bg-destructive text-destructive-foreground shadow-clay-sm hover:-translate-y-0.5",
        outline:
          "bg-card text-foreground shadow-clay-sm hover:-translate-y-0.5 hover:text-primary",
        secondary:
          "bg-secondary text-secondary-foreground shadow-clay-sm hover:-translate-y-0.5",
        ghost:
          "shadow-none hover:bg-accent/60 hover:text-accent-foreground active:scale-100",
        link: "text-primary underline-offset-4 hover:underline shadow-none active:scale-100 active:translate-y-0",
      },
      size: {
        default: "h-11 px-6 py-2.5",
        sm: "h-9 px-4 text-xs",
        lg: "h-12 px-8 text-base",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
