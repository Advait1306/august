import { defineMutator } from "@rocicorp/zero";
import { z } from "zod";

export const runtimeMutators = {
  register: defineMutator(
    z.object({
      runtime_id: z.string(),
      tools: z.array(z.object({ name: z.string(), version: z.string() })),
    }),
    async ({ tx, ctx, args: { runtime_id, tools } }) => {
      await tx.mutate.runtimes.upsert({
        id: runtime_id,
        user_id: ctx.userId,
        tools,
        created_at: Date.now(),
        updated_at: Date.now(),
      });
    }
  ),
};
