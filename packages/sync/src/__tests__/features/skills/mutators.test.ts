import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  MockDataStore,
  createMockTransaction,
  createMockContext,
  setSharedStore,
  type MockTransaction,
  type MockContext,
} from "../../helpers/mock-zero";
import {
  createSkillFixture,
  createSkillDocumentFixture,
} from "../../helpers/fixtures";

// Use vi.hoisted to create mock before vi.mock is hoisted
const mockZeroSchema = vi.hoisted(() => {
  // Relationship definitions for .related() support
  const RELATIONSHIPS: Record<string, Record<string, { sourceField: string; destTable: string; destField: string }>> = {
    skillDocuments: {
      skill: { sourceField: "skill_id", destTable: "skills", destField: "id" },
    },
    turns: {
      task: { sourceField: "task_id", destTable: "tasks", destField: "id" },
    },
    blocks: {
      turn: { sourceField: "turn_id", destTable: "turns", destField: "id" },
    },
  };

  class InlineMockQueryBuilder<T = any> {
    private store: any;
    private tableName: string;
    private conditions: Array<(row: any) => boolean> = [];
    private relatedQueries: Array<{ relationName: string; queryFn?: (q: any) => any }> = [];
    private orderByField?: string;
    private orderByDirection: "asc" | "desc" = "asc";
    private limitCount?: number;

    constructor(store: any, tableName: string) {
      this.store = store;
      this.tableName = tableName;
    }

    where(field: string, value: any): this {
      this.conditions.push((row) => row[field] === value);
      return this;
    }

    related(relationName: string, queryFn?: (q: any) => any): this {
      this.relatedQueries.push({ relationName, queryFn });
      return this;
    }

    orderBy(field: string, direction: "asc" | "desc" = "asc"): this {
      this.orderByField = field;
      this.orderByDirection = direction;
      return this;
    }

    limit(count: number): this {
      this.limitCount = count;
      return this;
    }

    one(): T | undefined {
      const results = this._execute();
      return results[0];
    }

    execute(): T[] {
      return this._execute();
    }

    private _execute(): T[] {
      let results = this.store.getAll(this.tableName);

      // Apply direct conditions
      for (const condition of this.conditions) {
        results = results.filter(condition);
      }

      // Apply related conditions and populate related data
      for (const { relationName, queryFn } of this.relatedQueries) {
        const rel = RELATIONSHIPS[this.tableName]?.[relationName];
        if (rel) {
          results = results
            .map((row: any) => {
              const foreignKey = row[rel.sourceField];
              if (!foreignKey) return { ...row, [relationName]: undefined };

              // Create a query builder for the related table and apply the query function
              const relatedQuery = new InlineMockQueryBuilder(this.store, rel.destTable);
              relatedQuery.where(rel.destField, foreignKey);
              const configured = queryFn ? queryFn(relatedQuery) : relatedQuery;
              const relatedResults = configured._execute();

              // Populate the related data on the result (first match for one-to-one)
              return { ...row, [relationName]: relatedResults[0] };
            })
            .filter((row: any) => row[relationName] !== undefined);
        }
      }

      if (this.orderByField) {
        const field = this.orderByField;
        results.sort((a: any, b: any) => {
          const cmp = a[field] < b[field] ? -1 : a[field] > b[field] ? 1 : 0;
          return this.orderByDirection === "asc" ? cmp : -cmp;
        });
      }
      if (this.limitCount !== undefined) {
        results = results.slice(0, this.limitCount);
      }
      return results;
    }
  }

  return {
    get builder() {
      const store = globalThis.__mockZeroStore;
      if (!store) throw new Error("Store not set");
      return new Proxy({}, {
        get: (_target: any, tableName: string) => {
          return new InlineMockQueryBuilder(store, tableName);
        },
      });
    },
  };
});

// Mock the Zero schema builder
vi.mock("../../../zero/schema", () => mockZeroSchema);

import {
  skillMutators,
  skillDocumentMutators,
} from "../../../features/skills/mutators";

