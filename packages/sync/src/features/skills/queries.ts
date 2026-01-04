import { defineQuery } from "@rocicorp/zero";
import { z } from "zod";
import { builder } from "../../zero/schema";

export const skillQueries = {
  all: defineQuery(({ ctx }) => {
    return builder.skills
      .where("organisation_id", ctx.orgId)
      .orderBy("created_at", "desc");
  }),
};

export const skillDocumentQueries = {
  bySkill: defineQuery(
    z.object({ skillId: z.string() }),
    ({ args: { skillId } }) => {
      return builder.skillDocuments
        .where("skill_id", skillId)
        .orderBy("created_at", "asc");
    }
  ),
};
