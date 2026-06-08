"use client";

import { useRouter } from "next/navigation";
import { AttachmentUpload } from "@/components/research/attachment-upload";
import { AttachmentViewer } from "@/components/research/attachment-viewer";

interface Attachment {
  id: string;
  fileName: string;
  mimeType: string;
  fileSizeBytes: number;
}

interface AttachmentsSectionProps {
  researchArtifactId: string;
  attachments: Attachment[];
}

export function AttachmentsSection({ researchArtifactId, attachments }: AttachmentsSectionProps) {
  const router = useRouter();

  function refresh() {
    router.refresh();
  }

  return (
    <section>
      <h2 className="text-lg font-semibold">Attachments</h2>
      <div className="mt-2 space-y-3">
        <AttachmentUpload
          researchArtifactId={researchArtifactId}
          onUploaded={refresh}
        />
        <AttachmentViewer
          attachments={attachments}
          onDeleted={refresh}
        />
      </div>
    </section>
  );
}
