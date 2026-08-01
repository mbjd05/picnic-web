import { useTranslations } from "../providers/country-context";

export function LoadingView() {
  return (
    <div className="flex justify-center py-16" role="status" aria-label="Laden">
      <span className="border-t-picnic-red h-6 w-6 animate-spin rounded-full border-2 border-gray-200" />
    </div>
  );
}

export function ErrorView({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const t = useTranslations();
  return (
    <div className="py-16 text-center">
      <p className="text-sm text-red-600" role="alert">
        {message}
      </p>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="text-picnic-red mt-3 text-sm font-semibold hover:underline"
        >
          {t.retryButton}
        </button>
      ) : null}
    </div>
  );
}

export function BackButton({ onClick }: { onClick: () => void }) {
  const t = useTranslations();
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-picnic-red mb-4 flex items-center gap-1 text-sm font-medium hover:underline"
    >
      <span aria-hidden="true">←</span> {t.backButton}
    </button>
  );
}
