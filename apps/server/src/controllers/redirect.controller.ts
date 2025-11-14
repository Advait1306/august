import { Request, Response, Router } from "express";

export function createRedirectController(): Router {
  const router = Router();

  /**
   * Redirect all requests to Composio auth callback
   * Preserves all query parameters from the original request
   */
  router.all("/redirect/composio", (req: Request, res: Response) => {
    const baseUrl = "https://backend.composio.dev/api/v3/toolkits/auth/callback";
    const queryString = new URLSearchParams(req.query as Record<string, string>).toString();
    const redirectUrl = queryString ? `${baseUrl}?${queryString}` : baseUrl;
    res.redirect(redirectUrl);
  });

  return router;
}
