import { Request, Response, Router } from "express";
import { getAuth } from "@clerk/express";
import { SyncService } from "../services/sync.service";

/**
 * Convert Express request to Fetch API Request
 */
function expressToFetchRequest(req: Request): globalThis.Request {
  const protocol = req.protocol;
  const host = req.get("host") || "localhost";
  const url = `${protocol}://${host}${req.originalUrl}`;

  return new globalThis.Request(url, {
    method: req.method,
    headers: new Headers(req.headers as Record<string, string>),
    body: JSON.stringify(req.body),
  });
}

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

    const fetchRequest = expressToFetchRequest(req);
    const result = await syncService.handleQuery(
      {
        userId: userId!,
        orgId: orgId ?? userId!,
      },
      fetchRequest
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

    const fetchRequest = expressToFetchRequest(req);
    const result = await syncService.handleMutate(
      {
        userId: userId!,
        orgId: orgId ?? userId!,
      },
      fetchRequest
    );

    return res.json(result);
  });

  return router;
}
