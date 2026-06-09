import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[8px] text-sm font-semibold cursor-pointer transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-[#FFC400] text-[#1a1500] hover:bg-[#FFD60A] hover:-translate-y-0.5 hover:shadow-[0_6px_16px_rgba(255,196,0,0.35)] active:scale-95",
        destructive: "bg-[#D64545] text-white hover:opacity-90 active:scale-95",
        outline: "border border-[#E5E7EB] bg-white text-[#333333] hover:bg-[#F8F9FA] hover:border-[#D2D6DD] active:scale-95",
        secondary: "bg-white text-[#333333] border border-[#E5E7EB] hover:bg-[#F6F7F9] hover:border-[#D2D6DD] active:scale-95",
        ghost: "bg-transparent text-[#333333] hover:bg-[#F6F7F9] active:scale-95",
        link: "text-[#FFC400] underline-offset-4 hover:underline",
      },
      size: {
        default: "h-11 px-5 py-2",
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
