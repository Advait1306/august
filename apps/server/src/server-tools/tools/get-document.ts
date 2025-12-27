import { z } from "zod";
import { eq } from "drizzle-orm";
import { skillDocuments } from "@jupiter/sync/db/schema";
import type { ServerToolContext, ServerToolDefinition } from "../types";

/**
 * Input schema for the get_document tool
 */
export const GetDocumentInputSchema = z.object({
  documentId: z.string().describe("The ID of the document to retrieve"),
});

export type GetDocumentInput = z.infer<typeof GetDocumentInputSchema>;

/**
 * Output schema for the get_document tool
 */
export const GetDocumentOutputSchema = z.object({
  id: z.string().describe("The document ID"),
  name: z.string().describe("The document name"),
  content: z.string().describe("The full document content"),
  description: z
    .string()
    .nullable()
    .describe("A brief description of the document"),
});

export type GetDocumentOutput = z.infer<typeof GetDocumentOutputSchema>;

/**
 * get_document tool definition
 *
 * Retrieves a skill document by ID, returning its full content.
 * Use this after calling get_skill to retrieve specific document contents.
 */
export const getDocumentToolDefinition: ServerToolDefinition = {
  name: "get_document",
  version: "0.0.1",
  description:
    "Retrieves a skill document by ID, returning its full content. Use this to get detailed information from a specific document after discovering it via get_skill.",
  inputSchema: GetDocumentInputSchema,
  outputSchema: GetDocumentOutputSchema,
  execute: async (input: unknown, context: ServerToolContext) => {
    const { db } = context;
    const parsed = GetDocumentInputSchema.parse(input);

    const document = await db.query.skillDocuments.findFirst({
      where: eq(skillDocuments.id, parsed.documentId),
    });

    if (!document) {
      throw new Error(`Document not found: ${parsed.documentId}`);
    }

    return {
      id: document.id,
      name: document.name,
      content: document.content,
      description: document.description,
    };
  },
};
