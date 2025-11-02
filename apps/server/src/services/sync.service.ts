import { ReadonlyJSONValue, withValidation } from "@rocicorp/zero";
import {
  AuthData as ZeroAuthData,
  getAgents,
  getMCPStore,
  getMCPs,
  getMessages,
  getOrganisation,
  getProjects,
  getTasks,
  getUsage,
} from "@jupiter/sync/queries/data";
import { createMutators } from "@jupiter/sync/mutators/data";
import { createServerMutators } from "@jupiter/sync/server-mutators/data";
import { schema } from "@jupiter/sync/zero/schema";
import { handleGetQueriesRequest } from "@rocicorp/zero/server";
import type { Mixpanel } from "mixpanel";
import { AuthData } from "../types/auth.types";
import { processorType } from "../config/database";

// Validated queries
const validated = Object.fromEntries(
  [
    getTasks,
    getMessages,
    getAgents,
    getProjects,
    getOrganisation,
    getUsage,
    getMCPStore,
    getMCPs,
  ].map((q) => [q.queryName, withValidation(q)])
);

export class SyncService {
  constructor(
    private processor: processorType,
    private mp: Mixpanel
  ) {}

  /**
   * Get a query by name with auth context
   */
  private getQuery(
    authData: ZeroAuthData,
    name: string,
    args: readonly ReadonlyJSONValue[]
  ) {
    const q = validated[name];
    if (!q) {
      throw new Error(`No such query: ${name}`);
    }
    return {
      query: q(authData, ...args),
    };
  }

  /**
   * Handle Zero get queries request
   */
  async handleGetQueries(authData: AuthData, body: ReadonlyJSONValue) {
    return await handleGetQueriesRequest(
      (name, args) =>
        this.getQuery(
          {
            userId: authData.userId,
            orgId: authData.orgId,
          },
          name,
          args
        ),
      schema,
      body
    );
  }

  /**
   * Handle Zero push mutations
   */
  async handlePush(
    authData: AuthData,
    query: Record<string, string>,
    body: ReadonlyJSONValue
  ) {
    const asyncTasks: Array<() => Promise<void>> = [];

    const result = await this.processor.process(
      createServerMutators(
        createMutators({ userId: authData.userId, orgId: authData.orgId }),
        { userId: authData.userId, orgId: authData.orgId },
        asyncTasks,
        this.mp
      ),
      query,
      body
    );

    await Promise.all(asyncTasks.map((task) => task()));
    return result;
  }
}
