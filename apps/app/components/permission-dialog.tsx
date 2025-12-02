import { motion } from "motion/react";
import { Button } from "./ui/button";
import { ButtonGroup } from "./ui/button-group";
import { JsonViewer } from "./ui/json-viewer";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";

interface PermissionDialogProps {
  currentPermission: any;
  pendingPermissions: any[];
}

export function PermissionDialog({
  currentPermission,
  pendingPermissions,
}: PermissionDialogProps) {
  return (
    <motion.div
      className="absolute bottom-0 w-full flex justify-between items-center p-4 mb-4 bg-background rounded-2xl border border-border"
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
      <div className="w-full flex flex-col gap-2">
        <div className="flex flex-col gap-2">
          <div className="w-full flex justify-between items-center gap-2">
            <span className="font-semibold">{currentPermission.toolName}</span>
            {pendingPermissions.length > 1 && (
              <ButtonGroup>
                <Button
                  variant="outline"
                  onClick={() => {}}
                  size={"xs"}
                  hotkey="ArrowLeft"
                >
                  <ChevronLeftIcon className="w-2 h-2" />
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {}}
                  size={"xs"}
                  hotkey="ArrowRight"
                >
                  <ChevronRightIcon className="w-2 h-2" />
                </Button>
              </ButtonGroup>
            )}
          </div>

          <JsonViewer data={currentPermission.input} className="w-full" />
        </div>
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
      </div>
    </motion.div>
  );
}
