import { useTaskRuntime } from "@/src/contexts/task-runtime";
import { motion } from "motion/react";
import { useComposerState } from "@/hooks/use-composer-state";
import { usePromptMenu } from "@/hooks/use-prompt-menu";
import { TaskHeader } from "./task-header";
import { TaskThread } from "./task-thread";
import { TaskComposer } from "./task-composer";
import { PermissionDialog } from "./permission-dialog";

export default function TaskWindow() {
  const {
    selectedTaskId,
    selectedTask,
    isGenerating,
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
  const { prompt, cwd, setPrompt, selectFolder, clearCwd } = useComposerState({
    selectedTaskId,
    composerStates,
    setComposerStates,
    defaultCwd,
  });

  const { menuOptions } = usePromptMenu({
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
          taskId={selectedTaskId}
          cwd={cwd}
          defaultCwd={defaultCwd}
          isGenerating={isGenerating}
        />
      )}

      {/* Thread */}
      <motion.div layout className="grow w-full flex justify-center">
        <TaskThread selectedTask={selectedTask} isGenerating={isGenerating} />
      </motion.div>

      {/* Composer & Permission Container */}
      <motion.div className="absolute bottom-4 left-1/2 -translate-x-1/2 w-[80%] max-w-3xl">
        {/* Composer */}
        <TaskComposer
          prompt={prompt}
          setPrompt={setPrompt}
          isGenerating={isGenerating}
          sendMessage={sendMessage}
          stopGeneration={stopGeneration}
          selectedTaskId={selectedTaskId}
          cwd={cwd}
          defaultCwd={defaultCwd}
          menuOptions={menuOptions}
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
