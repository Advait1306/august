import { useTaskRuntime } from "@/src/contexts/task-runtime";
import { useEffect } from "react";
import { useQuery } from "@rocicorp/zero/react";
import { getAgents } from "@jupiter/sync/queries/data";
import { useSyncContext } from "@/src/components/sync_engine";
import { motion } from "motion/react";
import { useScrollGradients } from "@/hooks/use-scroll-gradients";
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
    generationState,
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

  // Scroll gradients
  const { showTopGradient, showBottomGradient, recalculate } =
    useScrollGradients(scrollContainerRef, {
      drillToScrollElement: true,
      initDelay: 100,
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
  const currentPermission = pendingPermissions[0];
  const isGenerating = generationState.includes(selectedTaskId);

  // Recalculate gradients when messages or task changes
  useEffect(() => {
    recalculate();
  }, [messages, selectedTaskId, recalculate]);

  return (
    <motion.div className="flex-1 relative" layout>
      {/* Header */}
      {selectedTaskId !== "new-conversation" && (
        <TaskHeader agent={taskAgent} cwd={cwd} defaultCwd={defaultCwd} />
      )}

      {/* Thread */}
      <motion.div
        layout
        className="absolute w-full h-[calc(100%-210px)] px-8 bottom-40 flex justify-center"
      >
        <TaskThread
          selectedTaskId={selectedTaskId}
          messageParts={messageParts}
          isGenerating={isGenerating}
          scrollContainerRef={scrollContainerRef}
          virtualizerRef={virtualizerRef}
          showTopGradient={showTopGradient}
          showBottomGradient={showBottomGradient}
        />
      </motion.div>

      {/* Composer & Permission Container */}
      <motion.div
        className="absolute top-1/2 -translate-y-1/2 left-1/2 -translate-x-1/2 w-[80%] max-w-3xl"
        initial={{
          y: 40,
          opacity: 0,
        }}
        animate={{
          y:
            selectedTaskId === "new-conversation"
              ? "0%"
              : "calc(50vh - 50% - 1.5rem)",
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
          />
        )}
      </motion.div>
    </motion.div>
  );
}
