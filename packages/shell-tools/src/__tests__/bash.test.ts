import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { join } from "path";
import { mkdir, rm, writeFile } from "fs/promises";
import {
  bash,
  BashInputSchema,
  BashOutputSchema,
  BashError,
  BashErrorType,
} from "../bash";

const fixturesPath = join(__dirname, "fixtures-bash-test");

// Create fixtures before tests run
beforeAll(async () => {
  await mkdir(fixturesPath, { recursive: true });

  // Create a sample script
  await writeFile(
    join(fixturesPath, "echo-script.sh"),
    `#!/bin/bash
echo "Hello from script"
echo "Arguments: $@"
`
  );

  // Create a script that outputs to stderr
  await writeFile(
    join(fixturesPath, "stderr-script.sh"),
    `#!/bin/bash
echo "stdout output"
echo "stderr output" >&2
`
  );

  // Create a script that exits with error
  await writeFile(
    join(fixturesPath, "error-script.sh"),
    `#!/bin/bash
echo "About to fail"
exit 42
`
  );

  // Create a slow script for timeout testing
  await writeFile(
    join(fixturesPath, "slow-script.sh"),
    `#!/bin/bash
echo "Starting..."
sleep 10
echo "Done"
`
  );

  // Create nested directory for workdir testing
  await mkdir(join(fixturesPath, "subdir"), { recursive: true });
  await writeFile(join(fixturesPath, "subdir", "test.txt"), "subdir content");
});

// Clean up fixtures after tests complete
afterAll(async () => {
  await rm(fixturesPath, { recursive: true, force: true });
});

