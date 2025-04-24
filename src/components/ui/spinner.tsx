import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface SpinnerProps {
  className?: string;
  size?: number; // Optional size prop
}

export function Spinner({ className, size = 24 }: SpinnerProps) {
  return (
    <Loader2 
      className={cn("animate-spin text-primary", className)} 
      size={size} 
      aria-label="Loading..." // Basic accessibility label
    />
  );
} 