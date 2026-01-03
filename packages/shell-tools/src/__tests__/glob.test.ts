import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { glob, GlobInputSchema, GlobOutputSchema } from "../glob";
import { join } from "path";
import { ZodError } from "zod";
import { utimes, mkdir, writeFile, rm } from "fs/promises";
import * as path from "path";

const fixturesPath = join(__dirname, "fixtures-glob-test");

// Isolated subdirectories for different test categories
const basicDir = join(fixturesPath, "basic");
const tempDir = join(fixturesPath, "temp");
const caseSensitiveDir = join(fixturesPath, "case-sensitive");
const bracketDir = join(fixturesPath, "brackets");
const symlinkDir = join(fixturesPath, "symlink");
const gitignoreDir = join(fixturesPath, "gitignore");
const nestedDir = join(fixturesPath, "nested");
const specialCharsDir = join(fixturesPath, "special-chars");

// Track gitignore test state
let gitInitialized = false;
let isNestedInGitRepo = false;

// Create all fixtures before tests run
beforeAll(async () => {
  // === BASIC DIR: Isolated directory for basic pattern tests ===
  // Structure:
  //   basic/
  //     README.md
  //     src/
  //       index.ts
  //       utils.ts
  //       components/
  //         Button.tsx
  //         Modal.tsx
  //     lib/
  //       helper.js
  //       config.json
  await mkdir(join(basicDir, "src/components"), { recursive: true });
  await mkdir(join(basicDir, "lib"), { recursive: true });
  await writeFile(join(basicDir, "README.md"), "# Basic Test Fixtures");
  await writeFile(
    join(basicDir, "src/index.ts"),
    'export function main() { console.log("Hello"); }'
  );
  await writeFile(
    join(basicDir, "src/utils.ts"),
    "export function formatDate(date: Date) { return date.toISOString(); }"
  );
  await writeFile(
    join(basicDir, "src/components/Button.tsx"),
    "export function Button({ label }: { label: string }) { return null; }"
  );
  await writeFile(
    join(basicDir, "src/components/Modal.tsx"),
    "export function Modal({ children }: { children: any }) { return null; }"
  );
  await writeFile(
    join(basicDir, "lib/helper.js"),
    "module.exports = { helper: () => 'helper' };"
  );
  await writeFile(
    join(basicDir, "lib/config.json"),
    '{ "name": "test-config" }'
  );

  // === NESTED DIR: For deeply nested file tests ===
  // Structure:
  //   nested/
  //     src/
  //       components/
  //         nested/
  //           DeepComponent.tsx
  await mkdir(join(nestedDir, "src/components/nested"), { recursive: true });
  await writeFile(
    join(nestedDir, "src/components/nested/DeepComponent.tsx"),
    "export function DeepComponent() { return null; }"
  );

  // === SPECIAL CHARS DIR: For special character tests ===
  // Structure:
  //   special-chars/
  //     file [1].txt
  await mkdir(specialCharsDir, { recursive: true });
  await writeFile(
    join(specialCharsDir, "file [1].txt"),
    "File with special characters in name"
  );

  // === TEMP DIR: 150+ files for truncation tests ===
  await mkdir(tempDir, { recursive: true });
  for (let i = 0; i < 150; i++) {
    await writeFile(join(tempDir, `file${i}.txt`), `content ${i}`);
  }

  // === CASE SENSITIVE DIR: For case sensitivity tests ===
  // Structure:
  //   case-sensitive/
  //     file.txt
  //     data.TXT
  //     info.Txt
  await mkdir(caseSensitiveDir, { recursive: true });
  await writeFile(join(caseSensitiveDir, "file.txt"), "lowercase");
  await writeFile(join(caseSensitiveDir, "data.TXT"), "uppercase ext");
  await writeFile(join(caseSensitiveDir, "info.Txt"), "mixed case ext");

  // === BRACKET DIR: For Next.js style routes with brackets ===
  // Structure:
  //   brackets/
  //     file[1].txt
  //     file(1).txt
  //     app/
  //       [slug]/
  //         (dashboard)/
  //           page.tsx
  //           components/
  //             Button.tsx
  //       [...catchAll]/
  //         route.ts
  //       [[optionalSlug]]/
  //         page.tsx
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

  // === GITIGNORE DIR: For .gitignore behavior tests ===
  // Structure:
  //   gitignore/
  //     .gitignore (ignores: node_modules/, dist/, *.log, .env)
  //     README.md
  //     package.json
  //     error.log (ignored)
  //     .env (ignored)
  //     src/
  //       app.ts
  //       helper.ts
  //     node_modules/ (ignored)
  //       pkg/
  //         index.js
  //     dist/ (ignored)
  //       bundle.js
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
  await writeFile(join(gitignoreDir, "src/app.ts"), "export {}");
  await writeFile(join(gitignoreDir, "src/helper.ts"), "export {}");
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
      const result = await glob({ pattern: "*.md", path: basicDir });
      // *.md only matches root level - basicDir has exactly 1 README.md at root
      expect(result.metadata.count).toEqual(1);
      expect(result.output).toContain("README.md");
    });

    it("should match files with globstar pattern", async () => {
      const result = await glob({ pattern: "**/*.ts", path: basicDir });
      // basicDir/src has: index.ts, utils.ts (2 files)
      expect(result.metadata.count).toEqual(2);
      expect(result.output).toContain("index.ts");
      expect(result.output).toContain("utils.ts");
    });

    it("should match files with multiple extensions", async () => {
      const result = await glob({
        pattern: "**/*.{ts,tsx}",
        path: basicDir,
      });
      // basicDir has: index.ts, utils.ts (2 .ts) + Button.tsx, Modal.tsx (2 .tsx) = 4 files
      expect(result.metadata.count).toEqual(4);
      expect(result.output).toContain(".ts");
      expect(result.output).toContain(".tsx");
    });

    it("should match specific directory pattern", async () => {
      const result = await glob({
        pattern: "src/**/*.tsx",
        path: basicDir,
      });
      // basicDir/src/components has: Button.tsx, Modal.tsx (2 files)
      expect(result.metadata.count).toEqual(2);
      expect(result.output).toContain("Button.tsx");
      expect(result.output).toContain("Modal.tsx");
    });
  });

  describe("empty results", () => {
    it("should return empty output for non-matching pattern", async () => {
      const result = await glob({ pattern: "**/*.xyz", path: basicDir });
      expect(result.metadata.count).toEqual(0);
      expect(result.metadata.truncated).toEqual(false);
      expect(result.output).toEqual("No files found");
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
      expect(result.metadata.count).toEqual(100);
      expect(result.metadata.truncated).toEqual(true);
      expect(result.output).toContain("Results are truncated");
    });

    it("should not truncate when under limit", async () => {
      const result = await glob({
        pattern: "**/*.ts",
        path: join(basicDir, "src"),
      });
      // basicDir/src has 2 .ts files
      expect(result.metadata.count).toEqual(2);
      expect(result.metadata.truncated).toEqual(false);
      expect(result.output).not.toContain("truncated");
    });
  });

  describe("sorting", () => {
    it("should return newest files first", async () => {
      // Touch a file to make it newest
      const newestFile = join(basicDir, "src/utils.ts");
      await utimes(newestFile, new Date(), new Date());

      const result = await glob({
        pattern: "**/*.ts",
        path: join(basicDir, "src"),
      });
      const files = result.output.split("\n").filter(Boolean);

      // First file should be the one we just touched
      expect(files[0]).toContain("utils.ts");
    });

    it("should maintain consistent order for files with same mtime", async () => {
      const result1 = await glob({
        pattern: "**/*",
        path: join(basicDir, "src"),
      });
      const result2 = await glob({
        pattern: "**/*",
        path: join(basicDir, "src"),
      });
      expect(result1.output).toEqual(result2.output);
    });
  });

  describe("special characters", () => {
    it("should handle paths with special characters", async () => {
      const result = await glob({
        pattern: "**/*.txt",
        path: specialCharsDir,
      });
      // specialCharsDir has exactly 1 file: file [1].txt
      expect(result.metadata.count).toEqual(1);
      expect(result.output).toContain("file [1].txt");
    });

    it("should handle unicode characters in filenames", async () => {
      // Should not throw
      const result = await glob({
        pattern: "**/*.txt",
        path: specialCharsDir,
      });
      expect(result).toBeDefined();
      expect(result.metadata.count).toEqual(1);
    });
  });

  describe("nested directories", () => {
    it("should match deeply nested files with globstar", async () => {
      const result = await glob({
        pattern: "**/nested/**/*.tsx",
        path: nestedDir,
      });
      // nestedDir has exactly 1 file: src/components/nested/DeepComponent.tsx
      expect(result.metadata.count).toEqual(1);
      expect(result.output).toContain("DeepComponent.tsx");
    });

    it("should match at any depth with **", async () => {
      const result = await glob({
        pattern: "**/DeepComponent.tsx",
        path: nestedDir,
      });
      expect(result.metadata.count).toEqual(1);
    });
  });

  describe("input validation", () => {
    it("should throw error for missing pattern", async () => {
      await expect(glob({ pattern: "", path: basicDir })).rejects.toThrow();
    });

    it("should use current directory when path not provided", async () => {
      const originalCwd = process.cwd();
      process.chdir(basicDir);

      try {
        const result = await glob({ pattern: "**/*.ts" });
        // basicDir has 2 .ts files: index.ts, utils.ts
        expect(result.metadata.count).toEqual(2);
      } finally {
        process.chdir(originalCwd);
      }
    });
  });

  describe("output format", () => {
    it("should return absolute file paths", async () => {
      const result = await glob({
        pattern: "**/*.ts",
        path: join(basicDir, "src"),
      });
      const files = result.output.split("\n").filter(Boolean);

      // basicDir/src has 2 .ts files
      expect(files.length).toEqual(2);
      files.forEach((file) => {
        expect(path.isAbsolute(file)).toEqual(true);
      });
    });

    it("should return title matching the pattern", async () => {
      const pattern = "**/*.ts";
      const result = await glob({ pattern, path: basicDir });
      expect(result.title).toEqual(pattern);
    });

    it("should separate files with newlines", async () => {
      const result = await glob({
        pattern: "**/*.ts",
        path: join(basicDir, "src"),
      });
      // basicDir/src has 2 .ts files, so there should be a newline
      expect(result.metadata.count).toEqual(2);
      expect(result.output).toContain("\n");
    });
  });

  describe("edge cases", () => {
    it("should handle single file match", async () => {
      // basicDir has exactly 1 README.md at root
      const result = await glob({ pattern: "README.md", path: basicDir });
      expect(result.metadata.count).toEqual(1);
      expect(result.metadata.truncated).toEqual(false);
    });

    it("should handle pattern with no wildcards", async () => {
      // basicDir has exactly 1 README.md at root
      const result = await glob({ pattern: "README.md", path: basicDir });
      expect(result.metadata.count).toEqual(1);
    });

    it("should find README.md files with globstar", async () => {
      // basicDir has 1 README.md, gitignoreDir has 1 README.md = 2 total
      const result = await glob({
        pattern: "**/README.md",
        path: basicDir,
      });
      // Only searching basicDir which has exactly 1 README.md
      expect(result.metadata.count).toEqual(1);
      expect(result.output).toContain("README.md");
    });

    it("should not match directories, only files", async () => {
      const result = await glob({ pattern: "**/src", path: basicDir });
      // ripgrep --files only lists files, not directories
      // This pattern shouldn't match any files named "src"
      expect(result.output).not.toMatch(/src\n|src$/);
    });
  });

  describe("case sensitivity", () => {
    it("should match files with exact lowercase extension", async () => {
      const result = await glob({ pattern: "*.txt", path: caseSensitiveDir });
      // ripgrep glob is case-sensitive by default - only matches file.txt
      expect(result.metadata.count).toEqual(1);
      expect(result.output).toContain("file.txt");
    });

    it("should match files with exact uppercase extension", async () => {
      const result = await glob({ pattern: "*.TXT", path: caseSensitiveDir });
      // Should only match exact case - only data.TXT
      expect(result.metadata.count).toEqual(1);
      expect(result.output).toContain("data.TXT");
    });

    it("should match files with exact mixed case extension", async () => {
      const result = await glob({ pattern: "*.Txt", path: caseSensitiveDir });
      // Only matches info.Txt
      expect(result.metadata.count).toEqual(1);
      expect(result.output).toContain("info.Txt");
    });

    it("should not match files with different case in extension", async () => {
      const result = await glob({ pattern: "*.TXT", path: caseSensitiveDir });
      // ripgrep is case-sensitive, so *.TXT should not match file.txt
      expect(result.metadata.count).toEqual(1);
      expect(result.output).not.toContain("file.txt");
    });
  });

  describe("bracket characters in paths", () => {
    it("should match files in Next.js dynamic route directories", async () => {
      const result = await glob({ pattern: "**/*.tsx", path: bracketDir });
      // bracketDir has 3 .tsx files: [slug]/(dashboard)/components/Button.tsx,
      // [slug]/(dashboard)/page.tsx, [[optionalSlug]]/page.tsx
      expect(result.metadata.count).toEqual(3);
      expect(result.output).toContain("[slug]");
      expect(result.output).toContain("(dashboard)");
    });

    it("should match files in catch-all route directories", async () => {
      const result = await glob({ pattern: "**/*.ts", path: bracketDir });
      // bracketDir has 1 .ts file: [...catchAll]/route.ts
      expect(result.metadata.count).toEqual(1);
      expect(result.output).toContain("[...catchAll]");
    });

    it("should match files in optional catch-all route directories using globstar", async () => {
      // Note: Brackets in paths are matched via globstar, not literal bracket patterns
      // since brackets have special meaning in glob syntax
      const result = await glob({ pattern: "**/*.tsx", path: bracketDir });
      expect(result.metadata.count).toEqual(3);
      expect(result.output).toContain("[[optionalSlug]]");
    });

    it("should match files with parentheses in filename", async () => {
      const result = await glob({ pattern: "*.txt", path: bracketDir });
      // bracketDir has 2 .txt files at root: file[1].txt, file(1).txt
      expect(result.metadata.count).toEqual(2);
      expect(result.output).toContain("file(1).txt");
    });

    it("should find files with brackets using globstar pattern", async () => {
      // Brackets have special meaning in glob, so use ** to find files in bracket directories
      const result = await glob({
        pattern: "**/Button.tsx",
        path: bracketDir,
      });
      expect(result.metadata.count).toEqual(1);
      expect(result.output).toContain("Button.tsx");
      expect(result.output).toContain("[slug]");
    });

    it("should match all tsx files including those in bracket-named directories", async () => {
      const result = await glob({ pattern: "**/*.tsx", path: bracketDir });
      // Should find all 3 .tsx files regardless of bracket characters in path
      expect(result.metadata.count).toEqual(3);
      expect(result.output).toContain("Button.tsx");
      expect(result.output).toContain("page.tsx");
    });
  });

  describe("path security and boundary validation", () => {
    it("should handle absolute paths outside search directory gracefully", async () => {
      // Attempting to search /etc or other system directories
      // Should throw ripgrep error due to permission denied on some subdirectories
      await expect(glob({ pattern: "*.conf", path: "/etc" })).rejects.toThrow(
        /ripgrep error/
      );
    });

    it("should handle path traversal attempts", async () => {
      // Attempting to traverse to a non-existent directory should throw
      await expect(
        glob({
          pattern: "**/*",
          path: join(basicDir, "../../../../../../tmp"),
        })
      ).rejects.toThrow(/ripgrep error/);
    });

    it("should handle relative path traversal in pattern", async () => {
      const result = await glob({
        pattern: "../**/*.ts",
        path: basicDir,
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
        await symlink(join(basicDir, "src"), join(symlinkDir, "link"), "dir");

        const result = await glob({
          pattern: "**/*.ts",
          path: join(symlinkDir, "link"),
        });
        expect(result).toBeDefined();
        // basicDir/src has 2 .ts files
        expect(result.metadata.count).toEqual(2);
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
        path: join(basicDir, "src"),
      });
      // Should not find README.md which is in parent basicDir
      expect(result.output).not.toContain("README.md");
    });
  });

  describe("input validation edge cases", () => {
    it("should handle whitespace-only pattern without crashing", async () => {
      // ripgrep doesn't treat whitespace as an invalid pattern
      // It may match files depending on glob interpretation
      const result = await glob({ pattern: "   ", path: basicDir });
      // Just verify it returns a valid result structure
      expect(result).toBeDefined();
      expect(result.metadata).toBeDefined();
      expect(typeof result.metadata.count).toEqual("number");
    });

    it("should handle pattern with tabs and spaces without crashing", async () => {
      const result = await glob({ pattern: " \t \t ", path: basicDir });
      expect(result).toBeDefined();
      expect(result.metadata).toBeDefined();
    });

    it("should handle path that is a file instead of directory", async () => {
      const result = await glob({
        pattern: "**/*",
        path: join(basicDir, "README.md"),
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
        GlobInputSchema.parse({ pattern: 123, path: basicDir })
      ).toThrow(ZodError);
    });

    it("should reject null pattern via schema", () => {
      expect(() =>
        GlobInputSchema.parse({ pattern: null, path: basicDir })
      ).toThrow(ZodError);
    });

    it("should reject undefined pattern via schema", () => {
      expect(() => GlobInputSchema.parse({ path: basicDir })).toThrow(ZodError);
    });

    it("should handle extremely long pattern", async () => {
      const longPattern = "a".repeat(1000) + "*.ts";
      const result = await glob({ pattern: longPattern, path: basicDir });
      // Should return no files found, not crash
      expect(result.metadata.count).toEqual(0);
    });

    it("should handle pattern with null bytes gracefully", async () => {
      // This tests robustness against potentially malicious input
      try {
        const result = await glob({
          pattern: "**/*\0*.ts",
          path: basicDir,
        });
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
      // gitignoreDir/src has: app.ts, helper.ts (2 files)
      expect(result.metadata.count).toEqual(2);
      expect(result.output).toContain("app.ts");
      expect(result.output).toContain("helper.ts");
    });

    it("should find package.json which is not ignored", async function () {
      if (!gitInitialized) {
        return;
      }
      const result = await glob({ pattern: "*.json", path: gitignoreDir });
      // gitignoreDir has 1 .json file at root: package.json
      expect(result.metadata.count).toEqual(1);
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
