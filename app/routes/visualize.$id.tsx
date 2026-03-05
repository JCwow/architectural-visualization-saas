import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useParams } from "react-router";
import { PUTER_WORKER_URL } from "lib/constants";

type VisualizeLocationState = {
  image?: string;
};

type VisualizationData = {
  id: string;
  image: string;
};

const getVisualization = async (
  id: string,
  storageKey: string,
  locationImage?: string,
): Promise<VisualizationData> => {
  if (locationImage) {
    sessionStorage.setItem(storageKey, locationImage);
    return { id, image: locationImage };
  }

  const savedImage = sessionStorage.getItem(storageKey);
  if (savedImage) {
    return { id, image: savedImage };
  }

  const apiEndpoints = [
    `/api/visualizations/${id}`,
    PUTER_WORKER_URL ? `${PUTER_WORKER_URL}/projects/${id}` : null,
  ].filter(Boolean) as string[];

  for (const endpoint of apiEndpoints) {
    try {
      const response = await fetch(endpoint);
      if (!response.ok) continue;

      const payload = (await response.json()) as {
        image?: string;
        sourceImage?: string;
      };

      const fetchedImage = payload.image ?? payload.sourceImage ?? null;
      if (!fetchedImage) continue;

      sessionStorage.setItem(storageKey, fetchedImage);
      return { id, image: fetchedImage };
    } catch {
      // Ignore endpoint errors and try the next source.
    }
  }

  throw new Error("No uploaded image found for this visualization.");
};

export default function VisualizeId() {
  const { id } = useParams();
  const location = useLocation();
  const state = location.state as VisualizeLocationState | null;

  const storageKey = useMemo(() => {
    if (!id) return null;
    return `roomify:source:${id}`;
  }, [id]);

  const [visualization, setVisualization] = useState<VisualizationData | null>(
    null,
  );
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!id || !storageKey) {
      setIsLoading(false);
      setErrorMessage("Missing visualize id.");
      return;
    }

    let isMounted = true;

    const loadVisualization = async () => {
      setIsLoading(true);
      setErrorMessage(null);

      try {
        const data = await getVisualization(id, storageKey, state?.image);
        if (!isMounted) return;
        setVisualization(data);
      } catch (error) {
        if (!isMounted) return;
        setVisualization(null);
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Failed to load this visualization.",
        );
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    void loadVisualization();

    return () => {
      isMounted = false;
    };
  }, [id, storageKey, state?.image]);

  if (!id) {
    return <div>Missing visualize id.</div>;
  }

  if (isLoading) {
    return (
      <div>
        <p>Loading visualization...</p>
      </div>
    );
  }

  if (errorMessage || !visualization?.image) {
    return (
      <div>
        <p>{errorMessage ?? "No uploaded image found for this project."}</p>
        <Link to="/">Upload a floor plan</Link>
      </div>
    );
  }

  return (
    <main>
      <h1>Visualize {visualization.id}</h1>
      <img
        src={visualization.image}
        alt={`Uploaded floor plan ${visualization.id}`}
      />
    </main>
  );
}