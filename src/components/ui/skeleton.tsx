import { cn } from "@/lib/utils"

function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-pulse rounded-[18px] bg-[rgba(205,194,247,0.06)]", className)}
      {...props}
    />
  )
}

export { Skeleton }
