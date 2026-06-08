"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { TipTapEditor } from "@/components/research/editor";
import { TagInput } from "@/components/shared/tag-input";
import { Button } from "@/components/ui/button";
import { createResearch, updateResearch } from "@/actions/research";

interface ResearchFormProps {
  mode: "create" | "edit";
  initialData?: {
    id: string;
    title: string;
    content: string;
    contentType: string;
    tags: string;
    assetTicker: string;
  };
}

export function ResearchForm({ mode, initialData }: ResearchFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState(initialData?.title || "");
  const [content, setContent] = useState(initialData?.content || "");
  const [tags, setTags] = useState(initialData?.tags || "");
  const [assetTicker, setAssetTicker] = useState(initialData?.assetTicker || "");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
      if (mode === "create") {
        const result = await createResearch({
          title,
          content,
          contentType: "rich-text",
          tags,
          assetTicker,
        });
        if (result.error || !result.data) {
          setError(result.error || "Unknown error");
          return;
        }
        router.push(`/research/${result.data.id}`);
      } else {
        const result = await updateResearch({
          id: initialData!.id,
          title,
          content,
          contentType: "rich-text",
          tags,
          assetTicker,
        });
        if (result.error) {
          setError(result.error);
          return;
        }
        router.push(`/research/${initialData!.id}`);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-2">
        <label htmlFor="title" className="text-sm font-medium">
          Title
        </label>
        <input
          id="title"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Research artifact title"
          required
          className="w-full rounded-md border bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">Content</label>
        <TipTapEditor
          content={content}
          onChange={setContent}
          placeholder="Write your research analysis..."
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="assetTicker" className="text-sm font-medium">
          Asset Ticker <span className="text-muted-foreground">(optional)</span>
        </label>
        <input
          id="assetTicker"
          type="text"
          value={assetTicker}
          onChange={(e) => setAssetTicker(e.target.value.toUpperCase())}
          placeholder="e.g. AAPL, BTC-USD"
          className="w-full rounded-md border bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">Tags</label>
        <TagInput value={tags} onChange={setTags} />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex gap-3">
        <Button type="submit" disabled={isPending}>
          {isPending
            ? "Saving..."
            : mode === "create"
            ? "Create Artifact"
            : "Save Changes"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
          disabled={isPending}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
