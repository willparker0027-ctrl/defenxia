import * as React from "react"

import { cn } from "@/lib/utils"

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          "flex min-h-[80px] w-full rounded-[18px] border border-[rgba(205,194,247,0.10)] bg-[rgba(205,194,247,0.03)] px-3 py-2 text-sm text-ink ring-offset-background placeholder:text-faint focus-visible:outline-none focus-visible:border-magenta/60 focus-visible:ring-2 focus-visible:ring-[rgba(139,61,240,0.35)] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 backdrop-blur-[10px]",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Textarea.displayName = "Textarea"

export { Textarea }
