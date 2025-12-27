import { z } from "zod";
import { eq } from "drizzle-orm";
import { skills } from "@jupiter/sync/db/schema";
import type { ServerToolContext, ServerToolDefinition } from "../types";

/**
 * Input schema for the get_skill tool
 */
export const GetSkillInputSchema = z.object({
  skillId: z.string().describe("The ID of the skill to retrieve"),
});

export type GetSkillInput = z.infer<typeof GetSkillInputSchema>;

/**
 * Schema for a document summary (returned with skill)
 */
const DocumentSummarySchema = z.object({
  id: z.string().describe("The document ID"),
  name: z.string().describe("The document name"),
  description: z
    .string()
    .nullable()
    .describe("A brief description of the document"),
});

/**
 * Output schema for the get_skill tool
 */
export const GetSkillOutputSchema = z.object({
  id: z.string().describe("The skill ID"),
  name: z.string().describe("The skill name"),
  prompt: z.string().describe("The skill prompt/definition"),
  description: z
    .string()
    .nullable()
    .describe("A brief description of the skill"),
  documents: z
    .array(DocumentSummarySchema)
    .describe("List of supporting documents for this skill"),
});

export type GetSkillOutput = z.infer<typeof GetSkillOutputSchema>;

/**
 * get_skill tool definition
 *
 * Retrieves a skill by ID along with its list of documents.
 * Use this to get the full skill prompt and see what documents are available.
 */
export const getSkillToolDefinition: ServerToolDefinition = {
  name: "get_skill",
  version: "0.0.1",
  description:
    "Retrieves a skill by ID, returning its prompt and list of available documents. Use this to get detailed information about a skill and discover what supporting documents are available.",
  inputSchema: GetSkillInputSchema,
  outputSchema: GetSkillOutputSchema,
  execute: async (input: unknown, context: ServerToolContext) => {
    const { db } = context;
    const parsed = GetSkillInputSchema.parse(input);

    // Query skill with its documents
    const skill = await db.query.skills.findFirst({
      where: eq(skills.id, parsed.skillId),
      with: {
        documents: true,
      },
    });

    if (!skill) {
      throw new Error(`Skill not found: ${parsed.skillId}`);
    }

    return {
      id: skill.id,
      name: skill.name,
      prompt: skill.prompt,
      description: skill.description,
      documents: skill.documents.map((doc) => ({
        id: doc.id,
        name: doc.name,
        description: doc.description,
      })),
    };
  },
};
