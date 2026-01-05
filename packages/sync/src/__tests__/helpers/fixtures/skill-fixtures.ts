/**
 * Test fixtures for skill-related entities: skills, skillDocuments
 */

export interface SkillFixture {
  id: string;
  organisation_id: string;
  author_id: string;
  name: string;
  prompt: string;
  description: string;
  created_at: number;
  updated_at: number;
}

export interface SkillDocumentFixture {
  id: string;
  skill_id: string;
  name: string;
  content: string;
  description: string;
  created_at: number;
  updated_at: number;
}

export interface TaskSkillFixture {
  task_id: string;
  skill_id: string;
}

export function createSkillFixture(
  overrides: Partial<SkillFixture> = {}
): SkillFixture {
  return {
    id: "skill-1",
    organisation_id: "test-org-id",
    author_id: "test-user-id",
    name: "Test Skill",
    prompt: "You are a helpful assistant that helps with testing.",
    description: "A test skill for unit tests",
    created_at: Date.now(),
    updated_at: Date.now(),
    ...overrides,
  };
}

export function createSkillDocumentFixture(
  overrides: Partial<SkillDocumentFixture> = {}
): SkillDocumentFixture {
  return {
    id: "doc-1",
    skill_id: "skill-1",
    name: "README.md",
    content: "# Test Document\n\nThis is a test document.",
    description: "A test document for the skill",
    created_at: Date.now(),
    updated_at: Date.now(),
    ...overrides,
  };
}

export function createTaskSkillFixture(
  overrides: Partial<TaskSkillFixture> = {}
): TaskSkillFixture {
  return {
    task_id: "task-1",
    skill_id: "skill-1",
    ...overrides,
  };
}
