import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getStorage } from "@/lib/storage";

const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "text/csv",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
];

const MAX_FILE_SIZE = parseInt(
  process.env.MAX_ATTACHMENT_SIZE_BYTES || "10485760",
  10
);
const MAX_ARTIFACT_TOTAL = parseInt(
  process.env.MAX_ARTIFACT_ATTACHMENTS_BYTES || "52428800",
  10
);

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const researchArtifactId = formData.get("researchArtifactId") as string | null;

  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  if (!researchArtifactId) {
    return NextResponse.json({ error: "No research artifact ID provided" }, { status: 400 });
  }

  // Validate research artifact exists
  const artifact = await prisma.researchArtifact.findUnique({
    where: { id: researchArtifactId },
    include: { attachments: true },
  });

  if (!artifact) {
    return NextResponse.json({ error: "Research artifact not found" }, { status: 404 });
  }

  // Validate MIME type
  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    return NextResponse.json(
      { error: `File type "${file.type}" not allowed. Allowed: PDF, PNG, JPEG, GIF, WebP, CSV, XLSX` },
      { status: 400 }
    );
  }

  // Validate file size
  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      { error: `File size (${(file.size / 1024 / 1024).toFixed(1)}MB) exceeds limit (${(MAX_FILE_SIZE / 1024 / 1024).toFixed(0)}MB)` },
      { status: 400 }
    );
  }

  // Validate total attachment size for artifact
  const currentTotal = artifact.attachments.reduce(
    (sum, a) => sum + a.fileSizeBytes,
    0
  );
  if (currentTotal + file.size > MAX_ARTIFACT_TOTAL) {
    return NextResponse.json(
      { error: `Total attachment size would exceed limit (${(MAX_ARTIFACT_TOTAL / 1024 / 1024).toFixed(0)}MB)` },
      { status: 400 }
    );
  }

  // Save file via storage provider
  const storage = getStorage();
  const buffer = Buffer.from(await file.arrayBuffer());
  const directory = `attachments/${researchArtifactId}`;
  const relPath = await storage.save(directory, file.name, buffer);

  // Create attachment record
  const attachment = await prisma.documentAttachment.create({
    data: {
      fileName: file.name,
      filePath: relPath,
      mimeType: file.type,
      fileSizeBytes: file.size,
      researchArtifactId,
    },
  });

  return NextResponse.json({ data: attachment }, { status: 201 });
}

export async function DELETE(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "Attachment ID required" }, { status: 400 });
  }

  const attachment = await prisma.documentAttachment.findUnique({ where: { id } });
  if (!attachment) {
    return NextResponse.json({ error: "Attachment not found" }, { status: 404 });
  }

  // Delete file from storage
  const storage = getStorage();
  await storage.delete(attachment.filePath);

  // Delete record
  await prisma.documentAttachment.delete({ where: { id } });

  return NextResponse.json({ data: { id } });
}