describe("skills/mutators", () => {
  let store: MockDataStore;
  let tx: MockTransaction;
  let ctx: MockContext;

  beforeEach(() => {
    store = new MockDataStore();
    setSharedStore(store);
    tx = createMockTransaction(store);
    ctx = createMockContext("user-1", "org-1");
  });

  describe("skillMutators", () => {
    describe("create", () => {
      it("should insert skill with organisation_id from context", async () => {
        await skillMutators.create.fn({
          tx,
          ctx,
          args: {
            id: "skill-1",
            name: "Test Skill",
            prompt: "You are helpful",
            description: "A test skill",
          },
        });

        const skill = store.get("skills", "skill-1");
        expect(skill).toBeDefined();
        expect(skill?.organisation_id).toBe("org-1");
      });

      it("should insert skill with author_id from context", async () => {
        await skillMutators.create.fn({
          tx,
          ctx,
          args: {
            id: "skill-1",
            name: "Test Skill",
            prompt: "You are helpful",
            description: "A test skill",
          },
        });

        const skill = store.get("skills", "skill-1");
        expect(skill?.author_id).toBe("user-1");
      });

      it("should set created_at and updated_at timestamps", async () => {
        const before = Date.now();

        await skillMutators.create.fn({
          tx,
          ctx,
          args: {
            id: "skill-1",
            name: "Test Skill",
            prompt: "You are helpful",
            description: "A test skill",
          },
        });

        const after = Date.now();
        const skill = store.get("skills", "skill-1");

        expect(skill?.created_at).toBeGreaterThanOrEqual(before);
        expect(skill?.created_at).toBeLessThanOrEqual(after);
        expect(skill?.updated_at).toBeGreaterThanOrEqual(before);
        expect(skill?.updated_at).toBeLessThanOrEqual(after);
      });
    });

    describe("update", () => {
      beforeEach(() => {
        store.set(
          "skills",
          "skill-1",
          createSkillFixture({
            id: "skill-1",
            organisation_id: "org-1",
            name: "Original Name",
            prompt: "Original prompt",
            description: "Original description",
          })
        );
      });

      it("should update skill fields when provided", async () => {
        await skillMutators.update.fn({
          tx,
          ctx,
          args: {
            id: "skill-1",
            name: "Updated Name",
            prompt: "Updated prompt",
            description: "Updated description",
          },
        });

        const skill = store.get("skills", "skill-1");
        expect(skill?.name).toBe("Updated Name");
        expect(skill?.prompt).toBe("Updated prompt");
        expect(skill?.description).toBe("Updated description");
      });

      it("should only update provided fields", async () => {
        await skillMutators.update.fn({
          tx,
          ctx,
          args: {
            id: "skill-1",
            name: "Only Name Updated",
          },
        });

        const skill = store.get("skills", "skill-1");
        expect(skill?.name).toBe("Only Name Updated");
        expect(skill?.prompt).toBe("Original prompt");
        expect(skill?.description).toBe("Original description");
      });

      it("should update updated_at timestamp", async () => {
        const before = Date.now();

        await skillMutators.update.fn({
          tx,
          ctx,
          args: {
            id: "skill-1",
            name: "Updated",
          },
        });

        const skill = store.get("skills", "skill-1");
        expect(skill?.updated_at).toBeGreaterThanOrEqual(before);
      });

      it("should throw error when skill not found", async () => {
        await expect(
          skillMutators.update.fn({
            tx,
            ctx,
            args: {
              id: "nonexistent",
              name: "New Name",
            },
          })
        ).rejects.toThrow("Skill not found");
      });

      it("should throw error when skill belongs to different organisation", async () => {
        store.set(
          "skills",
          "skill-2",
          createSkillFixture({
            id: "skill-2",
            organisation_id: "other-org",
          })
        );

        await expect(
          skillMutators.update.fn({
            tx,
            ctx,
            args: {
              id: "skill-2",
              name: "New Name",
            },
          })
        ).rejects.toThrow("Skill not found");
      });
    });

    describe("delete", () => {
      beforeEach(() => {
        store.set(
          "skills",
          "skill-1",
          createSkillFixture({
            id: "skill-1",
            organisation_id: "org-1",
          })
        );
      });

      it("should delete skill by id", async () => {
        await skillMutators.delete.fn({
          tx,
          ctx,
          args: { id: "skill-1" },
        });

        const skill = store.get("skills", "skill-1");
        expect(skill).toBeUndefined();
      });

      it("should throw error when skill not found", async () => {
        await expect(
          skillMutators.delete.fn({
            tx,
            ctx,
            args: { id: "nonexistent" },
          })
        ).rejects.toThrow("Skill not found");
      });

      it("should throw error when skill belongs to different organisation", async () => {
        store.set(
          "skills",
          "skill-2",
          createSkillFixture({
            id: "skill-2",
            organisation_id: "other-org",
          })
        );

        await expect(
          skillMutators.delete.fn({
            tx,
            ctx,
            args: { id: "skill-2" },
          })
        ).rejects.toThrow("Skill not found");
      });
    });
  });

  describe("skillDocumentMutators", () => {
    beforeEach(() => {
      store.set(
        "skills",
        "skill-1",
        createSkillFixture({
          id: "skill-1",
          organisation_id: "org-1",
        })
      );
    });

    describe("create", () => {
      it("should validate skill exists and belongs to organisation", async () => {
        await skillDocumentMutators.create.fn({
          tx,
          ctx,
          args: {
            id: "doc-1",
            skill_id: "skill-1",
            name: "README.md",
            content: "# Test",
            description: "Test doc",
          },
        });

        const doc = store.get("skillDocuments", "doc-1");
        expect(doc).toBeDefined();
        expect(doc?.skill_id).toBe("skill-1");
      });

      it("should insert document with skill_id", async () => {
        await skillDocumentMutators.create.fn({
          tx,
          ctx,
          args: {
            id: "doc-1",
            skill_id: "skill-1",
            name: "README.md",
            content: "# Content",
            description: "Description",
          },
        });

        const doc = store.get("skillDocuments", "doc-1");
        expect(doc?.name).toBe("README.md");
        expect(doc?.content).toBe("# Content");
        expect(doc?.description).toBe("Description");
      });

      it("should throw error when skill not found", async () => {
        await expect(
          skillDocumentMutators.create.fn({
            tx,
            ctx,
            args: {
              id: "doc-1",
              skill_id: "nonexistent",
              name: "README.md",
              content: "# Test",
              description: "Test",
            },
          })
        ).rejects.toThrow("Skill not found");
      });

      it("should throw error when skill belongs to different organisation", async () => {
        store.set(
          "skills",
          "skill-2",
          createSkillFixture({
            id: "skill-2",
            organisation_id: "other-org",
          })
        );

        await expect(
          skillDocumentMutators.create.fn({
            tx,
            ctx,
            args: {
              id: "doc-1",
              skill_id: "skill-2",
              name: "README.md",
              content: "# Test",
              description: "Test",
            },
          })
        ).rejects.toThrow("Skill not found");
      });
    });

    describe("update", () => {
      beforeEach(() => {
        store.set(
          "skillDocuments",
          "doc-1",
          createSkillDocumentFixture({
            id: "doc-1",
            skill_id: "skill-1",
            name: "Original.md",
            content: "Original content",
            description: "Original desc",
          })
        );
      });

      it("should update document fields", async () => {
        await skillDocumentMutators.update.fn({
          tx,
          ctx,
          args: {
            id: "doc-1",
            name: "Updated.md",
            content: "Updated content",
          },
        });

        const doc = store.get("skillDocuments", "doc-1");
        expect(doc?.name).toBe("Updated.md");
        expect(doc?.content).toBe("Updated content");
      });

      it("should validate ownership via skill relation", async () => {
        // Doc belongs to skill owned by different org
        store.set(
          "skills",
          "skill-other",
          createSkillFixture({
            id: "skill-other",
            organisation_id: "other-org",
          })
        );
        store.set(
          "skillDocuments",
          "doc-other",
          createSkillDocumentFixture({
            id: "doc-other",
            skill_id: "skill-other",
          })
        );

        await expect(
          skillDocumentMutators.update.fn({
            tx,
            ctx,
            args: {
              id: "doc-other",
              name: "Hacked.md",
            },
          })
        ).rejects.toThrow("Document not found or access denied");
      });

      it("should throw error when document not found", async () => {
        await expect(
          skillDocumentMutators.update.fn({
            tx,
            ctx,
            args: {
              id: "nonexistent",
              name: "New.md",
            },
          })
        ).rejects.toThrow("Document not found or access denied");
      });
    });

    describe("delete", () => {
      beforeEach(() => {
        store.set(
          "skillDocuments",
          "doc-1",
          createSkillDocumentFixture({
            id: "doc-1",
            skill_id: "skill-1",
          })
        );
      });

      it("should delete document by id", async () => {
        await skillDocumentMutators.delete.fn({
          tx,
          ctx,
          args: { id: "doc-1" },
        });

        const doc = store.get("skillDocuments", "doc-1");
        expect(doc).toBeUndefined();
      });

      it("should validate ownership via skill relation", async () => {
        store.set(
          "skills",
          "skill-other",
          createSkillFixture({
            id: "skill-other",
            organisation_id: "other-org",
          })
        );
        store.set(
          "skillDocuments",
          "doc-other",
          createSkillDocumentFixture({
            id: "doc-other",
            skill_id: "skill-other",
          })
        );

        await expect(
          skillDocumentMutators.delete.fn({
            tx,
            ctx,
            args: { id: "doc-other" },
          })
        ).rejects.toThrow("Document not found or access denied");
      });

      it("should throw error when document not found or access denied", async () => {
        await expect(
          skillDocumentMutators.delete.fn({
            tx,
            ctx,
            args: { id: "nonexistent" },
          })
        ).rejects.toThrow("Document not found or access denied");
      });
    });
  });
});
