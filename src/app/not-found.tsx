import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center py-16 space-y-4">
      <h1 className="text-2xl font-bold">Not Found</h1>
      <p className="text-muted-foreground">The page you are looking for does not exist.</p>
      <Link href="/research" className="text-primary hover:underline">
        Return to Research Workspace
      </Link>
    </div>
  );
}
