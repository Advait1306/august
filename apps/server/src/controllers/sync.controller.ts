import { Request, Response, Router } from "express";
import { getAuth } from "@clerk/express";
import { SyncService } from "../services/sync.service";

export function createSyncController(syncService: SyncService): Router {
  const router = Router();

  /**
   * Handle Zero get queries
   */
  router.post("/get-queries", async (req: Request, res: Response) => {
    const { isAuthenticated, userId, orgId } = getAuth(req);

    if (!isAuthenticated) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    const result = await syncService.handleGetQueries(
      {
        userId: userId!,
        orgId: orgId ?? userId!,
      },
      req.body
    );

    return res.json(result);
  });

  /**
   * Handle Zero push mutations
   */
  router.post("/push", async (req: Request, res: Response) => {
    const { isAuthenticated, userId, orgId } = getAuth(req);

    if (!isAuthenticated) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    const result = await syncService.handlePush(
      {
        userId: userId!,
        orgId: orgId ?? userId!,
      },
      req.query as Record<string, string>,
      req.body
    );

    return res.json(result);
  });

  return router;
}
