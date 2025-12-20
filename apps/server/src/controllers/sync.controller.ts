import { Request, Response, Router } from "express";
import { getAuth } from "@clerk/express";
import { SyncService } from "../services/sync.service";

export function createSyncController(syncService: SyncService): Router {
  const router = Router();

  /**
   * Handle Zero query request
   */
  router.post("/query", async (req: Request, res: Response) => {
    const { isAuthenticated, userId, orgId } = getAuth(req);

    if (!isAuthenticated) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    const result = await syncService.handleQuery(
      {
        userId: userId!,
        orgId: orgId ?? userId!,
      },
      req.body
    );

    return res.json(result);
  });

  /**
   * Handle Zero mutate request
   */
  router.post("/mutate", async (req: Request, res: Response) => {
    const { isAuthenticated, userId, orgId } = getAuth(req);

    if (!isAuthenticated) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    const result = await syncService.handleMutate(
      {
        userId: userId!,
        orgId: orgId ?? userId!,
      },
      req.body
    );

    return res.json(result);
  });

  return router;
}
