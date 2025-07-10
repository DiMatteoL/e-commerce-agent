import { cn } from "@/lib/utils";

interface SpinnerProps {
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function Spinner({ size = "md", className }: SpinnerProps) {
  const sizeClasses = {
    sm: "h-4 w-4",
    md: "h-8 w-8",
    lg: "h-12 w-12",
  };

  return (
    <div className="flex items-center justify-center">
      <div
        className={cn(
          "animate-spin rounded-full border-2 border-gray-300 border-t-gray-900 dark:border-gray-600 dark:border-t-gray-100",
          sizeClasses[size],
          className,
        )}
      />
    </div>
  );
}

interface CenteredSpinnerProps {
  size?: "sm" | "md" | "lg";
  text?: string;
  className?: string;
}

export function CenteredSpinner({
  size = "md",
  text,
  className,
}: CenteredSpinnerProps) {
  return (
    <div
      className={cn(
        "flex min-h-screen flex-col items-center justify-center gap-4",
        className,
      )}
    >
      <Spinner size={size} />
      {text && <p className="text-muted-foreground text-sm">{text}</p>}
    </div>
  );
}
