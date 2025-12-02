import { motion } from "motion/react";
import { Button } from "./ui/button";
import { ButtonGroup } from "./ui/button-group";
import { JsonViewer } from "./ui/json-viewer";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { Permission } from "@jupiter/shared/types";

interface PermissionDialogProps {
  currentPermission: Permission;
  pendingPermissions: Permission[];
  currentIndex: number;
  onNext: () => void;
  onPrevious: () => void;
}

export function PermissionDialog({
  currentPermission,
  pendingPermissions,
  currentIndex,
  onNext,
  onPrevious,
}: PermissionDialogProps) {
  const isAtStart = currentIndex === 0;
  const isAtEnd = currentIndex === pendingPermissions.length - 1;
  return (
    <motion.div
      className="absolute bottom-0 w-full flex justify-between items-center p-4 mb-4 bg-background rounded-2xl border border-border min-h-[120px]"
      initial={{
        y: 100,
        opacity: 0,
      }}
      animate={{
        y: 0,
        opacity: 1,
      }}
      transition={{
        type: "spring",
        stiffness: 2000,
        damping: 200,
      }}
    >
      <>
        {/* Permission Details */}
        <div className="w-full min-h-[70px] flex flex-col justify-between items-start gap-2">
          {/* Header */}
          <div className="w-full flex justify-between items-center gap-2">
            <span className="font-semibold">{currentPermission.toolName}</span>
            {pendingPermissions.length > 1 && (
              <ButtonGroup>
                <Button
                  variant="outline"
                  onClick={onPrevious}
                  size={"xs"}
                  hotkey="ArrowLeft"
                  disabled={isAtStart}
                >
                  <ChevronLeftIcon className="w-2 h-2" />
                </Button>
                <Button
                  variant="outline"
                  onClick={onNext}
                  size={"xs"}
                  hotkey="ArrowRight"
                  disabled={isAtEnd}
                >
                  <ChevronRightIcon className="w-2 h-2" />
                </Button>
              </ButtonGroup>
            )}
          </div>

          {/* Input */}
          <JsonViewer data={currentPermission.input} className="w-full" />
        </div>
        {/* Action Buttons */}
        <div className="absolute bottom-4 right-4 w-full flex justify-end">
          <ButtonGroup>
            <Button
              variant="outline"
              size={"xs"}
              onClick={() => {
                currentPermission.alwaysAllow();
              }}
              hotkey="Enter"
              modifierKey="meta"
              className="gap-1.5"
            >
              Allow for session
              <span className="opacity-50 text-[10px] self-end mb-0.5">⌘↵</span>
            </Button>
            <Button
              variant="outline"
              size={"xs"}
              onClick={() => {
                currentPermission.grant();
              }}
              hotkey="Enter"
              className="gap-1.5"
            >
              Allow
              <span className="opacity-50 text-[10px] self-end mb-0.5">↵</span>
            </Button>
            <Button
              variant="outline"
              size={"xs"}
              onClick={() => {
                currentPermission.deny();
              }}
              hotkey="Escape"
              className="gap-1.5"
            >
              Deny
              <span className="opacity-50 text-[10px] self-end mb-0.5">
                Esc
              </span>
            </Button>
          </ButtonGroup>
        </div>
      </>
    </motion.div>
  );
}
