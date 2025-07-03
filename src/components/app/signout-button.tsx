import { signOut } from "next-auth/react";
import * as React from "react";
import { Button, type buttonVariants } from "@/components/ui/button";
import type { VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

export type SignOutButtonProps = React.ComponentProps<typeof Button> &
  VariantProps<typeof buttonVariants>;

export function SignOutButton({
  children = "Sign Out",
  ...props
}: SignOutButtonProps) {
  return (
    <Button
      {...props}
      onClick={(e) => {
        props.onClick?.(e);
        if (!e.defaultPrevented) void signOut({ callbackUrl: "/" });
      }}
    >
      {children}
    </Button>
  );
}
