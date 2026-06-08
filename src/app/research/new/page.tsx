import { ResearchForm } from "@/components/research/research-form";

export default function NewResearchPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-6 text-2xl font-bold">New Research Artifact</h1>
      <ResearchForm mode="create" />
    </div>
  );
}
