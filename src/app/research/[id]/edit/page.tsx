import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import { ResearchForm } from "@/components/research/research-form";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function EditResearchPage({ params }: PageProps) {
  const { id } = await params;

  const artifact = await prisma.researchArtifact.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      content: true,
      contentType: true,
      tags: true,
      assetTicker: true,
    },
  });

  if (!artifact) {
    notFound();
  }

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-6 text-2xl font-bold">Edit Research Artifact</h1>
      <ResearchForm
        mode="edit"
        initialData={{
          id: artifact.id,
          title: artifact.title,
          content: artifact.content,
          contentType: artifact.contentType,
          tags: artifact.tags,
          assetTicker: artifact.assetTicker || "",
        }}
      />
    </div>
  );
}
