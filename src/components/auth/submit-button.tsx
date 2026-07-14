import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

interface SubmitButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  loading?: boolean;
}

export function SubmitButton({
  loading,
  disabled,
  className,
  children,
  ...props
}: SubmitButtonProps) {
  return (
    <button
      type="submit"
      disabled={disabled || loading}
      className={cn(
        "flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-primary text-sm font-semibold text-primary-foreground transition-colors",
        "hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring/40 focus:ring-offset-2",
        "disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground",
        className,
      )}
      {...props}
    >
      {loading && (
        <span
          className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"
          aria-hidden="true"
        />
      )}
      {children}
    </button>
  );
}
