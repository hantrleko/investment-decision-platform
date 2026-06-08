"use client";

interface TagInputProps {
  value: string;
  onChange: (value: string) => void;
}

export function TagInput({ value, onChange }: TagInputProps) {
  const tags = value
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);

  return (
    <div>
      <div className="flex flex-wrap gap-1 mb-1">
        {tags.map((tag, i) => (
          <span
            key={i}
            className="inline-flex items-center rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium text-secondary-foreground"
          >
            {tag}
            <button
              type="button"
              onClick={() => {
                const newTags = tags.filter((_, idx) => idx !== i);
                onChange(newTags.join(", "));
              }}
              className="ml-1 text-muted-foreground hover:text-foreground"
            >
              ×
            </button>
          </span>
        ))}
      </div>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Comma-separated tags (e.g. earnings, macro, thesis)"
        className="w-full rounded-md border bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
      />
    </div>
  );
}
