import { eq } from "drizzle-orm";
import { organisations, users } from "@jupiter/sync/db/schema";
import { AppState } from "../config/state";

export class ClerkService {
  private static instance: ClerkService;

  private constructor(private db: AppState["db"]) {}

  public static getInstance(db: AppState["db"]): ClerkService {
    if (!ClerkService.instance) {
      ClerkService.instance = new ClerkService(db);
    }
    return ClerkService.instance;
  }

  /**
   * Create a new user in the database (upsert to handle out-of-order webhooks)
   */
  async createUser(userId: string) {
    await this.db
      .insert(users)
      .values({ id: userId })
      .onConflictDoNothing({ target: users.id });
  }

  /**
   * Create a new organisation in the database (upsert to handle out-of-order webhooks)
   */
  async createOrganisation(orgId: string) {
    await this.db
      .insert(organisations)
      .values({
        id: orgId,
      })
      .onConflictDoNothing({ target: organisations.id });
  }

  /**
   * Soft delete a user (set deleted_at timestamp)
   */
  async deleteUser(userId: string) {
    await this.db
      .update(users)
      .set({ deleted_at: new Date() })
      .where(eq(users.id, userId));
  }

  /**
   * Soft delete an organisation (set deleted_at timestamp)
   * Does not remove from DB, maintains Dodo Payments customer record
   */
  async deleteOrganisation(orgId: string) {
    await this.db
      .update(organisations)
      .set({ deleted_at: new Date() })
      .where(eq(organisations.id, orgId));
    console.log(`Soft deleted organisation ${orgId}`);
  }

  /**
   * Generate a Clerk sign-in token for a user
   */
  async generateSignInToken(userId: string): Promise<string> {
    const response = await fetch("https://api.clerk.com/v1/sign_in_tokens", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.CLERK_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        user_id: userId,
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error("Clerk API error:", errorData);
      throw new Error("Failed to generate token");
    }

    const data = await response.json();
    return data.token;
  }
}
