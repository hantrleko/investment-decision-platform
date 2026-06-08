"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { deleteResearch, forceDeleteResearch } from "@/actions/research";

interface DeleteResearchButtonProps {
  id: string;
  linkedScores: number;
  linkedDecisions: number;
}

export function DeleteResearchButton({ id, linkedScores, linkedDecisions }: DeleteResearchButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const [warning, setWarning] = useState<string | null>(null);

  function handleClick() {
    if (linkedScores > 0 || linkedDecisions > 0) {
      setWarning(
        `This artifact has ${linkedScores} linked score(s) and ${linkedDecisions} linked decision(s). Deleting will remove these links.`
      );
      setConfirming(true);
      return;
    }
    startTransition(async () => {
      const result = await deleteResearch({ id });
      if (result.error === "HAS_LINKS") {
        setWarning(
          `This artifact has ${result.linkedScores} linked score(s) and ${result.linkedDecisions} linked decision(s). Deleting will remove these links.`
        );
        setConfirming(true);
        return;
      }
      if (result.error) {
        setWarning(result.error);
        return;
      }
      router.push("/research");
      router.refresh();
    });
  }

  function handleForceDelete() {
    startTransition(async () => {
      const result = await forceDeleteResearch({ id });
      if (result.error) {
        setWarning(result.error);
        return;
      }
      router.push("/research");
      router.refresh();
    });
  }

  if (confirming) {
    return (
      <div className="space-y-2">
        <p className="text-sm text-destructive">{warning}</p>
        <div className="flex gap-2">
          <Button
            variant="destructive"
            size="sm"
            onClick={handleForceDelete}
            disabled={isPending}
          >
            {isPending ? "Deleting..." : "Confirm Delete"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setConfirming(false);
              setWarning(null);
            }}
          >
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div>
      {warning && <p className="mb-1 text-sm text-destructive">{warning}</p>}
      <Button
        variant="destructive"
        size="sm"
        onClick={handleClick}
        disabled={isPending}
      >
        Delete
      </Button>
    </div>
  );
}
