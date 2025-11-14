import { Request, Response, Router } from "express";

export function createRedirectController(): Router {
  const router = Router();

  /**
   * Redirect all requests to Composio auth callback
   */
  router.all("/redirect/composio", (_req: Request, res: Response) => {
    res.redirect("https://backend.composio.dev/api/v3/toolkits/auth/callback");
  });

  return router;
}
