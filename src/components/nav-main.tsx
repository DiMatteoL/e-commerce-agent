"use client";

import { History } from "lucide-react";
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

export function NavMain() {
  const t = useTranslations("Sidebar");
  const { data: userWithChats, isLoading } =
    api.user.getUserWithChats.useQuery();

  // Get the last 40 chats
  const recentChats = userWithChats?.chats.slice(0, 40) ?? [];

  if (isLoading) {
    return (
      <SidebarGroup>
        <SidebarGroupLabel>{t("history")}</SidebarGroupLabel>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton disabled>
              <span>Loading...</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarGroup>
    );
  }

  return (
    <SidebarGroup>
      <SidebarGroupLabel>{t("history")}</SidebarGroupLabel>
      <SidebarMenu>
        {recentChats.length === 0 ? (
          <SidebarMenuItem>
            <SidebarMenuButton disabled>
              <History className="h-4 w-4" />
              <span>No chats yet</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        ) : (
          recentChats.map((chat) => (
            <SidebarMenuItem key={chat.id}>
              <SidebarMenuButton asChild tooltip={chat.title}>
                <Link href={`/chat/${chat.id}`}>
                  <span className="truncate">{chat.title}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))
        )}
      </SidebarMenu>
    </SidebarGroup>
  );
}
