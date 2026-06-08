"use client";

import { useTransition } from "react";

interface Attachment {
  id: string;
  fileName: string;
  mimeType: string;
  fileSizeBytes: number;
}

interface AttachmentViewerProps {
  attachments: Attachment[];
  onDeleted: () => void;
}

const IMAGE_TYPES = ["image/png", "image/jpeg", "image/gif", "image/webp"];

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function AttachmentViewer({ attachments, onDeleted }: AttachmentViewerProps) {
  const [isPending, startTransition] = useTransition();

  function handleDelete(id: string) {
    startTransition(async () => {
      await fetch(`/api/attachments?id=${id}`, { method: "DELETE" });
      onDeleted();
    });
  }

  if (attachments.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No attachments yet.</p>
    );
  }

  return (
    <div className="space-y-3">
      {attachments.map((a) => {
        const isImage = IMAGE_TYPES.includes(a.mimeType);
        const downloadUrl = `/api/attachments/download?id=${a.id}`;

        return (
          <div key={a.id} className="rounded-md border p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">{a.fileName}</span>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">{formatSize(a.fileSizeBytes)}</span>
                <a
                  href={downloadUrl}
                  className="text-xs text-primary hover:underline"
                  download
                >
                  Download
                </a>
                <button
                  type="button"
                  onClick={() => handleDelete(a.id)}
                  disabled={isPending}
                  className="text-xs text-destructive hover:underline disabled:opacity-50"
                >
                  Delete
                </button>
              </div>
            </div>
            {isImage && (
              <img
                src={downloadUrl}
                alt={a.fileName}
                className="max-h-64 rounded-md border object-contain"
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
