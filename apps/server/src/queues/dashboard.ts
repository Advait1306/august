import { ExpressAdapter } from "@bull-board/express";
import { createBullBoard } from "@bull-board/api";
import { queue as AgentLoopQueue } from "./workers/agentLoopWorker";
import { Express, Request, Response, NextFunction } from "express";
import { getAuth, ClerkClient } from "@clerk/express";
import { BullBoardGroupMQAdapter } from "groupmq";

const queues = [
  new BullBoardGroupMQAdapter(AgentLoopQueue, {
    displayName: "Agent Loop",
    description: "Handles all agent running jobs",
    readOnlyMode: false,
  }),
];

const createBullDashboardAndAttachRouter = (
  app: Express,
  clerkClient: ClerkClient
) => {
  const adapter = new ExpressAdapter();
  adapter.setBasePath("/admin/queues");

  createBullBoard({
    queues,
    serverAdapter: adapter,
  });

  // Middleware to check for sixhuman_admin role in private metadata
  const requireSixhumanAdmin = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    const { isAuthenticated, userId } = getAuth(req);

    if (!isAuthenticated || !userId) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    try {
      const user = await clerkClient.users.getUser(userId);
      const internalRole = user.privateMetadata?.internal_role;

      if (
        !Array.isArray(internalRole) ||
        !internalRole.includes("sixhuman_admin")
      ) {
        return res.status(403).json({ error: "Access denied" });
      }

      next();
    } catch {
      return res.status(500).json({ error: "Failed to verify permissions" });
    }
  };

  app.use("/admin/queues", requireSixhumanAdmin, adapter.getRouter());
};

export { createBullDashboardAndAttachRouter };
