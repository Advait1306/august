import { defineMutator } from "@rocicorp/zero";
import { z } from "zod";
import { runtimeMutators } from "./mutators";

export function createRuntimeServerMutators() {
  return {
    runtimes: {
      register: defineMutator(
        z.object({
          runtime_id: z.string(),
          tools: z.array(z.object({ name: z.string(), version: z.string() })),
        }),
        async ({ tx, ctx, args: { runtime_id, tools } }) => {
          // Run the base mutator
          await runtimeMutators.register.fn({
            tx,
            ctx,
            args: { runtime_id, tools },
          });
        }
      ),
    },
  };
}
