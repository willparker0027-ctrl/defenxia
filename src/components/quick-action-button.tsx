import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface QuickActionButtonProps {
  icon: LucideIcon;
  label: string;
  sub: string;
  img: string;
  onClick: () => void;
  className?: string;
}

/* Protection-tool card: 3D module artwork (PNG, black blended out via
   screen mode) on top, Space Grotesk title + subtitle centred underneath. */
export const QuickActionButton = ({
  icon: _Icon,
  label,
  sub,
  img,
  onClick,
  className,
}: QuickActionButtonProps) => {
  return (
    <button
      onClick={onClick}
      className={cn("glass tool", className)}
      aria-label={label}
    >
      <div className="tool-3d">
        <img src={img} alt="" className="tool-3d-img" draggable={false} />
        <div className="tool-3d-text">
          <b>{label}</b>
          <small>{sub}</small>
        </div>
      </div>
    </button>
  );
};
