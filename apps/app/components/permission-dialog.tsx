import { motion } from "motion/react";
import { Button } from "./ui/button";
import { ButtonGroup } from "./ui/button-group";
import { CodeBlock } from "./ai-elements/code-block";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";

interface PermissionDialogProps {
  currentPermission: any;
  pendingPermissions: any[];
}

export function PermissionDialog({
  currentPermission,
  pendingPermissions,
}: PermissionDialogProps) {
  if (!currentPermission) return null;

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
            <span className="font-semibold">
              {currentPermission.toolName}
            </span>
            {pendingPermissions.length === 1 && (
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground ml-2">
                  (1 of {pendingPermissions.length})
                </span>
                <ButtonGroup>
                  <Button
                    variant="outline"
                    onClick={() => {}}
                    size={"xs"}
                  >
                    <ChevronLeftIcon className="w-2 h-2" />
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {}}
                    size={"xs"}
                  >
                    <ChevronRightIcon className="w-2 h-2" />
                  </Button>
                </ButtonGroup>
              </div>
            )}
          </div>

          <CodeBlock
            code={JSON.stringify(currentPermission.input, null, 2)}
            language="json"
            className="w-full border-none [&_pre]:!p-0"
          />
        </div>
        <div className="absolute bottom-4 right-4 w-full flex justify-end">
          <ButtonGroup>
            <Button
              variant="outline"
              onClick={() => {
                currentPermission.alwaysAllow();
              }}
            >
              Always Allow
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                currentPermission.grant();
              }}
            >
              Allow
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                currentPermission.deny();
              }}
            >
              Deny
            </Button>
          </ButtonGroup>
        </div>
      </div>
    </motion.div>
  );
}
