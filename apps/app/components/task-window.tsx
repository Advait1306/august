import { useTaskRuntime } from "@/src/contexts/task-runtime";
import { useQuery } from "@rocicorp/zero/react";
import { queries } from "@jupiter/sync/queries/data";
import { motion } from "motion/react";
import { useComposerState } from "@/hooks/use-composer-state";
import { usePromptMenu } from "@/hooks/use-prompt-menu";
import { TaskHeader } from "./task-header";
import { TaskThread } from "./task-thread";
import { TaskComposer } from "./task-composer";
import { PermissionDialog } from "./permission-dialog";

export default function TaskWindow() {
  const [agents] = useQuery(queries.agents.all());

  const {
    selectedTaskId,
    sendMessage,
    stopGeneration,
    composerStates,
    setComposerStates,
    permissions,
    permissionIndices,
    nextPermission,
    previousPermission,
    defaultCwd,
  } = useTaskRuntime();

  // Custom hooks for state management
  const {
    prompt,
    agent,
    cwd,
    setPrompt,
    setAgent,
    selectFolder,
    clearAgent,
    clearCwd,
  } = useComposerState({
    selectedTaskId,
    composerStates,
    setComposerStates,
    defaultCwd,
  });

  const { menuOptions } = usePromptMenu({
    agents,
    setAgent,
    selectFolder,
  });

  const pendingPermissions = permissions[selectedTaskId] || [];
  const currentPermissionIndex = permissionIndices[selectedTaskId] || 0;
  const currentPermission = pendingPermissions[currentPermissionIndex];

  return (
    <motion.div className="flex flex-1 relative" layout>
      {/* Header */}
      {selectedTaskId !== "new-conversation" && (
        <TaskHeader
          cwd={cwd}
          defaultCwd={defaultCwd}
          todoState={[]}
          isGenerating={false}
        />
      )}

      {/* Thread */}
      <motion.div layout className="grow w-full flex justify-center">
        <TaskThread selectedTaskId={selectedTaskId} />
      </motion.div>

      {/* Composer & Permission Container */}
      <motion.div className="absolute bottom-4 left-1/2 -translate-x-1/2 w-[80%] max-w-3xl">
        {/* Composer */}
        <TaskComposer
          prompt={prompt}
          setPrompt={setPrompt}
          isGenerating={false}
          sendMessage={sendMessage}
          stopGeneration={stopGeneration}
          selectedTaskId={selectedTaskId}
          agent={agent}
          cwd={cwd}
          defaultCwd={defaultCwd}
          menuOptions={menuOptions}
          clearAgent={clearAgent}
          clearCwd={clearCwd}
          currentPermission={currentPermission}
        />

        {/* Permission */}
        {currentPermission && (
          <PermissionDialog
            currentPermission={currentPermission}
            pendingPermissions={pendingPermissions}
            currentIndex={currentPermissionIndex}
            onNext={() => nextPermission(selectedTaskId)}
            onPrevious={() => previousPermission(selectedTaskId)}
          />
        )}
      </motion.div>
    </motion.div>
  );
}
