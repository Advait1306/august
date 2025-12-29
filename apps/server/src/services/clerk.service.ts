import { eq } from "drizzle-orm";
import { organisations, users } from "@jupiter/sync/db/schema";
import { AppState } from "../config/state";

export class ClerkService {
  constructor(private db: AppState["db"]) {}

  /**
   * Create a new user in the database
   */
  async createUser(userId: string) {
    const userInsert: typeof users.$inferInsert = {
      id: userId,
    };

    await this.db.insert(users).values(userInsert);
  }

  /**
   * Create a new organisation in the database
   */
  async createOrganisation(orgId: string) {
    const isPersonalOrg = orgId.startsWith("user");

    const orgInsert: typeof organisations.$inferInsert = {
      id: orgId,
      wallet: isPersonalOrg ? 500 : 0,
    };

    await this.db.insert(organisations).values(orgInsert);
  }

  /**
   * Delete a user from the database
   */
  async deleteUser(userId: string) {
    await this.db.delete(users).where(eq(users.id, userId));
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
