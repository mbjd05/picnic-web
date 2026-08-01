import { useTranslations } from "../../country-context";

export function DeliverySlotBanner({
  bannerText,
  isExplicit,
  onTap,
}: {
  bannerText: string;
  isExplicit: boolean;
  onTap: () => void;
}) {
  const t = useTranslations();
  return (
    <button
      type="button"
      onClick={onTap}
      className="group flex w-full items-center gap-3 rounded-2xl bg-gray-100 px-4 py-3 text-left transition-all hover:bg-gray-200 hover:shadow-md active:scale-[0.99] sm:gap-3.5 sm:px-5 sm:py-4"
    >
      <div className="relative shrink-0 rounded-xl bg-white p-2 shadow-sm">
        <TruckIcon />
        <div className="absolute -right-0.5 -bottom-0.5">
          <ClockIcon />
        </div>
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <span
          className={`text-sm ${isExplicit ? "text-foreground font-semibold" : "font-medium text-gray-500"}`}
        >
          {bannerText}
        </span>
        {!isExplicit ? <span className="text-xs text-gray-400">{t.tapToChoose}</span> : null}
      </div>
      <ChevronRightIcon />
    </button>
  );
}

function TruckIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M3 4h13v10H3V4Zm13 4h3l2 3v3h-5V8ZM6.5 18a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3Zm11 0a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3Z"
        stroke="#1f2937"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
      <circle cx="6" cy="6" r="5" fill="white" stroke="#1f2937" strokeWidth="1" />
      <path
        d="M6 3.5V6l2 1"
        stroke="#1f2937"
        strokeWidth="1"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ChevronRightIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 18 18"
      fill="none"
      aria-hidden="true"
      className="shrink-0 text-gray-400 transition-transform group-hover:translate-x-0.5"
    >
      <path
        d="M7 4.5l4.5 4.5-4.5 4.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
