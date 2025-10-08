// server-mutators.ts
import { CustomMutatorDefs, Transaction } from "@rocicorp/zero";
import { Schema } from "../zero/schema";

type AuthData = {
  userId: string;
};

type AsyncTask = Array<() => Promise<void>>;

export function createServerMutators(
  clientMutators: CustomMutatorDefs,
  authData: AuthData,
  asyncTasks: AsyncTask
) {
  return {
    // Reuse all client mutators
    ...clientMutators,
  } as const;
}
