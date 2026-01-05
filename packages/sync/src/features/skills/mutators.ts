import { defineMutator } from "@rocicorp/zero";
import { z } from "zod";
import { builder } from "../../zero/schema";

export const skillMutators = {
  create: defineMutator(
    z.object({
      id: z.string(),
      name: z.string(),
      prompt: z.string(),
      description: z.string(),
    }),
    async ({ tx, ctx, args: { id, name, prompt, description } }) => {
      await tx.mutate.skills.insert({
        id,
        organisation_id: ctx.orgId,
        author_id: ctx.userId,
        name,
        prompt,
        description,
        created_at: Date.now(),
        updated_at: Date.now(),
      });
    }
  ),
  update: defineMutator(
    z.object({
      id: z.string(),
      name: z.string().optional(),
      prompt: z.string().optional(),
      description: z.string().optional(),
    }),
    async ({ tx, ctx, args: { id, name, prompt, description } }) => {
      const skill = await tx.run(
        builder.skills
          .where("id", id)
          .where("organisation_id", ctx.orgId)
          .one()
      );

      if (!skill) {
        throw new Error("Skill not found");
      }

      await tx.mutate.skills.update({
        id,
        ...(name !== undefined && { name }),
        ...(prompt !== undefined && { prompt }),
        ...(description !== undefined && { description }),
        updated_at: Date.now(),
      });
    }
  ),
  delete: defineMutator(
    z.object({
      id: z.string(),
    }),
    async ({ tx, ctx, args: { id } }) => {
      const skill = await tx.run(
        builder.skills
          .where("id", id)
          .where("organisation_id", ctx.orgId)
          .one()
      );

      if (!skill) {
        throw new Error("Skill not found");
      }

      await tx.mutate.skills.delete({ id });
    }
  ),
};

export const skillDocumentMutators = {
  create: defineMutator(
    z.object({
      id: z.string(),
      skill_id: z.string(),
      name: z.string(),
      content: z.string(),
      description: z.string(),
    }),
    async ({ tx, ctx, args: { id, skill_id, name, content, description } }) => {
      const skill = await tx.run(
        builder.skills
          .where("id", skill_id)
          .where("organisation_id", ctx.orgId)
          .one()
      );

      if (!skill) {
        throw new Error("Skill not found");
      }

      await tx.mutate.skillDocuments.insert({
        id,
        skill_id,
        name,
        content,
        description,
        created_at: Date.now(),
        updated_at: Date.now(),
      });
    }
  ),
  update: defineMutator(
    z.object({
      id: z.string(),
      name: z.string().optional(),
      content: z.string().optional(),
      description: z.string().optional(),
    }),
    async ({ tx, ctx, args: { id, name, content, description } }) => {
      const doc = await tx.run(
        builder.skillDocuments
          .where("id", id)
          .related("skill", (q) => q.where("organisation_id", ctx.orgId))
          .one()
      );

      if (!doc || !doc.skill) {
        throw new Error("Document not found or access denied");
      }

      await tx.mutate.skillDocuments.update({
        id,
        ...(name !== undefined && { name }),
        ...(content !== undefined && { content }),
        ...(description !== undefined && { description }),
        updated_at: Date.now(),
      });
    }
  ),
  delete: defineMutator(
    z.object({
      id: z.string(),
    }),
    async ({ tx, ctx, args: { id } }) => {
      const doc = await tx.run(
        builder.skillDocuments
          .where("id", id)
          .related("skill", (q) => q.where("organisation_id", ctx.orgId))
          .one()
      );

      if (!doc || !doc.skill) {
        throw new Error("Document not found or access denied");
      }

      await tx.mutate.skillDocuments.delete({ id });
    }
  ),
};
