import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { encrypt, decrypt } from "../../../utils/encryption.js";

describe("encryption utils", () => {
  const originalEnv = process.env.ENCRYPTION_KEY;

  beforeEach(() => {
    process.env.ENCRYPTION_KEY = "test-encryption-key-32-chars-ok!";
  });

  afterEach(() => {
    process.env.ENCRYPTION_KEY = originalEnv;
  });

  describe("encrypt", () => {
    it("encrypts a string and returns base64 encoded result", () => {
      const plaintext = "hello world";
      const encrypted = encrypt(plaintext);

      expect(encrypted).toBeDefined();
      expect(typeof encrypted).toBe("string");
      // Format: salt:iv:authTag:encryptedData
      expect(encrypted.split(":")).toHaveLength(4);
    });

    it("produces different ciphertexts for the same plaintext (due to random salt)", () => {
      const plaintext = "hello world";
      const encrypted1 = encrypt(plaintext);
      const encrypted2 = encrypt(plaintext);

      expect(encrypted1).not.toBe(encrypted2);
    });

    it("throws error when ENCRYPTION_KEY is not set", () => {
      delete process.env.ENCRYPTION_KEY;

      expect(() => encrypt("test")).toThrow(
        "ENCRYPTION_KEY environment variable is not set"
      );
    });
  });

  describe("decrypt", () => {
    it("decrypts an encrypted string back to original", () => {
      const plaintext = "hello world";
      const encrypted = encrypt(plaintext);
      const decrypted = decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    it("handles special characters", () => {
      const plaintext = "test!@#$%^&*()_+{}|:<>?[]\\;',./`~";
      const encrypted = encrypt(plaintext);
      const decrypted = decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    it("handles unicode characters", () => {
      const plaintext = "Hello \u4e16\u754c \ud83c\udf0d";
      const encrypted = encrypt(plaintext);
      const decrypted = decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    it("handles empty string", () => {
      const plaintext = "";
      const encrypted = encrypt(plaintext);
      const decrypted = decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    it("handles long strings", () => {
      const plaintext = "a".repeat(10000);
      const encrypted = encrypt(plaintext);
      const decrypted = decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    it("throws error when ENCRYPTION_KEY is not set", () => {
      const encrypted = encrypt("test");
      delete process.env.ENCRYPTION_KEY;

      expect(() => decrypt(encrypted)).toThrow(
        "ENCRYPTION_KEY environment variable is not set"
      );
    });

    it("throws error for invalid encrypted text format (missing parts)", () => {
      expect(() => decrypt("invalid")).toThrow("Invalid encrypted text format");
      expect(() => decrypt("a:b")).toThrow("Invalid encrypted text format");
      expect(() => decrypt("a:b:c")).toThrow("Invalid encrypted text format");
    });

    it("throws error for corrupted ciphertext", () => {
      const encrypted = encrypt("test");
      const parts = encrypted.split(":");
      parts[3] = "corrupted";
      const corrupted = parts.join(":");

      expect(() => decrypt(corrupted)).toThrow();
    });
  });

  describe("round-trip", () => {
    it("encrypts and decrypts JSON objects", () => {
      const obj = { key: "value", nested: { foo: "bar" } };
      const plaintext = JSON.stringify(obj);
      const encrypted = encrypt(plaintext);
      const decrypted = decrypt(encrypted);

      expect(JSON.parse(decrypted)).toEqual(obj);
    });
  });
});
