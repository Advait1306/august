import { Badge } from "./ui/badge";
import { motion, AnimatePresence } from "motion/react";
import { XIcon } from "lucide-react";

interface ComposerBadgeProps {
  icon: React.ReactNode;
  label: string;
  onClear: () => void;
  isHovered: boolean;
  setIsHovered: (hovered: boolean) => void;
}

export function ComposerBadge({
  icon,
  label,
  onClear,
  isHovered,
  setIsHovered,
}: ComposerBadgeProps) {
  return (
    <Badge
      variant="outline"
      className="flex items-center gap-1 py-2 rounded cursor-pointer"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={onClear}
    >
      <AnimatePresence>
        {isHovered && (
          <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: "auto", opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{
              type: "spring",
              stiffness: 2000,
              damping: 200,
            }}
            layout
          >
            <XIcon className="w-4 h-4" />
          </motion.div>
        )}
      </AnimatePresence>
      {icon}
      <span>{label}</span>
    </Badge>
  );
}
