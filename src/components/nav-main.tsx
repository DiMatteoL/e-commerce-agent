"use client";

import { History, MessageSquare } from "lucide-react";
import { useTranslations } from "next-intl";

import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { api } from "@/trpc/react";
import { Link } from "@/i18n/navigation";
import { Skeleton } from "@/components/ui/skeleton";

export function NavMain() {
  const t = useTranslations("Sidebar");
  const { data: userWithChats, isLoading } =
    api.user.getUserWithChats.useQuery();

  // Get the last 40 chats
  const recentChats = userWithChats?.chats.slice(0, 40) ?? [];

  if (isLoading) {
    return (
      <SidebarGroup>
        <SidebarGroupLabel className="text-xs font-semibold text-sidebar-foreground/70">
          {t("history")}
        </SidebarGroupLabel>
        <SidebarMenu className="gap-1">
          {Array.from({ length: 5 }).map((_, i) => (
            <SidebarMenuItem key={i}>
              <div className="py-2">
                <Skeleton className="h-4 w-full" />
              </div>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroup>
    );
  }

  return (
    <SidebarGroup>
      <SidebarGroupLabel className="text-xs font-semibold text-sidebar-foreground/70">
        {t("history")}
      </SidebarGroupLabel>
      <SidebarMenu className="gap-1">
        {recentChats.length === 0 ? (
          <SidebarMenuItem>
            <SidebarMenuButton
              disabled
              className="text-sidebar-foreground/50"
            >
              <History className="h-4 w-4" />
              <span>No chats yet</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        ) : (
          recentChats.map((chat) => (
            <SidebarMenuItem key={chat.id}>
              <SidebarMenuButton
                asChild
                tooltip={chat.title}
                className="group relative rounded-md transition-all hover:bg-sidebar-accent"
              >
                <Link href={`/chat/${chat.id}`} className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 shrink-0 opacity-60 group-hover:opacity-100 transition-opacity" />
                  <span className="truncate text-sm">{chat.title}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))
        )}
      </SidebarMenu>
    </SidebarGroup>
  );
}
