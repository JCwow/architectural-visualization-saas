import type { Route } from "./+types/visualize.$id";
import { useLoaderData, useLocation } from "react-router";

const PROJECTS_STORAGE_KEY = "roomify:projects";

type VisualizeLoaderData = {
  name: string | null;
  initialImage: string | null;
};

const getProjectFromStorage = (id: string): DesignItem | null => {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(PROJECTS_STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;

    const match = parsed.find((item) => {
      if (!item || typeof item !== "object") return false;
      return (item as Partial<DesignItem>).id === id;
    }) as Partial<DesignItem> | undefined;

    if (!match || typeof match.sourceImage !== "string") return null;

    return {
      id: typeof match.id === "string" ? match.id : id,
      name: typeof match.name === "string" ? match.name : null,
      sourceImage: match.sourceImage,
      renderedImage: typeof match.renderedImage === "string" ? match.renderedImage : null,
      timestamp: typeof match.timestamp === "number" ? match.timestamp : Date.now(),
      sourcePath: match.sourcePath ?? null,
      renderedPath: match.renderedPath ?? null,
      publicPath: match.publicPath ?? null,
      ownerId: match.ownerId ?? null,
      sharedBy: match.sharedBy ?? null,
      sharedAt: match.sharedAt ?? null,
      isPublic: match.isPublic ?? false,
    };
  } catch (error) {
    console.error("Failed to read project from storage", error);
    return null;
  }
};

export async function clientLoader({
  params,
}: Route.ClientLoaderArgs): Promise<VisualizeLoaderData> {
  const id = params.id;
  if (!id) return { name: null, initialImage: null };

  const project = getProjectFromStorage(id);
  if (!project) return { name: null, initialImage: null };

  return {
    name: project.name ?? null,
    initialImage: project.sourceImage ?? null,
  };
}

export default function VisualizeId() {
  const loaderData = useLoaderData<typeof clientLoader>();
  const location = useLocation();
  const state = (location.state as VisualizerLocationState | null) ?? null;
  const initialImage = state?.initialImage ?? loaderData.initialImage;
  const name = state?.name ?? loaderData.name;

  return (
    <section>
      <h1>{name || "Untitled Project"}</h1>
      <div className="visualizer">
        {initialImage && (
          <div className="image-container">
            <h2>Source Image</h2>
            <img src={initialImage} alt="source" />
          </div>
        )}
      </div>
    </section>
  );
}