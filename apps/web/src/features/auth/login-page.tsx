import { useCallback, useEffect, useState } from "react";

import { useForm } from "@tanstack/react-form";
import { useSearch } from "@tanstack/react-router";

import { type Translations, getTranslations } from "@/lib/i18n/translations";
import type { AuthApiResponse, SwitchCountryResponse } from "@/types/auth";
import type { CountryCode } from "@/types/locale";
import { SUPPORTED_COUNTRY_CODES } from "@/types/locale";

import { useCountryCode } from "../../app/providers/country-context";
import { ApiClientError, fetchJson } from "../../lib/api-client";

const DEFAULT_REDIRECT = "/";
const PICNIC_API_NPM_URL = "https://www.npmjs.com/package/picnic-api";
const GITHUB_PROJECT_URL = "https://github.com/MRVDH/picnic-web";

type LoginMode = "credentials" | "token";

export function LoginPage() {
  const search = useSearch({ from: "/standalone/login" });
  const initialCountryCode = useCountryCode();
  const [countryCode, setCountryCode] = useState<CountryCode>(initialCountryCode);
  const t = getTranslations(countryCode);

  useEffect(() => {
    document.title = `${t.loginTitle} | Picnic Web`;
    document.documentElement.lang = countryCode.toLowerCase();
  }, [countryCode, t.loginTitle]);

  return (
    <LoginForm
      countryCode={countryCode}
      setCountryCode={setCountryCode}
      redirectTo={sanitizeRedirectPath(search.redirect)}
      isExpired={search.expired === true}
      t={t}
    />
  );
}

