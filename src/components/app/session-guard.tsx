"use client";

import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";
import { useEffect, useState } from "react";

interface SessionGuardProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function SessionGuard({ children, fallback }: SessionGuardProps) {
  const { status, data: session } = useSession();
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (status !== "loading") {
      if (!session?.user) {
        redirect("/api/auth/signin?callbackUrl=/app");
      }
      setIsReady(true);
    }
  }, [status]);

  if (status === "loading" || !isReady) {
    return fallback ?? <div>Loading...</div>;
  }

  return <>{children}</>;
}
