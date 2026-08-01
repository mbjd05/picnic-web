import type { ErrorComponentProps } from "@tanstack/react-router";

import { ErrorSurface, NotFoundSurface } from "./app-surfaces";
import { CountryProvider } from "../providers/country-context";

export function AppShellError({ error, reset }: ErrorComponentProps) {
  return (
    <CountryProvider>
      <ErrorSurface error={error} onRetry={reset} />
    </CountryProvider>
  );
}

export function RootNotFound() {
  return (
    <CountryProvider>
      <NotFoundSurface />
    </CountryProvider>
  );
}
