import { useMemo, useState } from "react";
import {
  unstable_useRemoteThreadListRuntime as useRemoteThreadListRuntime,
  useLocalThreadRuntime,
  useThreadListItem,
  RuntimeAdapterProvider,
  type ThreadHistoryAdapter,
  AssistantRuntimeProvider,
  ExportedMessageRepository,
  type ThreadMessageLike,
} from "@assistant-ui/react";
import { AgentAdapter } from "@/src/adapters/AgentAdapter";
import { ThreadListAdapter } from "@/src/adapters/ThreadListAdapter";
import { PermissionProvider } from "@/src/contexts/permission-provider";

// Custom hook for local thread runtime with adapters
function useLocalThreadRuntimeWithAdapters() {
  return useLocalThreadRuntime(AgentAdapter, {});
}

// Provider component for thread-specific adapters
function ThreadAdapterProvider({ children }: { children?: React.ReactNode }) {
  const threadListItem = useThreadListItem();
  const remoteId = threadListItem?.remoteId;

  const [cache, setCache] = useState<any[]>([]);

  const historyAdapter = useMemo<ThreadHistoryAdapter>(
    () => ({
      async load() {
        if (!remoteId) return { messages: [] };

        const dbMessages = await window.api.chat.getMessages(remoteId);
        const threadMessageLikes: ThreadMessageLike[] = dbMessages.map(
          (m: any) => ({
            id: m.id,
            role: m.role as any,
            content: JSON.parse(m.content),
            createdAt: new Date(m.createdAt),
            metadata: JSON.parse(m.metadata),
          })
        );

        return ExportedMessageRepository.fromArray(threadMessageLikes);
      },

      async append(item: any) {
        if (!remoteId) {
          console.warn(
            "Cannot save message - thread not initialized - adding to cache"
          );
          setCache((prev) => [...prev, item.message]);
          return;
        }

        if (cache.length > 0) {
          console.log("ThreadAdapterProvider append - saving cache to db");
          for (const message of cache) {
            await window.api.chat.saveMessage({
              ...message,
              threadId: remoteId,
              parentId: item.parentId,
            });
          }
          setCache([]);
        }

        await window.api.chat.saveMessage({
          ...item.message,
          threadId: remoteId,
          parentId: item.parentId,
        });
      },
    }),
    [remoteId, cache]
  );

  const adapters = useMemo(
    () => ({ history: historyAdapter }),
    [historyAdapter]
  );

  return (
    <RuntimeAdapterProvider adapters={adapters}>
      {children}
    </RuntimeAdapterProvider>
  );
}

export function RuntimeProvider({ children }: { children: React.ReactNode }) {
  const runtime = useRemoteThreadListRuntime({
    runtimeHook: useLocalThreadRuntimeWithAdapters,
    adapter: {
      ...ThreadListAdapter,
      unstable_Provider: ThreadAdapterProvider,
    },
  });

  return (
    <PermissionProvider>
      <AssistantRuntimeProvider runtime={runtime}>
        {children}
      </AssistantRuntimeProvider>
    </PermissionProvider>
  );
}