function LoginForm({
  countryCode,
  setCountryCode,
  redirectTo,
  isExpired,
  t,
}: {
  countryCode: CountryCode;
  setCountryCode: (code: CountryCode) => void;
  redirectTo: string;
  isExpired: boolean;
  t: Translations;
}) {
  const [showPassword, setShowPassword] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [loginMode, setLoginMode] = useState<LoginMode>("credentials");
  const [partialToken, setPartialToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(isExpired ? t.sessionExpired : null);

  const clearError = useCallback(() => setError(null), []);

  async function handleCountrySelect(code: CountryCode) {
    setCountryCode(code);
    setPartialToken(null);
    form.setFieldValue("twoFactorCode", "");
    setError(null);

    try {
      const data = await fetchJson<SwitchCountryResponse>("/api/auth/switch-country", {
        method: "POST",
        body: JSON.stringify({ countryCode: code }),
      });
      if (data.authenticated) {
        window.location.assign(redirectTo);
      }
    } catch {
      // The selected region still applies to the login form even if persistence fails.
    }
  }

  async function submitAuth(path: string, body: object, failureMessage: string) {
    setIsLoading(true);
    try {
      const data = await fetchJson<AuthApiResponse>(path, {
        method: "POST",
        body: JSON.stringify(body),
      });

      if (isTwoFactorResponse(data)) {
        setPartialToken(data.partialToken);
        form.setFieldValue("twoFactorCode", "");
        setError(null);
        return;
      }
      if (data.success) {
        window.location.assign(redirectTo);
        return;
      }
      setError(mapErrorMessage(data.error, t));
    } catch (caught) {
      const code = caught instanceof ApiClientError ? getApiErrorCode(caught) : undefined;
      setError(code ? mapErrorMessage(code, t) : failureMessage);
    } finally {
      setIsLoading(false);
    }
  }

  const form = useForm({
    defaultValues: {
      email: "",
      password: "",
      token: "",
      twoFactorCode: "",
    },
    onSubmit: async ({ value }) => {
      setError(null);

      if (partialToken) {
        const code = value.twoFactorCode.trim();
        if (!code) {
          setError(t.enter2FACode);
          return;
        }
        await submitAuth("/api/auth/verify-2fa", { partialToken, code }, t.verificationFailed);
        return;
      }

      if (loginMode === "token") {
        const trimmedToken = value.token.trim();
        if (!trimmedToken) {
          setError(t.enterToken);
          return;
        }
        await submitAuth(
          "/api/auth/login",
          { token: trimmedToken, countryCode },
          t.tokenVerifyFailed
        );
        return;
      }

      if (!value.email.trim() || !value.password) {
        setError(t.enterEmailAndPassword);
        return;
      }
      await submitAuth(
        "/api/auth/login-credentials",
        { email: value.email.trim(), password: value.password, countryCode },
        t.loginFailed
      );
    },
  });

  const showTwoFactor = partialToken !== null;

  return (
    <main className="bg-background flex min-h-screen items-center justify-center px-4 py-8">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <span
            className="text-picnic-red text-5xl font-bold tracking-normal select-none"
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
              onClick={() => void handleCountrySelect(code)}
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

        <form
          onSubmit={(event) => {
            event.preventDefault();
            event.stopPropagation();
            void form.handleSubmit();
          }}
          className="space-y-4"
        >
          {showTwoFactor ? (
            <form.Field name="twoFactorCode">
              {(field) => (
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
                    value={field.state.value}
                    onChange={(event) => {
                      field.handleChange(event.target.value);
                      clearError();
                    }}
                    placeholder={t.verificationCodePlaceholder}
                    disabled={isLoading}
                    autoFocus
                    className="border-input-border text-foreground focus:border-input-focus focus:ring-input-focus w-full rounded-lg border px-3 py-2 text-sm placeholder:text-gray-400 focus:ring-1 focus:outline-none disabled:opacity-50"
                  />
                </div>
              )}
            </form.Field>
          ) : (
            <>
              <ModeSelector
                loginMode={loginMode}
                setLoginMode={setLoginMode}
                t={t}
                clearError={clearError}
              />
              <p className="text-sm text-gray-500">
                {loginMode === "credentials" ? t.credentialsLoginHelp : t.tokenLoginHelp}
              </p>
              {loginMode === "credentials" ? (
                <>
                  <form.Field name="email">
                    {(field) => (
                      <EmailField
                        value={field.state.value}
                        isLoading={isLoading}
                        t={t}
                        onChange={(value) => {
                          field.handleChange(value);
                          clearError();
                        }}
                      />
                    )}
                  </form.Field>
                  <form.Field name="password">
                    {(field) => (
                      <PasswordField
                        value={field.state.value}
                        showPassword={showPassword}
                        isLoading={isLoading}
                        t={t}
                        onChange={(value) => {
                          field.handleChange(value);
                          clearError();
                        }}
                        setShowPassword={setShowPassword}
                      />
                    )}
                  </form.Field>
                </>
              ) : (
                <form.Field name="token">
                  {(field) => (
                    <TokenField
                      token={field.state.value}
                      showToken={showToken}
                      isLoading={isLoading}
                      t={t}
                      setToken={(value) => {
                        field.handleChange(value);
                        clearError();
                      }}
                      setShowToken={setShowToken}
                    />
                  )}
                </form.Field>
              )}
            </>
          )}

          {error ? (
            <p className="text-sm text-red-600" role="alert">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={isLoading}
            className="bg-picnic-red hover:bg-picnic-red-dark focus:ring-picnic-red flex w-full items-center justify-center rounded-lg px-4 py-2 text-sm font-semibold text-white transition-colors focus:ring-2 focus:ring-offset-2 focus:outline-none disabled:opacity-50"
          >
            {isLoading ? (
              <Spinner ariaLabel={t.loadingAriaLabel} />
            ) : showTwoFactor ? (
              t.verifyButton
            ) : (
              t.loginButton
            )}
          </button>
        </form>

        {loginMode === "token" && !showTwoFactor ? (
          <TokenInstructions countryCode={countryCode} t={t} />
        ) : null}
        <WhyAuthToken t={t} />
        <Disclaimer t={t} />
      </div>
    </main>
  );
}

function ModeSelector({
  loginMode,
  setLoginMode,
  t,
  clearError,
}: {
  loginMode: LoginMode;
  setLoginMode: (mode: LoginMode) => void;
  t: Translations;
  clearError: () => void;
}) {
  function selectMode(mode: LoginMode) {
    setLoginMode(mode);
    clearError();
  }

  return (
    <div className="grid grid-cols-2 rounded-lg bg-gray-100 p-1">
      {(["credentials", "token"] as const).map((mode) => (
        <button
          key={mode}
          type="button"
          onClick={() => selectMode(mode)}
          className={`rounded-md px-3 py-1.5 text-sm font-semibold transition-colors ${
            loginMode === mode ? "text-foreground bg-white shadow-sm" : "text-gray-500"
          }`}
          aria-pressed={loginMode === mode}
        >
          {mode === "credentials" ? t.loginWithCredentials : t.loginWithToken}
        </button>
      ))}
    </div>
  );
}

function EmailField({
  value,
  isLoading,
  t,
  onChange,
}: {
  value: string;
  isLoading: boolean;
  t: Translations;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label htmlFor="email" className="text-foreground mb-1 block text-sm font-medium">
        {t.emailLabel}
      </label>
      <input
        id="email"
        type="email"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={t.emailPlaceholder}
        disabled={isLoading}
        autoFocus
        autoComplete="email"
        className="border-input-border text-foreground focus:border-input-focus focus:ring-input-focus w-full rounded-lg border px-3 py-2 text-sm placeholder:text-gray-400 focus:ring-1 focus:outline-none disabled:opacity-50"
      />
    </div>
  );
}

function PasswordField({
  value,
  showPassword,
  isLoading,
  t,
  onChange,
  setShowPassword,
}: {
  value: string;
  showPassword: boolean;
  isLoading: boolean;
  t: Translations;
  onChange: (value: string) => void;
  setShowPassword: (value: boolean) => void;
}) {
  return (
    <div>
      <label htmlFor="password" className="text-foreground mb-1 block text-sm font-medium">
        {t.passwordLabel}
      </label>
      <SecretField
        id="password"
        value={value}
        visible={showPassword}
        placeholder={t.passwordPlaceholder}
        autoComplete="current-password"
        disabled={isLoading}
        showLabel={t.showToken}
        hideLabel={t.hideToken}
        onChange={onChange}
        onToggle={() => setShowPassword(!showPassword)}
      />
    </div>
  );
}

function TokenField({
  token,
  showToken,
  isLoading,
  t,
  setToken,
  setShowToken,
}: {
  token: string;
  showToken: boolean;
  isLoading: boolean;
  t: Translations;
  setToken: (value: string) => void;
  setShowToken: (value: boolean) => void;
}) {
  return (
    <div>
      <label htmlFor="auth-token" className="text-foreground mb-1 block text-sm font-medium">
        {t.authTokenLabel}
      </label>
      <SecretField
        id="auth-token"
        value={token}
        visible={showToken}
        placeholder={t.tokenPlaceholder}
        autoComplete="off"
        disabled={isLoading}
        autoFocus
        showLabel={t.showToken}
        hideLabel={t.hideToken}
        onChange={setToken}
        onToggle={() => setShowToken(!showToken)}
      />
    </div>
  );
}

function SecretField({
  id,
  value,
  visible,
  placeholder,
  autoComplete,
  disabled,
  autoFocus,
  showLabel,
  hideLabel,
  onChange,
  onToggle,
}: {
  id: string;
  value: string;
  visible: boolean;
  placeholder: string;
  autoComplete: string;
  disabled: boolean;
  autoFocus?: boolean;
  showLabel: string;
  hideLabel: string;
  onChange: (value: string) => void;
  onToggle: () => void;
}) {
  return (
    <div className="relative">
      <input
        id={id}
        type={visible ? "text" : "password"}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        disabled={disabled}
        autoFocus={autoFocus}
        className="border-input-border text-foreground focus:border-input-focus focus:ring-input-focus w-full rounded-lg border px-3 py-2 pr-10 text-sm placeholder:text-gray-400 focus:ring-1 focus:outline-none disabled:opacity-50"
      />
      <button
        type="button"
        onClick={onToggle}
        disabled={disabled}
        className="absolute top-1/2 right-2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 disabled:opacity-50"
        aria-label={visible ? hideLabel : showLabel}
      >
        {visible ? <EyeOffIcon /> : <EyeIcon />}
      </button>
    </div>
  );
}

function TokenInstructions({ countryCode, t }: { countryCode: CountryCode; t: Translations }) {
  const snippet = `import PicnicClient from "picnic-api";\n\nconst client = new PicnicClient({ countryCode: "${countryCode}" });\nawait client.auth.login("${t.codeSnippetEmail}", "${t.codeSnippetPassword}");\nconsole.log(client.authKey);`;
  return (
    <details className="border-card-border mt-6 rounded-lg border bg-white p-4 text-sm text-gray-600">
      <summary className="text-foreground font-medium">{t.howToGetToken}</summary>
      <div className="mt-3 space-y-3">
        <p>
          {t.npmPackageUseBefore}{" "}
          <a
            href={PICNIC_API_NPM_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-picnic-red hover:text-picnic-red-dark font-medium underline"
          >
            picnic-api
          </a>{" "}
          {t.npmPackageText}
        </p>
        <pre className="overflow-x-auto rounded-md bg-gray-100 p-3 text-xs leading-relaxed">
          <code>{snippet}</code>
        </pre>
        <p>
          {t.copyAuthKeyBefore} <code className="rounded bg-gray-100 px-1">authKey</code>{" "}
          {t.copyAuthKeyAfter}
        </p>
      </div>
    </details>
  );
}

function WhyAuthToken({ t }: { t: Translations }) {
  return (
    <details className="border-card-border mt-3 rounded-lg border bg-white p-4 text-sm text-gray-600">
      <summary className="text-foreground font-medium">{t.whyAuthToken}</summary>
      <p className="mt-3">{t.whyAuthTokenBody}</p>
    </details>
  );
}

function Disclaimer({ t }: { t: Translations }) {
  return (
    <details className="border-card-border mt-3 rounded-lg border bg-white p-4 text-sm text-gray-600">
      <summary className="text-foreground font-medium">{t.isOfficialSite}</summary>
      <p className="mt-3">
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
    </details>
  );
}

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

function getApiErrorCode(error: ApiClientError): string | undefined {
  if (error.code) return error.code;
  if (typeof error.payload !== "object" || error.payload === null) return undefined;

  const payloadError = "error" in error.payload ? error.payload.error : undefined;
  return typeof payloadError === "string" ? payloadError : undefined;
}

function sanitizeRedirectPath(value: string | undefined): string {
  if (!value?.startsWith("/") || value.startsWith("//")) return DEFAULT_REDIRECT;

  try {
    const url = new URL(value, window.location.origin);
    return url.origin === window.location.origin
      ? `${url.pathname}${url.search}${url.hash}`
      : DEFAULT_REDIRECT;
  } catch {
    return DEFAULT_REDIRECT;
  }
}

function isTwoFactorResponse(
  data: AuthApiResponse
): data is { success: false; error: "2FA_REQUIRED"; partialToken: string } {
  return !data.success && data.error === "2FA_REQUIRED" && "partialToken" in data;
}

function Spinner({ ariaLabel }: { ariaLabel: string }) {
  return (
    <span
      className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white"
      role="status"
      aria-label={ariaLabel}
    />
  );
}

function EyeIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden="true">
      <path d="M10 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z" />
      <path
        fillRule="evenodd"
        d="M.664 10.59a1.651 1.651 0 0 1 0-1.186A10.004 10.004 0 0 1 10 3c4.257 0 7.893 2.66 9.336 6.41.147.381.146.804 0 1.186A10.004 10.004 0 0 1 10 17c-4.257 0-7.893-2.66-9.336-6.41ZM14 10a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden="true">
      <path
        fillRule="evenodd"
        d="M3.28 2.22a.75.75 0 0 0-1.06 1.06l14.5 14.5a.75.75 0 1 0 1.06-1.06l-1.745-1.745a10.029 10.029 0 0 0 3.3-4.38 1.651 1.651 0 0 0 0-1.185A10.004 10.004 0 0 0 9.999 3a9.956 9.956 0 0 0-4.744 1.194L3.28 2.22ZM7.752 6.69l1.092 1.092a2.5 2.5 0 0 1 3.374 3.373l1.092 1.092a4 4 0 0 0-5.558-5.558Z"
        clipRule="evenodd"
      />
      <path d="m10.748 13.93 2.523 2.523A9.987 9.987 0 0 1 10 17a10.004 10.004 0 0 1-9.336-6.41 1.651 1.651 0 0 1 0-1.186 10.007 10.007 0 0 1 2.638-3.55l2.328 2.328a4 4 0 0 0 5.118 5.748Z" />
    </svg>
  );
}
