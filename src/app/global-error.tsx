"use client";

import { useEffect } from "react";

/**
 * Global error boundary. Replaces the root layout when an error is thrown in
 * the layout itself (before the normal error.tsx can render). Must render its
 * own <html>/<body>.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Global error boundary:", error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          fontFamily:
            "system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif",
          display: "flex",
          minHeight: "100vh",
          alignItems: "center",
          justifyContent: "center",
          margin: 0,
          padding: "2rem",
          background: "#fff",
          color: "#111",
        }}
      >
        <div style={{ textAlign: "center", maxWidth: 480 }}>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 700 }}>
            Application error
          </h1>
          <p style={{ color: "#555", marginTop: "0.5rem" }}>
            A critical error occurred. Please reload the application.
          </p>
          {error.digest && (
            <p
              style={{
                fontSize: "0.75rem",
                color: "#888",
                marginTop: "0.5rem",
                fontFamily: "monospace",
              }}
            >
              Reference: {error.digest}
            </p>
          )}
          <button
            onClick={reset}
            style={{
              marginTop: "1.5rem",
              padding: "0.5rem 1rem",
              borderRadius: 6,
              border: "none",
              background: "#111",
              color: "#fff",
              fontSize: "0.875rem",
              cursor: "pointer",
            }}
          >
            Reload
          </button>
        </div>
      </body>
    </html>
  );
}
