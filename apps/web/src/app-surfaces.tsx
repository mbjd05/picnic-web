import { useEffect } from "react";

import { Link } from "@tanstack/react-router";

import { useCountryCode, useTranslations } from "./country-context";

export function LoadingSurface({ title }: { title?: string }) {
  const t = useTranslations();

  useEffect(() => {
    document.title = title ? `${title} - Picnic Web` : "Picnic Web";
  }, [title]);

  return (
    <main className="flex min-h-64 flex-1 items-center justify-center" role="status">
      <span className="sr-only">{t.loadingAriaLabel}</span>
      <div
        className="border-t-picnic-red h-10 w-10 animate-spin rounded-full border-4 border-gray-200"
        aria-hidden="true"
      />
    </main>
  );
}

export function ErrorSurface({ error, onRetry }: { error: Error; onRetry?: () => void }) {
  const t = useTranslations();

  return (
    <main className="flex min-h-screen flex-1 flex-col items-center justify-center p-8 text-center">
      <h1 className="text-foreground text-2xl font-bold">{t.errorHeading}</h1>
      <p className="mt-2 text-gray-500">{error.message || t.errorUnexpected}</p>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="bg-picnic-red hover:bg-picnic-red-dark mt-6 rounded-full px-6 py-2.5 text-sm font-medium text-white transition-colors"
        >
          {t.errorRetry}
        </button>
      ) : null}
    </main>
  );
}

export function NotFoundSurface() {
  const countryCode = useCountryCode();
  const isGerman = countryCode === "DE";

  return (
    <main className="flex min-h-screen flex-1 flex-col items-center justify-center p-8 text-center">
      <h1 className="text-foreground text-2xl font-bold">
        {isGerman ? "Seite nicht gefunden" : "Pagina niet gevonden"}
      </h1>
      <Link to="/" className="text-picnic-red mt-4 text-sm font-semibold">
        {isGerman ? "Zur Startseite" : "Naar de startpagina"}
      </Link>
    </main>
  );
}
