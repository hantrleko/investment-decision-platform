"use client";

import { useState, useTransition } from "react";

interface AttachmentUploadProps {
  researchArtifactId: string;
  onUploaded: () => void;
}

export function AttachmentUpload({ researchArtifactId, onUploaded }: AttachmentUploadProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    setError(null);
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);
    formData.append("researchArtifactId", researchArtifactId);

    startTransition(async () => {
      const res = await fetch("/api/attachments", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Upload failed");
        return;
      }

      onUploaded();
    });

    // Reset input
    e.target.value = "";
  }

  return (
    <div className="space-y-2">
      <label className="inline-flex cursor-pointer items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
        <span>Upload File</span>
        <input
          type="file"
          className="hidden"
          accept=".pdf,.png,.jpg,.jpeg,.gif,.webp,.csv,.xlsx,.xls"
          onChange={handleUpload}
          disabled={isPending}
        />
      </label>
      {isPending && <p className="text-xs text-muted-foreground">Uploading...</p>}
      {error && <p className="text-xs text-destructive">{error}</p>}
      <p className="text-xs text-muted-foreground">
        PDF, PNG, JPEG, GIF, WebP, CSV, XLSX — max 10MB per file
      </p>
    </div>
  );
}
