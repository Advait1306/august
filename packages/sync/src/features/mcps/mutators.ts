import { defineMutator } from "@rocicorp/zero";
import { z } from "zod";

export const mcpMutators = {
  delete: defineMutator(
    z.object({
      mcp_id: z.string(),
    }),
    async ({ tx, args: { mcp_id } }) => {
      await tx.mutate.mcps.delete({ id: mcp_id });
    }
  ),
};
