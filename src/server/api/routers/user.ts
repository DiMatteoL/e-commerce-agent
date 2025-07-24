import { eq, desc } from "drizzle-orm";

import { createTRPCRouter, publicProcedure } from "@/server/api/trpc";
import { users, chats } from "@/server/db/schema";
import type { Chat } from "./chat";

export const userRouter = createTRPCRouter({
  // Get current user with their chat titles in backward chronological order
  getUserWithChats: publicProcedure.query(async ({ ctx }) => {
    try {
      // Return empty response if no session
      if (!ctx.session?.user?.id) {
        return {
          user: null,
          chats: [],
        };
      }

      // Get user information
      const user = await ctx.db
        .select({
          id: users.id,
          name: users.name,
          email: users.email,
          image: users.image,
        })
        .from(users)
        .where(eq(users.id, ctx.session.user.id))
        .limit(1);

      if (!user[0]) {
        throw new Error("User not found");
      }

      // Get user's chats ordered by creation date (newest first)
      const userChats = await ctx.db
        .select({
          id: chats.id,
          payload: chats.payload,
          createdAt: chats.createdAt,
        })
        .from(chats)
        .where(eq(chats.userId, ctx.session.user.id))
        .orderBy(desc(chats.createdAt));

      // Extract chat titles and IDs
      const chatTitles = userChats.map((chat) => {
        const chatData = chat.payload as Chat;
        return {
          id: chat.id,
          title: chatData.title ?? "Untitled Chat",
          createdAt: chat.createdAt,
        };
      });

      return {
        user: user[0],
        chats: chatTitles,
      };
    } catch (error) {
      console.error("Error fetching user with chats:", error);
      throw new Error("Failed to fetch user with chats");
    }
  }),
});
