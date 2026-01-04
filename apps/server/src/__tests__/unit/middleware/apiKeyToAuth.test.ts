import { describe, it, expect, vi } from "vitest";
import { Request, Response, NextFunction } from "express";
import { apiKeyToAuthMiddleware } from "../../../middleware/apiKeyToAuth.js";

function createMockReqRes(overrides: Partial<Request> = {}) {
  const req = {
    path: "/test",
    headers: {},
    ...overrides,
  } as Request;

  const res = {} as Response;

  const next = vi.fn() as NextFunction;

  return { req, res, next };
}

describe("apiKeyToAuthMiddleware", () => {
  it("converts x-api-key to authorization header for /cc-proxy routes", () => {
    const { req, res, next } = createMockReqRes({
      path: "/cc-proxy/some/path",
      headers: { "x-api-key": "my-api-key" },
    });

    apiKeyToAuthMiddleware(req, res, next);

    expect(req.headers["authorization"]).toBe("Bearer my-api-key");
    expect(next).toHaveBeenCalledOnce();
  });

  it("handles x-api-key at exactly /cc-proxy path", () => {
    const { req, res, next } = createMockReqRes({
      path: "/cc-proxy",
      headers: { "x-api-key": "my-api-key" },
    });

    apiKeyToAuthMiddleware(req, res, next);

    expect(req.headers["authorization"]).toBe("Bearer my-api-key");
    expect(next).toHaveBeenCalledOnce();
  });

  it("does not modify headers for non-cc-proxy routes", () => {
    const { req, res, next } = createMockReqRes({
      path: "/api/users",
      headers: { "x-api-key": "my-api-key" },
    });

    apiKeyToAuthMiddleware(req, res, next);

    expect(req.headers["authorization"]).toBeUndefined();
    expect(next).toHaveBeenCalledOnce();
  });

  it("does not modify headers when x-api-key is missing", () => {
    const { req, res, next } = createMockReqRes({
      path: "/cc-proxy/path",
      headers: {},
    });

    apiKeyToAuthMiddleware(req, res, next);

    expect(req.headers["authorization"]).toBeUndefined();
    expect(next).toHaveBeenCalledOnce();
  });

  it("does not modify headers when x-api-key is not a string", () => {
    const { req, res, next } = createMockReqRes({
      path: "/cc-proxy/path",
      headers: { "x-api-key": ["array", "value"] as unknown as string },
    });

    apiKeyToAuthMiddleware(req, res, next);

    expect(req.headers["authorization"]).toBeUndefined();
    expect(next).toHaveBeenCalledOnce();
  });

  it("preserves existing authorization header for non-cc-proxy routes", () => {
    const { req, res, next } = createMockReqRes({
      path: "/api/other",
      headers: {
        "x-api-key": "my-api-key",
        authorization: "Bearer existing-token",
      },
    });

    apiKeyToAuthMiddleware(req, res, next);

    expect(req.headers["authorization"]).toBe("Bearer existing-token");
    expect(next).toHaveBeenCalledOnce();
  });

  it("always calls next()", () => {
    const scenarios = [
      { path: "/cc-proxy", headers: { "x-api-key": "key" } },
      { path: "/other", headers: { "x-api-key": "key" } },
      { path: "/cc-proxy", headers: {} },
      { path: "/other", headers: {} },
    ];

    for (const scenario of scenarios) {
      const { req, res, next } = createMockReqRes(scenario);
      apiKeyToAuthMiddleware(req, res, next);
      expect(next).toHaveBeenCalledOnce();
    }
  });
});
