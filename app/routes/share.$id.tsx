import type { Route } from "./+types/share.$id";
import { useLoaderData, useNavigate } from "react-router";
import { Box, Download, ExternalLink } from "lucide-react";
import Button from "components/ui/Button";
import { getPublicProjectByShareId } from "lib/puter.action";
import { ReactCompareSlider, ReactCompareSliderImage } from "react-compare-slider";

type SharedProjectLoaderData = {
  project: DesignItem | null;
};

export async function clientLoader({
  params,
}: Route.ClientLoaderArgs): Promise<SharedProjectLoaderData> {
  const id = params.id;

  if (!id) {
    return { project: null };
  }

  const project = await getPublicProjectByShareId({ shareId: id });
  return { project };
}

export default function SharedProjectRoute() {
  const { project } = useLoaderData<typeof clientLoader>();
  const navigate = useNavigate();

  const handleBack = () => navigate("/");

  const handleExport = async () => {
    if (!project?.renderedImage) return;

    try {
      const response = await fetch(project.renderedImage);
      const blob = await response.blob();
      const objectUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      const safeName = (project.name ?? "shared-render")
        .replace(/[^a-z0-9-_]+/gi, "-")
        .replace(/^-+|-+$/g, "");

      link.href = objectUrl;
      link.download = `${safeName || "shared-render"}-${project.id}.png`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(objectUrl);
    } catch (error) {
      console.error("Failed to export shared image:", error);
    }
  };

  if (!project) {
    return (
      <div className="visualizer">
        <nav className="topbar">
          <div className="brand">
            <Box className="logo"></Box>
            <span className="name">Roomify</span>
          </div>
          <Button variant="ghost" size="sm" onClick={handleBack} className="exit">
            Back Home
          </Button>
        </nav>

        <section className="content">
          <div className="panel">
            <div className="panel-header">
              <div className="panel-meta">
                <p>Shared Project</p>
                <h2>Link unavailable</h2>
                <p className="note">This share link may have expired or never existed.</p>
              </div>
            </div>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="visualizer">
      <nav className="topbar">
        <div className="brand">
          <Box className="logo"></Box>
          <span className="name">Roomify</span>
        </div>
        <Button variant="ghost" size="sm" onClick={handleBack} className="exit">
          <ExternalLink className="icon"></ExternalLink>
          Open App
        </Button>
      </nav>
      <section className="content">
        <div className="panel">
          <div className="panel-header">
            <div className="panel-meta">
              <p>Shared Project</p>
              <h2>{project.name ?? "Untitled Project"}</h2>
              <p className="note">
                {project.sharedBy ? `Shared by ${project.sharedBy}` : "Shared with Roomify"}
              </p>
            </div>
            <div className="panel-actions">
              <Button
                size="sm"
                onClick={handleExport}
                className="export"
                disabled={!project.renderedImage}
              >
                <Download className="w-4 h-4 mr-2"></Download>
                Export
              </Button>
            </div>
          </div>
          <div className="render-area">
            {project.renderedImage ? (
              <img src={project.renderedImage} alt="Shared AI render" className="render-img"></img>
            ) : (
              <div className="render-placeholder">
                <img src={project.sourceImage} alt="Original floor plan" className="render-fallback"></img>
              </div>
            )}
          </div>
        </div>
        <div className="panel compare">
          <div className="panel-header">
            <div className="panel-meta">
              <p>Comparison</p>
              <h3>Before and After</h3>
            </div>
            <div className="hint">Drag to compare</div>
          </div>
          <div className="compare-stage">
            {project.renderedImage ? (
              <ReactCompareSlider
                defaultValue={50}
                style={{ width: "100%", height: "100%" }}
                itemOne={
                  <ReactCompareSliderImage
                    src={project.sourceImage}
                    alt="before"
                    className="compare-img"
                  ></ReactCompareSliderImage>
                }
                itemTwo={
                  <ReactCompareSliderImage
                    src={project.renderedImage}
                    alt="after"
                    className="compare-img"
                  ></ReactCompareSliderImage>
                }
              ></ReactCompareSlider>
            ) : (
              <div className="compare-fallback">
                <img src={project.sourceImage} alt="Before" className="compare-img"></img>
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
