import * as React from "react"

import { cn } from "@/lib/utils"

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-10 w-full rounded-[18px] border border-[rgba(205,194,247,0.10)] bg-[rgba(205,194,247,0.03)] px-3 py-2 text-base text-ink ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-ink placeholder:text-faint focus-visible:outline-none focus-visible:border-magenta/60 focus-visible:ring-2 focus-visible:ring-[rgba(139,61,240,0.35)] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm backdrop-blur-[10px]",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
