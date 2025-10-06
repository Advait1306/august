import { createBuilder, definePermissions } from "@rocicorp/zero";
import { schema, type Schema } from "./zero-schema.gen";

export { schema, type Schema };

export const permissions: ReturnType<typeof definePermissions> =
  definePermissions<unknown, Schema>(schema, () => ({}));

export const builder = createBuilder(schema);
