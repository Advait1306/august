import { defineQuery } from "@rocicorp/zero";
import { builder } from "../../zero/schema";

export const organisationQueries = {
  current: defineQuery(({ ctx }) => {
    return builder.organisations.where("id", ctx.orgId).one();
  }),
};

export const usageQueries = {
  recent: defineQuery(({ ctx }) => {
    return builder.usage
      .where("organisation_id", ctx.orgId)
      .orderBy("created_at", "desc")
      .limit(50);
  }),
};

export const dodoCustomerPortalQueries = {
  current: defineQuery(({ ctx }) => {
    return builder.dodoCustomerPortal.where("organisation_id", ctx.orgId).one();
  }),
};
