import { Request, Response, NextFunction } from "express";

/**
 * Middleware to convert x-api-key header to authorization header for cc-proxy routes
 */
export function apiKeyToAuthMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction
) {
  if (req.path.startsWith("/cc-proxy")) {
    const apiKey = req.headers["x-api-key"];
    if (apiKey && typeof apiKey === "string") {
      req.headers["authorization"] = `Bearer ${apiKey}`;
    }
  }
  next();
}
