import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-magenta focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-magenta/30 bg-magenta/20 text-lavbright hover:bg-magenta/30",
        secondary:
          "bg-white/5 text-mist border-[rgba(205,194,247,0.10)] hover:bg-white/10",
        destructive:
          "bg-[#c93a72]/20 text-[#ff6b6b] border-[#c93a72]/40 hover:bg-[#c93a72]/30",
        outline: "text-mist border-[rgba(205,194,247,0.18)]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
