import { AppSidebar } from "@/components/app-sidebar";
import { Chat } from "@/components/chat";
import { Header } from "@/components/app/header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

export default function Page() {
  return (
    <SidebarProvider
      style={{ "--sidebar-width": "350px" } as React.CSSProperties}
    >
      <AppSidebar />
      <SidebarInset>
        <Header />
        <div className="flex flex-1 flex-col gap-4 p-4">
          <Chat />
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
