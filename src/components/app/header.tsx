import { SidebarTrigger } from "@/components/ui/sidebar";

export function Header() {
  return (
    <header className="bg-background sticky top-0 flex shrink-0 items-center gap-2 border-b p-4">
      <SidebarTrigger className="-ml-1" />
    </header>
  );
}
