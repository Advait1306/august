import { defineMutators } from "@rocicorp/zero";
import {
  taskMutators,
  messageMutators,
  toolMutators,
} from "../features/tasks/mutators";
import {
  skillMutators,
  skillDocumentMutators,
} from "../features/skills/mutators";
import { mcpMutators } from "../features/mcps/mutators";
import { dodoCustomerPortalMutators } from "../features/organisation/mutators";
import { runtimeMutators } from "../features/runtimes/mutators";

export const mutators = defineMutators({
  tasks: taskMutators,
  message: messageMutators,
  tools: toolMutators,
  mcps: mcpMutators,
  runtimes: runtimeMutators,
  skills: skillMutators,
  dodoCustomerPortal: dodoCustomerPortalMutators,
  skillDocuments: skillDocumentMutators,
});

export type Mutators = typeof mutators;
