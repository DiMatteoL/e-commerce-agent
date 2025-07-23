import { z } from "zod";
import { eq, desc, and, isNotNull, isNull } from "drizzle-orm";

import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { chats } from "@/server/db/schema";

// Define the Chat type interface based on the server actions
export interface Chat {
  id: string;
  title?: string;
  createdAt: Date;
  userId: string;
  path: string;
  messages: Array<{
    id: string;
    content: string;
    role: "user" | "assistant" | "system";
  }>;
  sharePath?: string;
}

export const chatRouter = createTRPCRouter({
  // Get all chats for the current user
  getChats: protectedProcedure.query(async ({ ctx }) => {
    try {
      const data = await ctx.db
        .select()
        .from(chats)
        .where(eq(chats.userId, ctx.session.user.id))
        .orderBy(desc(chats.createdAt));

      return (data?.map((entry) => entry.payload) as Chat[]) ?? [];
    } catch (error) {
      return [];
    }
  }),

  // Get a single chat by ID
  getChat: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const data = await ctx.db
        .select()
        .from(chats)
        .where(
          and(eq(chats.id, input.id), eq(chats.userId, ctx.session.user.id)),
        )
        .limit(1);

      return (data[0]?.payload as Chat) ?? null;
    }),

  // Remove a chat by ID
  removeChat: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      try {
        await ctx.db
          .delete(chats)
          .where(
            and(eq(chats.id, input.id), eq(chats.userId, ctx.session.user.id)),
          );

        return { success: true };
      } catch (error) {
        return {
          error: "Unauthorized",
        };
      }
    }),

  // Clear all chats for the current user
  clearChats: protectedProcedure.mutation(async ({ ctx }) => {
    try {
      await ctx.db.delete(chats).where(eq(chats.userId, ctx.session.user.id));

      return { success: true };
    } catch (error) {
      console.log("clear chats error", error);
      return {
        error: "Unauthorized",
      };
    }
  }),

  // Get a shared chat (public access to chats with sharePath)
  getSharedChat: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const data = await ctx.db
        .select()
        .from(chats)
        .where(eq(chats.id, input.id))
        .limit(1);

      const chat = data[0]?.payload as Chat;

      // Only return if the chat has a sharePath (is shared)
      if (chat?.sharePath) {
        return chat;
      }

      return null;
    }),

  // Share a chat by adding a sharePath
  shareChat: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        chat: z.custom<Chat>(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const payload = {
        ...input.chat,
        sharePath: `/share/${input.chat.id}`,
      };

      await ctx.db
        .update(chats)
        .set({ payload: payload as any })
        .where(
          and(eq(chats.id, input.id), eq(chats.userId, ctx.session.user.id)),
        );

      return payload;
    }),

  // Save/Create a new chat
  saveChat: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        chat: z.custom<Chat>(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        await ctx.db
          .insert(chats)
          .values({
            id: input.id,
            userId: ctx.session.user.id,
            payload: input.chat as any,
          })
          .onConflictDoUpdate({
            target: chats.id,
            set: {
              payload: input.chat as any,
              updatedAt: new Date(),
            },
          });

        return { success: true };
      } catch (error) {
        console.log("save chat error", error);
        return {
          error: "Failed to save chat",
        };
      }
    }),

  // Get a single chat by ID, or claim it if it's unowned
  getChatOrClaim: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // First, try to get the chat if it's owned by the current user
      const userOwnedChat = await ctx.db
        .select()
        .from(chats)
        .where(
          and(eq(chats.id, input.id), eq(chats.userId, ctx.session.user.id)),
        )
        .limit(1);

      if (userOwnedChat[0]) {
        return userOwnedChat[0].payload as Chat;
      }

      // If not found, check if there's an unowned chat with this ID
      const unownedChat = await ctx.db
        .select()
        .from(chats)
        .where(and(eq(chats.id, input.id), isNull(chats.userId)))
        .limit(1);

      if (unownedChat[0]) {
        // Claim the chat by updating its userId
        await ctx.db
          .update(chats)
          .set({
            userId: ctx.session.user.id,
            updatedAt: new Date(),
          })
          .where(eq(chats.id, input.id));

        return unownedChat[0].payload as Chat;
      }

      // Chat not found or owned by another user
      return null;
    }),
});
