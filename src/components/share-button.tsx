import { useEffect, useState } from "react";

import type { ShareInfo } from "@/types/share";

type ShareButtonVariant = "icon" | "inline";

export function ShareButton({
  info,
  title,
  label,
  copiedLabel,
  sharedLabel,
  sharingLabel,
  className = "",
  variant = "inline",
}: {
  info: ShareInfo | null;
  title: string;
  label: string;
  copiedLabel: string;
  sharedLabel: string;
  sharingLabel: string;
  className?: string;
  variant?: ShareButtonVariant;
}) {
  const [status, setStatus] = useState<"idle" | "sharing" | "copied" | "shared">("idle");
  const text = info?.text?.trim() ?? "";
  const url = info?.url?.trim() ?? "";
  const isBusy = status === "sharing";
  const isDone = status === "copied" || status === "shared";
  const feedbackLabel =
    status === "sharing" ? sharingLabel : status === "shared" ? sharedLabel : copiedLabel;

  useEffect(() => {
    if (!isDone) return;
    const timer = setTimeout(() => setStatus("idle"), 1600);
    return () => clearTimeout(timer);
  }, [isDone]);

  if (!text && !url) return null;

  async function handleShare() {
    if (isBusy) return;
    const shareData = url ? { url } : { title, text: text || title };

    setStatus("sharing");

    if (navigator.share) {
      try {
        await navigator.share(shareData);
        setStatus("shared");
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          setStatus("idle");
          return;
        }
      }
    }

    await navigator.clipboard?.writeText(url || text || title);
    setStatus("copied");
  }

  const baseClass =
    variant === "icon"
      ? "flex h-10 w-10 items-center justify-center rounded-full bg-white/95 shadow-sm transition-colors hover:bg-white hover:text-picnic-red active:opacity-70"
      : "border-card-border bg-card-bg text-foreground hover:border-picnic-red hover:text-picnic-red inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors";

  return (
    <span className={className}>
      <span className="relative inline-flex">
        <button
          type="button"
          onClick={() => void handleShare()}
          className={`${baseClass} ${isDone ? "border-picnic-red text-picnic-red" : ""}`}
          aria-label={status === "idle" ? label : feedbackLabel}
          title={status === "idle" ? label : feedbackLabel}
          disabled={isBusy}
        >
          {isDone ? <CheckIcon /> : <ShareIcon />}
          {variant === "inline" ? <span>{status === "idle" ? label : feedbackLabel}</span> : null}
        </button>
        {variant === "icon" && status !== "idle" ? (
          <span
            role="status"
            className="bg-card-bg text-foreground border-card-border absolute top-full left-1/2 mt-2 -translate-x-1/2 rounded-md border px-2.5 py-1 text-xs font-medium whitespace-nowrap shadow-sm"
          >
            {feedbackLabel}
          </span>
        ) : null}
      </span>
    </span>
  );
}

function CheckIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-5 w-5"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth="1.75"
      stroke="currentColor"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
    </svg>
  );
}

function ShareIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-5 w-5"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth="1.5"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M7.217 10.907a2.25 2.25 0 1 0 0 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186 9.566-5.314m-9.566 7.5 9.566 5.314m0 0a2.25 2.25 0 1 0 3.935 2.186 2.25 2.25 0 0 0-3.935-2.186Zm0-12.814a2.25 2.25 0 1 0 3.933-2.185 2.25 2.25 0 0 0-3.933 2.185Z"
      />
    </svg>
  );
}
