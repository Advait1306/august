import { Mutators } from "@jupiter/sync/mutators/data";
import { Schema } from "@jupiter/sync/zero/schema";
import { createUseZero } from "@rocicorp/zero/react";

export const useZero = createUseZero<Schema, Mutators>();
