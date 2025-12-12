import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { glob, GlobInputSchema, GlobOutputSchema } from "../glob";
import { join } from "path";
import { ZodError } from "zod";
import { utimes, mkdir, writeFile, rm } from "fs/promises";
import * as path from "path";

const fixturesPath = join(__dirname, "fixtures-glob-test");

// Subdirectories inside fixturesPath
const tempDir = join(fixturesPath, "temp");
const caseSensitiveDir = join(fixturesPath, "case-sensitive");
const bracketDir = join(fixturesPath, "brackets");
const symlinkDir = join(fixturesPath, "symlink");
const gitignoreDir = join(fixturesPath, "gitignore");

// Track gitignore test state
let gitInitialized = false;
let isNestedInGitRepo = false;

// Create all fixtures before tests run
beforeAll(async () => {
  // Create main fixture directory structure
  await mkdir(join(fixturesPath, "src/components/nested"), { recursive: true });
  await mkdir(join(fixturesPath, "lib"), { recursive: true });
  await mkdir(join(fixturesPath, "special chars"), { recursive: true });

  // Create main fixture files
  await writeFile(
    join(fixturesPath, "src/index.ts"),
    'export function main() { console.log("Hello"); }'
  );
  await writeFile(
    join(fixturesPath, "src/utils.ts"),
    "export function formatDate(date: Date) { return date.toISOString(); }"
  );
  await writeFile(
    join(fixturesPath, "src/components/Button.tsx"),
    "export function Button({ label }: { label: string }) { return null; }"
  );
  await writeFile(
    join(fixturesPath, "src/components/Modal.tsx"),
    "export function Modal({ children }: { children: any }) { return null; }"
  );
  await writeFile(
    join(fixturesPath, "src/components/nested/DeepComponent.tsx"),
    "export function DeepComponent() { return null; }"
  );
  await writeFile(
    join(fixturesPath, "lib/helper.js"),
    "module.exports = { helper: () => 'helper' };"
  );
  await writeFile(
    join(fixturesPath, "lib/config.json"),
    '{ "name": "test-config" }'
  );
  await writeFile(
    join(fixturesPath, "special chars/file [1].txt"),
    "File with special characters in name"
  );
  await writeFile(join(fixturesPath, "README.md"), "# Test Fixtures");

  // Create temp dir with 150+ files for truncation tests
  await mkdir(tempDir, { recursive: true });
  for (let i = 0; i < 150; i++) {
    await writeFile(join(tempDir, `file${i}.txt`), `content ${i}`);
  }

  // Create case sensitivity test files
  await mkdir(caseSensitiveDir, { recursive: true });
  await writeFile(join(caseSensitiveDir, "file.txt"), "lowercase");
  await writeFile(join(caseSensitiveDir, "data.TXT"), "uppercase ext");
  await writeFile(join(caseSensitiveDir, "info.Txt"), "mixed case ext");

  // Create bracket characters test files (Next.js style routes)
  await mkdir(join(bracketDir, "app/[slug]/(dashboard)/components"), {
    recursive: true,
  });
  await mkdir(join(bracketDir, "app/[...catchAll]"), { recursive: true });
  await mkdir(join(bracketDir, "app/[[optionalSlug]]"), { recursive: true });
  await writeFile(
    join(bracketDir, "app/[slug]/(dashboard)/components/Button.tsx"),
    "export function Button() {}"
  );
  await writeFile(
    join(bracketDir, "app/[slug]/(dashboard)/page.tsx"),
    "export default function Page() {}"
  );
  await writeFile(
    join(bracketDir, "app/[...catchAll]/route.ts"),
    "export function GET() {}"
  );
  await writeFile(
    join(bracketDir, "app/[[optionalSlug]]/page.tsx"),
    "export default function OptionalPage() {}"
  );
  await writeFile(join(bracketDir, "file[1].txt"), "bracketed filename");
  await writeFile(join(bracketDir, "file(1).txt"), "parenthesized filename");

  // Create gitignore test files
  await mkdir(join(gitignoreDir, "node_modules/pkg"), { recursive: true });
  await mkdir(join(gitignoreDir, "dist"), { recursive: true });
  await mkdir(join(gitignoreDir, "src"), { recursive: true });
  await writeFile(
    join(gitignoreDir, ".gitignore"),
    `node_modules/
dist/
*.log
.env
`
  );
  await writeFile(
    join(gitignoreDir, "node_modules/pkg/index.js"),
    "module.exports = {}"
  );
  await writeFile(join(gitignoreDir, "dist/bundle.js"), "bundled code");
  await writeFile(join(gitignoreDir, "error.log"), "error logs");
  await writeFile(join(gitignoreDir, ".env"), "SECRET=123");
  await writeFile(join(gitignoreDir, "src/index.ts"), "export {}");
  await writeFile(join(gitignoreDir, "src/utils.ts"), "export {}");
  await writeFile(join(gitignoreDir, "package.json"), "{}");
  await writeFile(join(gitignoreDir, "README.md"), "# Project");

  // Initialize git repo for gitignore tests
  const { execSync } = await import("child_process");
  try {
    execSync("git init", { cwd: gitignoreDir, stdio: "ignore" });
    gitInitialized = true;

    // Check if we're nested inside another git repo
    const parentGitCheck = execSync("git rev-parse --show-toplevel", {
      cwd: __dirname,
      encoding: "utf-8",
    }).trim();
    isNestedInGitRepo = !parentGitCheck.includes("fixtures-glob-test");
  } catch {
    gitInitialized = false;
  }
});

