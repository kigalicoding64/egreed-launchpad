import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { lazy, Suspense } from "react";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useProject } from "@/lib/queries";

const CodeStudio = lazy(() => import("@/components/ide/CodeStudio"));

export const Route = createFileRoute("/_authenticated/ide/$id")({
  component: IdePage,
  head: () => ({
    meta: [
      { title: "Code Studio — EGREED Deploy" },
      {
        name: "description",
        content:
          "A VS Code-style editor with a real terminal and in-browser Node runtime to run your project inside EGREED Deploy.",
      },
      { property: "og:title", content: "Code Studio — EGREED Deploy" },
      {
        property: "og:description",
        content: "Edit, run and preview your app with a real terminal, right in the browser.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

function Spinner() {
  return (
    <div className="flex justify-center py-24">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );
}

function IdePage() {
  const { id } = useParams({ from: "/_authenticated/ide/$id" });
  const { data: project, isLoading } = useProject(id);
  if (isLoading) return <Spinner />;
  if (!project)
    return (
      <div className="py-24 text-center">
        <h1 className="text-lg font-semibold text-foreground">Project not found</h1>
        <Link to="/projects" className="mt-3 inline-block text-sm text-primary">
          Back to projects
        </Link>
      </div>
    );
  return (
    <>
      <div className="mb-3 flex items-center justify-between">
        <Link
          to="/projects/$id"
          params={{ id }}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> {project.name}
        </Link>
        <h1 className="text-sm font-semibold text-foreground">Code Studio</h1>
      </div>
      <Suspense fallback={<Spinner />}>
        <CodeStudio project={project} />
      </Suspense>
    </>
  );
}
