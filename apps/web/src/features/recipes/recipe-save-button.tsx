import { useTranslations } from "../../providers/country-context";
import { BookmarkIcon } from "./recipe-icons";

export function RecipeSaveButton({
  isSaved,
  isSaving,
  onToggle,
}: {
  isSaved: boolean;
  isSaving: boolean;
  onToggle: () => void;
}) {
  const t = useTranslations();
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={isSaving}
      className={`hover:text-picnic-red absolute top-3 right-3 flex h-10 w-10 items-center justify-center rounded-full bg-white/95 shadow-sm transition-colors hover:bg-white active:opacity-70 disabled:opacity-50 ${
        isSaved ? "text-picnic-red" : "text-text-muted"
      }`}
      aria-label={isSaved ? t.unsaveRecipe : t.saveRecipe}
    >
      <BookmarkIcon filled={isSaved} />
    </button>
  );
}
