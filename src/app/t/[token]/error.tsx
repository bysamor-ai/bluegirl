"use client";

import ErrorBoundaryView from "@/components/ErrorBoundaryView";

export default function Error({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <ErrorBoundaryView reset={reset} />;
}