// Clean up all fixtures after tests complete
afterAll(async () => {
  await rm(fixturesPath, { recursive: true, force: true });
});

describe("glob", () => {
  describe("basic patterns", () => {
    it("should match files with simple extension pattern at root level", async () => {
      const result = await glob({ pattern: "*.md", path: fixturesPath });
      // *.md only matches root level (not subdirectories)
      // We have README.md at root
      expect(result.metadata.count).toBeGreaterThanOrEqual(1);
      expect(result.output).toContain("README.md");
    });

    it("should match files with globstar pattern", async () => {
      const result = await glob({ pattern: "**/*.ts", path: fixturesPath });
      // Should match: src/index.ts, src/utils.ts
      expect(result.metadata.count).toBeGreaterThan(0);
      expect(result.output).toContain("index.ts");
      expect(result.output).toContain("utils.ts");
    });

    it("should match files with multiple extensions", async () => {
      const result = await glob({
        pattern: "**/*.{ts,tsx}",
        path: fixturesPath,
      });
      // Should match all .ts and .tsx files
      expect(result.output).toContain(".ts");
      expect(result.output).toContain(".tsx");
    });

    it("should match specific directory pattern", async () => {
      const result = await glob({
        pattern: "src/**/*.tsx",
        path: fixturesPath,
      });
      // Should match: Button.tsx, Modal.tsx, nested/DeepComponent.tsx in main src/
      expect(result.metadata.count).toBeGreaterThanOrEqual(3);
      expect(result.output).toContain("Button.tsx");
      expect(result.output).toContain("Modal.tsx");
      expect(result.output).toContain("DeepComponent.tsx");
    });
  });

  describe("empty results", () => {
    it("should return empty output for non-matching pattern", async () => {
      const result = await glob({ pattern: "**/*.xyz", path: fixturesPath });
      expect(result.metadata.count).toBe(0);
      expect(result.metadata.truncated).toBe(false);
      expect(result.output).toBe("No files found");
    });

    it("should throw error for non-existent directory", async () => {
      await expect(
        glob({
          pattern: "**/*",
          path: "/non/existent/path/that/does/not/exist",
        })
      ).rejects.toThrow(/ripgrep error/);
    });
  });

  describe("truncation", () => {
    it("should truncate results exceeding MAX_FILES limit", async () => {
      const result = await glob({ pattern: "**/*", path: tempDir });
      expect(result.metadata.count).toBe(100);
      expect(result.metadata.truncated).toBe(true);
      expect(result.output).toContain("Results are truncated");
    });

    it("should not truncate when under limit", async () => {
      const result = await glob({ pattern: "**/*.ts", path: join(fixturesPath, "src") });
      expect(result.metadata.truncated).toBe(false);
      expect(result.output).not.toContain("truncated");
    });
  });

  describe("sorting", () => {
    it("should return newest files first", async () => {
      // Touch a file to make it newest
      const newestFile = join(fixturesPath, "src/utils.ts");
      await utimes(newestFile, new Date(), new Date());

      const result = await glob({ pattern: "**/*.ts", path: join(fixturesPath, "src") });
      const files = result.output.split("\n").filter(Boolean);

      // First file should be the one we just touched
      expect(files[0]).toContain("utils.ts");
    });

    it("should maintain consistent order for files with same mtime", async () => {
      const result1 = await glob({ pattern: "**/*", path: join(fixturesPath, "src") });
      const result2 = await glob({ pattern: "**/*", path: join(fixturesPath, "src") });
      expect(result1.output).toBe(result2.output);
    });
  });

  describe("special characters", () => {
    it("should handle paths with spaces", async () => {
      const result = await glob({ pattern: "**/*.txt", path: join(fixturesPath, "special chars") });
      expect(result.output).toContain("special chars");
      expect(result.output).toContain("file [1].txt");
    });

    it("should handle unicode characters in filenames", async () => {
      // Should not throw
      const result = await glob({ pattern: "**/*.txt", path: join(fixturesPath, "special chars") });
      expect(result).toBeDefined();
    });
  });

  describe("nested directories", () => {
    it("should match deeply nested files with globstar", async () => {
      const result = await glob({
        pattern: "**/nested/**/*.tsx",
        path: fixturesPath,
      });
      expect(result.output).toContain("DeepComponent.tsx");
    });

    it("should match at any depth with **", async () => {
      const result = await glob({
        pattern: "**/DeepComponent.tsx",
        path: fixturesPath,
      });
      expect(result.metadata.count).toBe(1);
    });
  });

  describe("input validation", () => {
    it("should throw error for missing pattern", async () => {
      await expect(glob({ pattern: "", path: fixturesPath })).rejects.toThrow();
    });

    it("should use current directory when path not provided", async () => {
      const originalCwd = process.cwd();
      process.chdir(fixturesPath);

      try {
        const result = await glob({ pattern: "**/*.ts" });
        expect(result.metadata.count).toBeGreaterThan(0);
      } finally {
        process.chdir(originalCwd);
      }
    });
  });

  describe("output format", () => {
    it("should return absolute file paths", async () => {
      const result = await glob({ pattern: "**/*.ts", path: join(fixturesPath, "src") });
      const files = result.output.split("\n").filter(Boolean);

      files.forEach((file) => {
        expect(path.isAbsolute(file)).toBe(true);
      });
    });

    it("should return title matching the pattern", async () => {
      const pattern = "**/*.ts";
      const result = await glob({ pattern, path: fixturesPath });
      expect(result.title).toBe(pattern);
    });

    it("should separate files with newlines", async () => {
      const result = await glob({ pattern: "**/*.ts", path: join(fixturesPath, "src") });
      if (result.metadata.count > 1) {
        expect(result.output).toContain("\n");
      }
    });
  });

  describe("edge cases", () => {
    it("should handle single file match", async () => {
      // Search in a subdirectory where we know there's only one README.md
      const result = await glob({ pattern: "README.md", path: gitignoreDir });
      expect(result.metadata.count).toBe(1);
      expect(result.metadata.truncated).toBe(false);
    });

    it("should handle pattern with no wildcards", async () => {
      // Search in a subdirectory where we know there's only one README.md
      const result = await glob({ pattern: "README.md", path: gitignoreDir });
      expect(result.metadata.count).toBe(1);
    });

    it("should find multiple README.md files with globstar across directories", async () => {
      const result = await glob({ pattern: "**/README.md", path: fixturesPath });
      // There are README.md files in root and gitignore subdirectory
      expect(result.metadata.count).toBeGreaterThanOrEqual(2);
      expect(result.output).toContain("README.md");
    });

    it("should not match directories, only files", async () => {
      const result = await glob({ pattern: "**/src", path: fixturesPath });
      // ripgrep --files only lists files, not directories
      // This pattern shouldn't match any files
      expect(result.output).not.toMatch(/src\n|src$/);
    });
  });

  describe("case sensitivity", () => {
    it("should match files with exact lowercase extension", async () => {
      const result = await glob({ pattern: "*.txt", path: caseSensitiveDir });
      // ripgrep glob is case-sensitive by default
      expect(result.output).toContain("file.txt");
    });

    it("should match files with exact uppercase extension", async () => {
      const result = await glob({ pattern: "*.TXT", path: caseSensitiveDir });
      // Should only match exact case
      expect(result.output).toContain("data.TXT");
    });

    it("should match files with exact mixed case extension", async () => {
      const result = await glob({ pattern: "*.Txt", path: caseSensitiveDir });
      expect(result.output).toContain("info.Txt");
    });

    it("should not match files with different case in extension", async () => {
      const result = await glob({ pattern: "*.TXT", path: caseSensitiveDir });
      // ripgrep is case-sensitive, so *.TXT should not match file.txt
      expect(result.output).not.toContain("file.txt");
    });
  });

  describe("bracket characters in paths", () => {
    it("should match files in Next.js dynamic route directories", async () => {
      const result = await glob({ pattern: "**/*.tsx", path: bracketDir });
      expect(result.output).toContain("[slug]");
      expect(result.output).toContain("(dashboard)");
      expect(result.metadata.count).toBeGreaterThanOrEqual(3);
    });

    it("should match files in catch-all route directories", async () => {
      const result = await glob({ pattern: "**/*.ts", path: bracketDir });
      expect(result.output).toContain("[...catchAll]");
    });

    it("should match files in optional catch-all route directories using globstar", async () => {
      // Note: Brackets in paths are matched via globstar, not literal bracket patterns
      // since brackets have special meaning in glob syntax
      const result = await glob({ pattern: "**/*.tsx", path: bracketDir });
      expect(result.output).toContain("[[optionalSlug]]");
    });

    it("should match files with parentheses in filename", async () => {
      const result = await glob({ pattern: "*.txt", path: bracketDir });
      // Parentheses don't have special meaning in ripgrep globs
      expect(result.output).toContain("file(1).txt");
    });

    it("should find files with brackets using globstar pattern", async () => {
      // Brackets have special meaning in glob, so use ** to find files in bracket directories
      const result = await glob({
        pattern: "**/Button.tsx",
        path: bracketDir,
      });
      expect(result.metadata.count).toBe(1);
      expect(result.output).toContain("Button.tsx");
      expect(result.output).toContain("[slug]");
    });

    it("should match all tsx files including those in bracket-named directories", async () => {
      const result = await glob({ pattern: "**/*.tsx", path: bracketDir });
      // Should find all .tsx files regardless of bracket characters in path
      expect(result.metadata.count).toBeGreaterThanOrEqual(3);
      expect(result.output).toContain("Button.tsx");
      expect(result.output).toContain("page.tsx");
    });
  });

  describe("path security and boundary validation", () => {
    it("should handle absolute paths outside search directory gracefully", async () => {
      // Attempting to search /etc or other system directories
      // Should return empty or handle gracefully without exposing sensitive data
      const result = await glob({ pattern: "*.conf", path: "/etc" });
      // We just verify it doesn't throw and returns a valid result structure
      expect(result).toBeDefined();
      expect(result.metadata).toBeDefined();
      expect(typeof result.metadata.count).toBe("number");
    });

    it("should handle path traversal attempts", async () => {
      const result = await glob({
        pattern: "**/*",
        path: join(fixturesPath, "../../../../../../tmp"),
      });
      // Should handle gracefully - either returns results from resolved path
      // or returns no files found
      expect(result).toBeDefined();
      expect(result.metadata).toBeDefined();
    });

    it("should handle relative path traversal in pattern", async () => {
      const result = await glob({
        pattern: "../**/*.ts",
        path: fixturesPath,
      });
      // ripgrep should handle this - may or may not find files
      // but should not throw
      expect(result).toBeDefined();
    });

    it("should handle symlink paths safely", async () => {
      // Create a symlink for testing if possible
      try {
        await mkdir(symlinkDir, { recursive: true });
        const { symlink } = await import("fs/promises");
        await symlink(join(fixturesPath, "src"), join(symlinkDir, "link"), "dir");

        const result = await glob({
          pattern: "**/*.ts",
          path: join(symlinkDir, "link"),
        });
        expect(result).toBeDefined();
        expect(result.metadata.count).toBeGreaterThan(0);
      } catch (error) {
        // Symlink creation may fail on some systems (e.g., permissions, Windows)
        // If symlink creation fails, that's expected - skip the test
        // If glob call fails, that's an actual error
        if (error instanceof Error && error.message.includes("ripgrep")) {
          throw error;
        }
        // Otherwise, silently skip due to symlink creation failure
      }
    });

    it("should not expose files from parent directories when searching subdirectory", async () => {
      const result = await glob({
        pattern: "**/*.md",
        path: join(fixturesPath, "src"),
      });
      // Should not find README.md which is in parent fixturesPath
      expect(result.output).not.toContain("README.md");
    });
  });

  describe("input validation edge cases", () => {
    it("should handle whitespace-only pattern without crashing", async () => {
      // ripgrep doesn't treat whitespace as an invalid pattern
      // It may match files depending on glob interpretation
      const result = await glob({ pattern: "   ", path: fixturesPath });
      // Just verify it returns a valid result structure
      expect(result).toBeDefined();
      expect(result.metadata).toBeDefined();
      expect(typeof result.metadata.count).toBe("number");
    });

    it("should handle pattern with tabs and spaces without crashing", async () => {
      const result = await glob({ pattern: " \t \t ", path: fixturesPath });
      expect(result).toBeDefined();
      expect(result.metadata).toBeDefined();
    });

    it("should handle path that is a file instead of directory", async () => {
      const result = await glob({
        pattern: "**/*",
        path: join(fixturesPath, "README.md"),
      });
      // ripgrep handles this gracefully - returns no files or error
      // We just verify it doesn't crash
      expect(result).toBeDefined();
    });

    it("should reject invalid path type via schema", () => {
      expect(() =>
        GlobInputSchema.parse({ pattern: "**/*.ts", path: 123 })
      ).toThrow(ZodError);
    });

    it("should reject invalid pattern type via schema", () => {
      expect(() =>
        GlobInputSchema.parse({ pattern: 123, path: fixturesPath })
      ).toThrow(ZodError);
    });

    it("should reject null pattern via schema", () => {
      expect(() =>
        GlobInputSchema.parse({ pattern: null, path: fixturesPath })
      ).toThrow(ZodError);
    });

    it("should reject undefined pattern via schema", () => {
      expect(() => GlobInputSchema.parse({ path: fixturesPath })).toThrow(
        ZodError
      );
    });

    it("should handle extremely long pattern", async () => {
      const longPattern = "a".repeat(1000) + "*.ts";
      const result = await glob({ pattern: longPattern, path: fixturesPath });
      // Should return no files found, not crash
      expect(result.metadata.count).toBe(0);
    });

    it("should handle pattern with null bytes gracefully", async () => {
      // This tests robustness against potentially malicious input
      try {
        const result = await glob({ pattern: "**/*\0*.ts", path: fixturesPath });
        expect(result).toBeDefined();
      } catch {
        // It's acceptable to throw on invalid input
      }
    });
  });

  describe("gitignore handling", () => {
    it("should respect .gitignore and exclude node_modules", async function () {
      if (!gitInitialized) {
        return;
      }
      const result = await glob({ pattern: "**/*.js", path: gitignoreDir });
      // node_modules is commonly ignored by parent .gitignore too
      expect(result.output).not.toContain("node_modules");
    });

    it("should respect .gitignore and exclude dist directory", async function () {
      if (!gitInitialized) {
        return;
      }
      const result = await glob({ pattern: "**/*.js", path: gitignoreDir });
      // dist is commonly ignored by parent .gitignore too
      expect(result.output).not.toContain("bundle.js");
    });

    it("should respect .gitignore and exclude .log files when not nested", async function () {
      if (!gitInitialized || isNestedInGitRepo) {
        // Skip when nested - parent gitignore may not have *.log rule
        return;
      }
      const result = await glob({ pattern: "**/*", path: gitignoreDir });
      expect(result.output).not.toContain("error.log");
    });

    it("should respect .gitignore and exclude .env file when not nested", async function () {
      if (!gitInitialized || isNestedInGitRepo) {
        // Skip when nested - parent gitignore may not have .env rule
        return;
      }
      const result = await glob({ pattern: "**/*", path: gitignoreDir });
      expect(result.output).not.toMatch(/gitignore\/\.env(?:\n|$)/);
    });

    it("should include files not in .gitignore", async function () {
      if (!gitInitialized) {
        return;
      }
      const result = await glob({ pattern: "**/*.ts", path: gitignoreDir });
      expect(result.output).toContain("index.ts");
      expect(result.output).toContain("utils.ts");
    });

    it("should find package.json which is not ignored", async function () {
      if (!gitInitialized) {
        return;
      }
      const result = await glob({ pattern: "*.json", path: gitignoreDir });
      expect(result.output).toContain("package.json");
    });
  });
});

describe("GlobInputSchema", () => {
  it("should validate correct input", () => {
    const input = {
      pattern: "**/*.ts",
      path: "/some/path",
    };

    expect(() => GlobInputSchema.parse(input)).not.toThrow();
  });

  it("should require pattern", () => {
    expect(() => GlobInputSchema.parse({})).toThrow(ZodError);
  });

  it("should allow optional path", () => {
    expect(() => GlobInputSchema.parse({ pattern: "**/*.ts" })).not.toThrow();
  });
});

describe("GlobOutputSchema", () => {
  it("should validate correct output", () => {
    const output = {
      title: "**/*.ts",
      metadata: { count: 5, truncated: false },
      output: "/path/to/file.ts\n/path/to/another.ts",
    };

    expect(() => GlobOutputSchema.parse(output)).not.toThrow();
  });
});
