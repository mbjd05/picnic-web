export function RecipeSearchInput({
  value,
  placeholder,
  onChange,
}: {
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="relative flex-1 sm:max-w-xs">
      <input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="focus:border-picnic-red focus:ring-picnic-red w-full rounded-xl border border-gray-200 bg-white py-2.5 pr-4 pl-4 text-sm shadow-sm transition-colors placeholder:text-gray-400 focus:ring-2 focus:outline-none"
      />
    </div>
  );
}
