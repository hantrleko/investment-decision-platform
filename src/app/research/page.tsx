import { ResearchList } from "@/components/research/research-list";

interface PageProps {
  searchParams: Promise<{ q?: string; tag?: string; page?: string }>;
}

export default async function ResearchPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page || "1", 10));

  return (
    <ResearchList q={params.q} tag={params.tag} page={page} />
  );
}
