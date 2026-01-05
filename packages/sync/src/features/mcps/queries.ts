import { defineQuery } from "@rocicorp/zero";
import { builder } from "../../zero/schema";

export const mcpQueries = {
  all: defineQuery(({ ctx }) => {
    return builder.mcps
      .where("author_id", ctx.userId)
      .where("organisation_id", ctx.orgId)
      .orderBy("created_at", "desc");
  }),
};

export const mcpStoreQueries = {
  active: defineQuery(() => {
    return builder.mcpStore
      .where("is_active", 1)
      .orderBy("sort_order", "asc");
  }),
};
