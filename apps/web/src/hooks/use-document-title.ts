import { useEffect } from "react";

import { APP_NAME, MAX_TITLE_CONTEXT_LENGTH, TITLE_SEPARATOR } from "@/lib/config/constants";

export function useDocumentTitle(title?: string) {
  useEffect(() => {
    const context =
      title && title.length > MAX_TITLE_CONTEXT_LENGTH
        ? `${title.slice(0, MAX_TITLE_CONTEXT_LENGTH - 3)}...`
        : title;
    document.title = context ? `${context}${TITLE_SEPARATOR}${APP_NAME}` : APP_NAME;
  }, [title]);
}
