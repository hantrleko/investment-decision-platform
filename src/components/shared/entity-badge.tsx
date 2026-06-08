import Link from "next/link";

interface EntityBadgeProps {
  href: string;
  label: string;
  variant?: "asset" | "research" | "score" | "decision";
}

const VARIANT_STYLES: Record<string, string> = {
  asset: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  research: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  score: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  decision: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
};

export function EntityBadge({ href, label, variant = "asset" }: EntityBadgeProps) {
  return (
    <Link
      href={href}
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium hover:opacity-80 transition-opacity ${VARIANT_STYLES[variant]}`}
    >
      {label}
    </Link>
  );
}
