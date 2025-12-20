import { createBuilder, Schema as ZeroSchema } from "@rocicorp/zero";

import { schema as genSchema } from "./zero-schema.gen";

export const schema = {
  ...genSchema,
  enableLegacyQueries: false,
  enableLegacyMutators: false,
} as const satisfies ZeroSchema;

export const builder = createBuilder(schema);

export type Schema = typeof schema;

export type AuthData = {
  userId: string;
  orgId: string;
};

declare module "@rocicorp/zero" {
  interface DefaultTypes {
    schema: Schema;
    context: AuthData;
  }
}
