import {
  createBuilder,
  definePermissions,
  Schema as ZeroSchema,
} from "@rocicorp/zero";

import { schema as genSchema } from "./zero-schema.gen";

export const schema = {
  ...genSchema,
  enableLegacyQueries: false,
  enableLegacyMutators: false,
} as const satisfies ZeroSchema;

export const permissions: ReturnType<typeof definePermissions> =
  definePermissions<unknown, ZeroSchema>(schema, () => ({}));

export const builder = createBuilder(schema);

export type Schema = typeof schema;
