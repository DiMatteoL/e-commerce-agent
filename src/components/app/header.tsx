import { SidebarTrigger } from "@/components/ui/sidebar";

export function Header() {
  return (
    <header className="md:hidden bg-background sticky top-0 z-10 flex h-[65px] shrink-0 items-center gap-2 border-b px-4">
      <SidebarTrigger className="-ml-1" />
    </header>
  );
}
