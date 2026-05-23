"use client";

import { Suspense, useCallback, useState } from "react";

import { useSearchParams } from "next/navigation";

import { usePageTitle } from "@/hooks/use-page-title";
import { isApiErrorResponse, readJsonResponse } from "@/lib/client-fetch";
import { type Translations, getTranslations } from "@/lib/i18n";
import {
  COUNTRY_COOKIE_NAME,
  type CountryCode,
  DEFAULT_COUNTRY_CODE,
  SUPPORTED_COUNTRY_CODES,
} from "@/lib/types";
import type { AuthApiResponse } from "@/lib/types";

const DEFAULT_REDIRECT = "/";

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginSkeleton />}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const searchParams = useSearchParams();
  const redirectTo = sanitizeRedirectPath(searchParams.get("redirect"));
  const isExpired = searchParams.get("expired") === "true";

  const [countryCode, setCountryCode] = useState<CountryCode>(() => {
    if (typeof document !== "undefined") {
      const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${COUNTRY_COOKIE_NAME}=([^;]+)`));
      const val = match?.[1]?.toUpperCase();
      if (val && (SUPPORTED_COUNTRY_CODES as readonly string[]).includes(val)) {
        return val as CountryCode;
      }
    }
    return DEFAULT_COUNTRY_CODE;
  });

  const t = getTranslations(countryCode);

  usePageTitle(t.loginTitle);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [twoFactorCode, setTwoFactorCode] = useState("");
  const [partialToken, setPartialToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(isExpired ? t.sessionExpired : null);

  const clearError = useCallback(() => {
    if (error) setError(null);
  }, [error]);

  const handleSubmit = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const t = getTranslations(countryCode);
      setError(null);

      // ── 2FA verification step ──────────────────────────────────────────
      if (partialToken) {
        if (twoFactorCode.trim() === "") {
          setError(t.enter2FACode);
          return;
        }

        setIsLoading(true);

        try {
          const response = await fetch("/api/auth/verify-2fa", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              partialToken,
              code: twoFactorCode.trim(),
            }),
          });

          const data = await readJsonResponse<AuthApiResponse>(response, "API_UNREACHABLE");

          if (isApiErrorResponse(data)) {
            setError(mapErrorMessage(data.error, t));
            return;
          }

          if (data.success) {
            window.location.href = redirectTo;
            return;
          }

          setError(mapErrorMessage(data.error, t));
        } catch {
          setError(t.verificationFailed);
        } finally {
          setIsLoading(false);
        }
        return;
      }

      // ── Credentials login ──────────────────────────────────────────────
      if (email.trim() === "" || password === "") {
        setError(t.enterEmailAndPassword);
        return;
      }

      setIsLoading(true);

      try {
        const response = await fetch("/api/auth/login-credentials", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: email.trim(), password, countryCode }),
        });

        const data = await readJsonResponse<AuthApiResponse>(response, "API_UNREACHABLE");

        // Check 2FA_REQUIRED BEFORE isApiErrorResponse, because the 2FA response
        // also has an `error` field and would be caught by isApiErrorResponse first.
        if (
          typeof data === "object" &&
          data !== null &&
          "error" in data &&
          (data as { error: string }).error === "2FA_REQUIRED" &&
          "partialToken" in data &&
          (data as { partialToken: string }).partialToken
        ) {
          setPartialToken((data as { partialToken: string }).partialToken);
          setError(null);
          return;
        }

        if (isApiErrorResponse(data)) {
          setError(mapErrorMessage((data as { error: string }).error, t));
          return;
        }

        if ((data as AuthApiResponse).success) {
          window.location.href = redirectTo;
          return;
        }

        setError(t.genericError);
      } catch {
        setError(t.loginFailed);
      } finally {
        setIsLoading(false);
      }
    },
    [partialToken, twoFactorCode, email, password, countryCode, redirectTo]
  );

  const showTwoFactor = partialToken !== null;

  return (
    <div className="bg-background flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <span
            className="text-picnic-red text-5xl font-bold tracking-tight select-none"
            aria-label="Picnic Web"
          >
            Picnic Web
          </span>
        </div>

        <div className="mb-6 flex justify-center gap-2">
          {SUPPORTED_COUNTRY_CODES.map((code) => (
            <button
              key={code}
              type="button"
              onClick={() => setCountryCode(code)}
              className={`rounded-lg px-4 py-1.5 text-sm font-semibold transition-colors ${
                code === countryCode
                  ? "bg-picnic-red text-white"
                  : "border-input-border hover:text-foreground border text-gray-500"
              }`}
              aria-pressed={code === countryCode}
            >
              {code}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {showTwoFactor ? (
            <div>
              <p className="mb-3 text-sm text-gray-600">{t.smsSent}</p>
              <label
                htmlFor="two-factor-code"
                className="text-foreground mb-1 block text-sm font-medium"
              >
                {t.verificationCodeLabel}
              </label>
              <input
                id="two-factor-code"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={twoFactorCode}
                onChange={(e) => {
                  setTwoFactorCode(e.target.value);
                  clearError();
                }}
                placeholder={t.verificationCodePlaceholder}
                disabled={isLoading}
                autoFocus
                className="border-input-border text-foreground focus:border-input-focus focus:ring-input-focus w-full rounded-lg border px-3 py-2 text-sm placeholder:text-gray-400 focus:ring-1 focus:outline-none disabled:opacity-50"
              />
            </div>
          ) : (
            <>
              <div>
                <label htmlFor="email" className="text-foreground mb-1 block text-sm font-medium">
                  {t.emailLabel}
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    clearError();
                  }}
                  placeholder={t.emailPlaceholder}
                  disabled={isLoading}
                  autoFocus
                  className="border-input-border text-foreground focus:border-input-focus focus:ring-input-focus w-full rounded-lg border px-3 py-2 text-sm placeholder:text-gray-400 focus:ring-1 focus:outline-none disabled:opacity-50"
                />
              </div>
              <div>
                <label
                  htmlFor="password"
                  className="text-foreground mb-1 block text-sm font-medium"
                >
                  {t.passwordLabel}
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    clearError();
                  }}
                  placeholder={t.passwordPlaceholder}
                  disabled={isLoading}
                  className="border-input-border text-foreground focus:border-input-focus focus:ring-input-focus w-full rounded-lg border px-3 py-2 text-sm placeholder:text-gray-400 focus:ring-1 focus:outline-none disabled:opacity-50"
                />
              </div>
            </>
          )}

          {error && (
            <p className="text-sm text-red-600" role="alert">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="bg-picnic-red hover:bg-picnic-red-dark focus:ring-picnic-red flex w-full items-center justify-center rounded-lg px-4 py-2 text-sm font-semibold text-white transition-colors focus:ring-2 focus:ring-offset-2 focus:outline-none disabled:opacity-50"
          >
            {isLoading ? <Spinner ariaLabel={t.loadingAriaLabel} /> : showTwoFactor ? t.verifyButton : t.loginButton}
          </button>
        </form>

        <Disclaimer t={t} />
      </div>
    </div>
  );
}

// ─── Disclaimer ──────────────────────────────────────────────────────────────

const GITHUB_PROJECT_URL = "https://github.com/MRVDH/picnic-web";

function Disclaimer({ t }: { t: Translations }) {
  return (
    <details className="border-card-border mt-3 rounded-lg border bg-white p-4 text-sm text-gray-600">
      <summary className="text-foreground font-medium">{t.isOfficialSite}</summary>
      <div className="mt-3 space-y-3">
        <p>
          {t.isOfficialSiteBody}{" "}
          <a
            href={GITHUB_PROJECT_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-picnic-red hover:text-picnic-red-dark font-medium underline"
          >
            GitHub
          </a>
          .
        </p>
      </div>
    </details>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function mapErrorMessage(code: string | undefined, t: Translations): string {
  switch (code) {
    case "TOKEN_INVALID":
      return t.tokenInvalid;
    case "CREDENTIALS_INVALID":
      return t.credentialsInvalid;
    case "2FA_INVALID":
      return t.twoFAInvalid;
    case "API_UNREACHABLE":
      return t.apiUnreachable;
    default:
      return t.genericError;
  }
}

function sanitizeRedirectPath(value: string | null): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return DEFAULT_REDIRECT;
  }

  try {
    const url = new URL(value, window.location.origin);
    if (url.origin !== window.location.origin) {
      return DEFAULT_REDIRECT;
    }
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return DEFAULT_REDIRECT;
  }
}

// ─── Icons & Loading ─────────────────────────────────────────────────────────

function Spinner({ ariaLabel }: { ariaLabel: string }) {
  return (
    <div
      className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white"
      role="status"
      aria-label={ariaLabel}
    />
  );
}

function LoginSkeleton() {
  return (
    <div className="bg-background flex min-h-screen items-center justify-center px-4">
      <div className="border-t-picnic-red h-5 w-5 animate-spin rounded-full border-2 border-gray-200" />
    </div>
  );
}
