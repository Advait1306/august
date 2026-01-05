import { defineMutators } from "@rocicorp/zero";
import type DodoPayments from "dodopayments";
import mixpanel from "mixpanel";
import { mutators as clientMutators } from "../mutators";
import { createTaskServerMutators } from "../features/tasks/server-mutators";
import { createMcpServerMutators } from "../features/mcps/server-mutators";
import { createOrganisationServerMutators } from "../features/organisation/server-mutators";
import { createRuntimeServerMutators } from "../features/runtimes/server-mutators";
import type {
  AsyncTask,
  OAuthService,
  AddToAgentLoopQueue,
} from "../features/types";

export function createServerMutators(
  asyncTasks: AsyncTask,
  mixpanelClient: mixpanel.Mixpanel,
  oauthService: OAuthService,
  addToAgentLoopQueue: AddToAgentLoopQueue,
  dodoClient: DodoPayments
) {
  // Analytics tracking function - needs ctx passed in
  const createTrackEvent = (userId: string, orgId: string) => {
    return async (event: string, properties: Record<string, any>) => {
      asyncTasks.push(async () => {
        mixpanelClient.track(event, {
          $user_id: userId,
          org_id: orgId,
          ...properties,
        });
      });
    };
  };

  const taskServerMutators = createTaskServerMutators(
    asyncTasks,
    addToAgentLoopQueue,
    createTrackEvent
  );

  const mcpServerMutators = createMcpServerMutators(asyncTasks, oauthService);

  const organisationServerMutators =
    createOrganisationServerMutators(dodoClient);

  const runtimeServerMutators = createRuntimeServerMutators();

  return defineMutators(clientMutators, {
    ...taskServerMutators,
    ...mcpServerMutators,
    ...organisationServerMutators,
    ...runtimeServerMutators,
  });
}

export type ServerMutators = ReturnType<typeof createServerMutators>;
