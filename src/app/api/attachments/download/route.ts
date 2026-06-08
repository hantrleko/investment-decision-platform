import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getStorage } from "@/lib/storage";

export async function GET(request: NextRequest) {
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

  const storage = getStorage();
  const exists = await storage.exists(attachment.filePath);
  if (!exists) {
    return NextResponse.json({ error: "File not found on disk" }, { status: 404 });
  }

  const buffer = await storage.read(attachment.filePath);

  const headers = new Headers();
  headers.set("Content-Type", attachment.mimeType);
  headers.set("Content-Disposition", `attachment; filename="${attachment.fileName}"`);
  headers.set("Content-Length", String(buffer.length));

  return new NextResponse(new Uint8Array(buffer), { status: 200, headers });
}