describe("bash", () => {
  describe("basic execution", () => {
    it("should execute a simple echo command", async () => {
      const result = await bash({
        command: "echo 'Hello World'",
        workdir: fixturesPath,
        description: "Echo hello",
      });

      expect(result.metadata.exitCode).toBe(0);
      expect(result.output).toContain("Hello World");
      expect(result.metadata.timedOut).toBe(false);
      expect(result.metadata.aborted).toBe(false);
      expect(result.metadata.truncated).toBe(false);
    });

    it("should capture exit code", async () => {
      const result = await bash({
        command: "exit 5",
        workdir: fixturesPath,
        description: "Exit with code 5",
      });

      expect(result.metadata.exitCode).toBe(5);
    });

    it("should capture both stdout and stderr", async () => {
      const result = await bash({
        command: "echo 'stdout' && echo 'stderr' >&2",
        workdir: fixturesPath,
        description: "Echo to both streams",
      });

      expect(result.output).toContain("stdout");
      expect(result.output).toContain("stderr");
    });

    it("should execute commands with pipes", async () => {
      const result = await bash({
        command: "echo 'line1\nline2\nline3' | wc -l",
        workdir: fixturesPath,
        description: "Count lines with pipe",
      });

      expect(result.metadata.exitCode).toBe(0);
      // wc -l output varies by platform, just check it ran
      expect(result.output).toMatch(/\d/);
    });

    it("should execute commands with && chaining", async () => {
      const result = await bash({
        command: "echo 'first' && echo 'second'",
        workdir: fixturesPath,
        description: "Chained commands",
      });

      expect(result.metadata.exitCode).toBe(0);
      expect(result.output).toContain("first");
      expect(result.output).toContain("second");
    });

    it("should stop && chain on first failure", async () => {
      const result = await bash({
        command: "exit 1 && echo 'should not appear'",
        workdir: fixturesPath,
        description: "Chain with failure",
      });

      expect(result.metadata.exitCode).toBe(1);
      expect(result.output).not.toContain("should not appear");
    });
  });

  describe("working directory", () => {
    it("should use specified working directory", async () => {
      const result = await bash({
        command: "pwd",
        workdir: fixturesPath,
        description: "Print working directory",
      });

      expect(result.metadata.exitCode).toBe(0);
      expect(result.output.trim()).toBe(fixturesPath);
      expect(result.metadata.workdir).toBe(fixturesPath);
    });

    it("should list files in working directory", async () => {
      const result = await bash({
        command: "ls",
        workdir: fixturesPath,
        description: "List files",
      });

      expect(result.metadata.exitCode).toBe(0);
      expect(result.output).toContain("echo-script.sh");
    });

    it("should work with nested directories", async () => {
      const subdir = join(fixturesPath, "subdir");
      const result = await bash({
        command: "cat test.txt",
        workdir: subdir,
        description: "Cat file in subdir",
      });

      expect(result.metadata.exitCode).toBe(0);
      expect(result.output).toContain("subdir content");
    });

    it("should throw error for non-existent working directory", async () => {
      await expect(
        bash({
          command: "pwd",
          workdir: "/nonexistent/path/that/does/not/exist",
          description: "Invalid workdir",
        })
      ).rejects.toThrow(BashError);

      try {
        await bash({
          command: "pwd",
          workdir: "/nonexistent/path",
          description: "Invalid workdir",
        });
      } catch (err) {
        expect(err).toBeInstanceOf(BashError);
        expect((err as BashError).type).toBe(BashErrorType.WORKDIR_NOT_FOUND);
      }
    });

    it("should throw error for relative working directory", async () => {
      await expect(
        bash({
          command: "pwd",
          workdir: "relative/path",
          description: "Relative workdir",
        })
      ).rejects.toThrow(BashError);

      try {
        await bash({
          command: "pwd",
          workdir: "relative/path",
          description: "Relative workdir",
        });
      } catch (err) {
        expect(err).toBeInstanceOf(BashError);
        expect((err as BashError).type).toBe(BashErrorType.INVALID_WORKDIR);
      }
    });

    it("should throw error if workdir is a file", async () => {
      const filePath = join(fixturesPath, "echo-script.sh");

      try {
        await bash({
          command: "pwd",
          workdir: filePath,
          description: "File as workdir",
        });
        expect.fail("Should have thrown");
      } catch (err) {
        expect(err).toBeInstanceOf(BashError);
        expect((err as BashError).type).toBe(
          BashErrorType.WORKDIR_NOT_DIRECTORY
        );
      }
    });
  });

  describe("timeout handling", () => {
    it("should complete before timeout", async () => {
      const result = await bash({
        command: "echo 'quick'",
        workdir: fixturesPath,
        timeout: 5000,
        description: "Quick command",
      });

      expect(result.metadata.exitCode).toBe(0);
      expect(result.metadata.timedOut).toBe(false);
    });

    it("should timeout and kill long-running command", async () => {
      const start = Date.now();

      const result = await bash({
        command: "sleep 30",
        workdir: fixturesPath,
        timeout: 500,
        description: "Timeout test",
      });

      const elapsed = Date.now() - start;

      expect(result.metadata.timedOut).toBe(true);
      expect(elapsed).toBeLessThan(5000); // Should complete within 5s
      expect(result.output).toContain("timed out");
    });

    it("should not timeout when timeout is 0 (disabled)", async () => {
      const result = await bash({
        command: "echo 'no timeout'",
        workdir: fixturesPath,
        timeout: 0,
        description: "No timeout",
      });

      expect(result.metadata.exitCode).toBe(0);
      expect(result.metadata.timedOut).toBe(false);
    });

    it("should throw error for negative timeout", async () => {
      await expect(
        bash({
          command: "echo 'test'",
          workdir: fixturesPath,
          timeout: -1,
          description: "Negative timeout",
        })
      ).rejects.toThrow(BashError);

      try {
        await bash({
          command: "echo 'test'",
          workdir: fixturesPath,
          timeout: -100,
          description: "Negative timeout",
        });
      } catch (err) {
        expect(err).toBeInstanceOf(BashError);
        expect((err as BashError).type).toBe(BashErrorType.INVALID_TIMEOUT);
      }
    });
  });

  describe("abort handling", () => {
    it("should abort when signal is triggered", async () => {
      const controller = new AbortController();

      // Abort after 100ms
      setTimeout(() => controller.abort(), 100);

      const result = await bash(
        {
          command: "sleep 30",
          workdir: fixturesPath,
          description: "Abort test",
        },
        { signal: controller.signal }
      );

      expect(result.metadata.aborted).toBe(true);
      expect(result.output).toContain("aborted");
    });

    it("should not run command if already aborted", async () => {
      const controller = new AbortController();
      controller.abort();

      const result = await bash(
        {
          command: "sleep 30",
          workdir: fixturesPath,
          description: "Pre-aborted test",
        },
        { signal: controller.signal }
      );

      expect(result.metadata.aborted).toBe(true);
    });
  });

  describe("output streaming", () => {
    it("should call onOutput callback with output", async () => {
      const outputs: string[] = [];

      await bash(
        {
          command: "echo 'line1' && echo 'line2'",
          workdir: fixturesPath,
          description: "Streaming test",
        },
        {
          onOutput: (output) => {
            outputs.push(output);
          },
        }
      );

      expect(outputs.length).toBeGreaterThan(0);
      const finalOutput = outputs[outputs.length - 1];
      expect(finalOutput).toContain("line1");
      expect(finalOutput).toContain("line2");
    });

    it("should stream output incrementally", async () => {
      const outputs: string[] = [];

      await bash(
        {
          command:
            "echo 'first' && sleep 0.1 && echo 'second' && sleep 0.1 && echo 'third'",
          workdir: fixturesPath,
          description: "Incremental streaming",
        },
        {
          onOutput: (output) => {
            outputs.push(output);
          },
        }
      );

      // Should have multiple updates
      expect(outputs.length).toBeGreaterThan(1);
    });
  });

  describe("output truncation", () => {
    it("should truncate very long output", async () => {
      // Generate output longer than 30KB (30,000 chars)
      // Each line from yes is 2 chars ("x\n"), so 20000 lines = 40KB
      const result = await bash({
        command: "yes 'x' | head -20000",
        workdir: fixturesPath,
        description: "Long output test",
      });

      expect(result.metadata.truncated).toBe(true);
      expect(result.output).toContain("truncated");
      expect(result.output.length).toBeLessThan(35000); // 30KB + metadata
    });

    it("should not truncate short output", async () => {
      const result = await bash({
        command: "echo 'short'",
        workdir: fixturesPath,
        description: "Short output",
      });

      expect(result.metadata.truncated).toBe(false);
    });
  });

  describe("command validation", () => {
    it("should throw error for empty command", async () => {
      await expect(
        bash({
          command: "",
          workdir: fixturesPath,
          description: "Empty command",
        })
      ).rejects.toThrow(BashError);

      try {
        await bash({
          command: "",
          workdir: fixturesPath,
          description: "Empty command",
        });
      } catch (err) {
        expect(err).toBeInstanceOf(BashError);
        expect((err as BashError).type).toBe(BashErrorType.EMPTY_COMMAND);
      }
    });

    it("should throw error for whitespace-only command", async () => {
      await expect(
        bash({
          command: "   ",
          workdir: fixturesPath,
          description: "Whitespace command",
        })
      ).rejects.toThrow(BashError);
    });
  });

  describe("environment variables", () => {
    it("should pass through environment variables", async () => {
      const result = await bash({
        command: "echo $HOME",
        workdir: fixturesPath,
        description: "Echo HOME",
      });

      expect(result.metadata.exitCode).toBe(0);
      expect(result.output.trim()).toBeTruthy();
    });

    it("should expand shell variables", async () => {
      const result = await bash({
        command: "echo $PWD",
        workdir: fixturesPath,
        description: "Echo PWD",
      });

      expect(result.metadata.exitCode).toBe(0);
      expect(result.output.trim()).toBeTruthy();
    });
  });

  describe("special characters and escaping", () => {
    it("should handle quoted strings", async () => {
      const result = await bash({
        command: `echo "Hello World"`,
        workdir: fixturesPath,
        description: "Quoted string",
      });

      expect(result.output).toContain("Hello World");
    });

    it("should handle single quoted strings", async () => {
      const result = await bash({
        command: `echo 'Hello $USER'`,
        workdir: fixturesPath,
        description: "Single quoted",
      });

      expect(result.output).toContain("Hello $USER");
    });

    it("should handle command substitution", async () => {
      const result = await bash({
        command: "echo $(echo nested)",
        workdir: fixturesPath,
        description: "Command substitution",
      });

      expect(result.output).toContain("nested");
    });

    it("should handle backticks", async () => {
      const result = await bash({
        command: "echo `echo backticks`",
        workdir: fixturesPath,
        description: "Backticks",
      });

      expect(result.output).toContain("backticks");
    });
  });

  describe("output structure", () => {
    it("should return properly structured output", async () => {
      const result = await bash({
        command: "echo test",
        workdir: fixturesPath,
        description: "Structure test",
      });

      // Validate against schema
      const parsed = BashOutputSchema.parse(result);
      expect(parsed).toEqual(result);

      // Check structure
      expect(result).toHaveProperty("title");
      expect(result).toHaveProperty("metadata");
      expect(result).toHaveProperty("output");

      // Check metadata
      expect(result.metadata).toHaveProperty("command", "echo test");
      expect(result.metadata).toHaveProperty("workdir", fixturesPath);
      expect(result.metadata).toHaveProperty("exitCode", 0);
      expect(result.metadata).toHaveProperty("signal");
      expect(result.metadata).toHaveProperty("timedOut", false);
      expect(result.metadata).toHaveProperty("aborted", false);
      expect(result.metadata).toHaveProperty("truncated", false);
    });

    it("should use description as title when provided", async () => {
      const result = await bash({
        command: "echo test",
        workdir: fixturesPath,
        description: "My custom description",
      });

      expect(result.title).toBe("My custom description");
    });

    it("should use truncated command as title when description not provided", async () => {
      const result = await bash({
        command: "echo test",
        workdir: fixturesPath,
      });

      expect(result.title).toContain("Executed:");
    });
  });
});

