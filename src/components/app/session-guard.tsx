"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";

interface SessionGuardProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function SessionGuard({ children, fallback }: SessionGuardProps) {
  const { status } = useSession();
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (status !== "loading") {
      setIsReady(true);
    }
  }, [status]);

  if (status === "loading" || !isReady) {
    return fallback ?? <div>Loading...</div>;
  }

  return <>{children}</>;
}
