import { Request, Response, Router } from "express";
import { Webhook } from "svix";
import { getAuth } from "@clerk/express";
import { ClerkService } from "../services/clerk.service";

export function createClerkController(clerkService: ClerkService): Router {
  const router = Router();
  const wh = new Webhook(process.env.CLERK_WEBHOOK_KEY!);

  /**
   * Clerk webhook handler
   */
  router.post("/clerk", async (req: Request, res: Response) => {
    const payload = req.body;
    const headers = req.headers as Record<string, string>;

    let parsedPayload;
    try {
      wh.verify(payload, headers);
      parsedPayload = JSON.parse(payload.toString());
    } catch (err) {
      console.error("Clerk Webhook verification failed:", err);
      return res.sendStatus(400);
    }

    switch (parsedPayload.type) {
      case "user.created": {
        await clerkService.createUser(parsedPayload.data.id);
        await clerkService.createOrganisation(parsedPayload.data.id);

        res.sendStatus(200);
        break;
      }

      case "user.deleted": {
        await clerkService.deleteUser(parsedPayload.data.id);
        await clerkService.deleteOrganisation(parsedPayload.data.id);
        res.sendStatus(200);
        break;
      }

      case "organization.created": {
        await clerkService.createOrganisation(parsedPayload.data.id);
        res.sendStatus(200);
        break;
      }

      case "organization.deleted": {
        await clerkService.deleteOrganisation(parsedPayload.data.id);
        res.sendStatus(200);
        break;
      }

      default: {
        res.sendStatus(400);
        break;
      }
    }
  });

  /**
   * Generate Clerk sign-in ticket
   */
  router.get("/ticket", async (req: Request, res: Response) => {
    const { isAuthenticated, userId } = getAuth(req);

    if (!isAuthenticated) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    try {
      const ticket = await clerkService.generateSignInToken(userId!);
      return res.status(200).json({ ticket });
    } catch (error) {
      console.error("Failed to generate ticket:", error);
      return res.status(500).json({ error: "Failed to generate token" });
    }
  });

  return router;
}
