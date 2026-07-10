"use client";

import { useEffect } from "react";
import Link from "next/link";

/**
 * Route-segment error boundary. Catches render/data errors thrown inside the
 * main content area and shows a recoverable fallback while keeping the nav
 * chrome (from the root layout) intact.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Surfaced in server logs via the framework; also log client-side.
    console.error("Route error boundary:", error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center py-16 space-y-4 text-center">
      <h1 className="text-2xl font-bold">Something went wrong</h1>
      <p className="text-muted-foreground max-w-md">
        An unexpected error occurred while rendering this page. You can retry, or
        return to the workspace.
      </p>
      {error.digest && (
        <p className="text-xs text-muted-foreground font-mono">
          Reference: {error.digest}
        </p>
      )}
      <div className="flex gap-3 pt-2">
        <button
          onClick={reset}
          className="inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          Try again
        </button>
        <Link
          href="/dashboard"
          className="inline-flex items-center rounded-md border px-4 py-2 text-sm font-medium hover:bg-accent"
        >
          Go to dashboard
        </Link>
      </div>
    </div>
  );
}