describe("BashInputSchema", () => {
  it("should validate correct input", () => {
    const input = {
      command: "echo test",
      timeout: 5000,
      workdir: "/tmp",
      description: "Test command",
    };

    expect(() => BashInputSchema.parse(input)).not.toThrow();
  });

  it("should require command", () => {
    expect(() =>
      BashInputSchema.parse({
        description: "No command",
      })
    ).toThrow();
  });

  it("should allow optional timeout", () => {
    expect(() =>
      BashInputSchema.parse({
        command: "echo test",
        workdir: "/tmp",
      })
    ).not.toThrow();
  });

  it("should require workdir", () => {
    expect(() =>
      BashInputSchema.parse({
        command: "echo test",
      })
    ).toThrow();
  });

  it("should allow optional description", () => {
    expect(() =>
      BashInputSchema.parse({
        command: "echo test",
        workdir: "/tmp",
      })
    ).not.toThrow();
  });
});

describe("BashOutputSchema", () => {
  it("should validate correct output", () => {
    const output = {
      title: "Test",
      metadata: {
        command: "echo test",
        workdir: "/tmp",
        exitCode: 0,
        signal: null,
        timedOut: false,
        aborted: false,
        truncated: false,
      },
      output: "test output",
    };

    expect(() => BashOutputSchema.parse(output)).not.toThrow();
  });
});
