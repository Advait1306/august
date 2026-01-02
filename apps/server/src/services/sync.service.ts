import { mustGetQuery, mustGetMutator } from "@rocicorp/zero";
import { handleQueryRequest, handleMutateRequest } from "@rocicorp/zero/server";
import { queries } from "@jupiter/sync/queries/data";
import { createServerMutators } from "@jupiter/sync/server-mutators/data";
import { schema, AuthData } from "@jupiter/sync/zero/schema";
import type { Mixpanel } from "mixpanel";
import type DodoPayments from "dodopayments";
import { OAuthService } from "./oauth.service";
import { addToAgentLoopQueue } from "../queues/workers/agentLoopWorker";
import { DbProviderType } from "../config/state";

export class SyncService {
  constructor(
    private dbProvider: DbProviderType,
    private mp: Mixpanel,
    private oauthService: OAuthService,
    private dodoClient: DodoPayments
  ) {}

  /**
   * Handle Zero query request
   */
  async handleQuery(authData: AuthData, body: Request) {
    return await handleQueryRequest(
      (name, args) => {
        const query = mustGetQuery(queries, name);
        return query.fn({
          args,
          ctx: authData,
        });
      },
      schema,
      body
    );
  }

  /**
   * Handle Zero mutate request
   */
  async handleMutate(authData: AuthData, body: Request) {
    const asyncTasks: Array<() => Promise<void>> = [];

    const serverMutators = createServerMutators(
      asyncTasks,
      this.mp,
      this.oauthService,
      addToAgentLoopQueue,
      this.dodoClient
    );

    const result = await handleMutateRequest(
      this.dbProvider,
      (transact) =>
        transact((tx, name, args) => {
          const mutator = mustGetMutator(serverMutators, name);
          return mutator.fn({
            tx,
            ctx: authData,
            args,
          });
        }),
      body
    );

    // Run async tasks after mutation completes
    await Promise.allSettled(asyncTasks.map((task) => task()));

    return result;
  }
}
