import { useTaskRuntime } from "@/src/contexts/task-runtime";
import { useQuery } from "@rocicorp/zero/react";
import { getAgents } from "@jupiter/sync/queries/data";
import { useSyncContext } from "@/src/components/sync_engine";
import { motion } from "motion/react";
import { useComposerState } from "@/hooks/use-composer-state";
import { useMessageVirtualization } from "@/hooks/use-message-virtualization";
import { usePromptMenu } from "@/hooks/use-prompt-menu";
import { TaskHeader } from "./task-header";
import { TaskThread } from "./task-thread";
import { TaskComposer } from "./task-composer";
import { PermissionDialog } from "./permission-dialog";

export default function TaskWindow() {
  const syncData = useSyncContext();
  const agents = useQuery(getAgents(syncData.authData))[0];

  const {
    selectedTaskId,
    selectedTask,
    messages,
    sendMessage,
    stopGeneration,
    composerStates,
    setComposerStates,
    permissions,
    permissionIndices,
    nextPermission,
    previousPermission,
    generationState,
    defaultCwd,
    todoState,
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

  const { messageParts, virtualizerRef, scrollContainerRef } =
    useMessageVirtualization({
      messages,
      selectedTaskId,
    });

  const { menuOptions } = usePromptMenu({
    agents,
    setAgent,
    selectFolder,
  });

  // Derived state
  const taskAgent =
    selectedTaskId === "new-conversation"
      ? agent
      : agents.find((agent) =>
          selectedTask && typeof selectedTask === "object"
            ? agent.id === selectedTask.agent_id
            : false
        );

  const pendingPermissions = permissions[selectedTaskId] || [];
  const currentPermissionIndex = permissionIndices[selectedTaskId] || 0;
  const currentPermission = pendingPermissions[currentPermissionIndex];
  const isGenerating = generationState.includes(selectedTaskId);

  return (
    <motion.div className="flex flex-1 relative" layout>
      {/* Header */}
      {selectedTaskId !== "new-conversation" && (
        <TaskHeader
          agent={taskAgent}
          cwd={cwd}
          defaultCwd={defaultCwd}
          todoState={todoState}
          isGenerating={isGenerating}
        />
      )}

      {/* Thread */}
      <motion.div layout className="grow-1 w-full flex justify-center">
        <TaskThread
          selectedTaskId={selectedTaskId}
          messageParts={messageParts}
          isGenerating={isGenerating}
          scrollContainerRef={scrollContainerRef}
          virtualizerRef={virtualizerRef}
        />
      </motion.div>

      {/* Composer & Permission Container */}
      <motion.div
        className="absolute bottom-4 left-1/2 -translate-x-1/2 w-[80%] max-w-3xl"
        initial={{
          y: 40,
          opacity: 0,
        }}
        animate={{
          y: selectedTaskId === "new-conversation" ? 0 : "0%",
          opacity: 1,
        }}
        transition={{
          type: "spring",
          stiffness: 2000,
          damping: 200,
        }}
      >
        {/* Composer */}
        <TaskComposer
          prompt={prompt}
          setPrompt={setPrompt}
          isGenerating={isGenerating}
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
