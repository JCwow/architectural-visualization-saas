import type { Route } from "./+types/visualize.$id";
import { useLoaderData, useLocation, useNavigate, useOutletContext, useParams } from "react-router";
import {useRef, useState, useEffect} from 'react'
import { generate3DView } from "lib/ai.action";
import { Box, Download, X, Share2, RefreshCcw} from "lucide-react";
import Button from "components/ui/Button";
import { SHARE_STATUS_RESET_DELAY_MS } from "lib/constants";
import { createProject, getProjectById, shareProject } from "lib/puter.action";
import { ReactCompareSlider, ReactCompareSliderImage } from "react-compare-slider";
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

const persistProjects = (items: DesignItem[]) => {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(PROJECTS_STORAGE_KEY, JSON.stringify(items));
  } catch (error) {
    console.error("Failed to persist projects", error);
  }
};

const upsertPersistedProject = (item: DesignItem) => {
  if (typeof window === "undefined") return;

  try {
    const raw = window.localStorage.getItem(PROJECTS_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    const items = Array.isArray(parsed) ? parsed : [];
    const nextProjects = [item, ...items.filter((candidate) => candidate?.id !== item.id)];
    persistProjects(nextProjects);
  } catch (error) {
    console.error("Failed to update saved project", error);
  }
};

const toPublicShareUrl = (publicPath: string) => {
  if (typeof window === "undefined") return publicPath;
  return new URL(publicPath, window.location.origin).toString();
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
  const {id} = useParams();
  const {userId} = useOutletContext<AuthContext>();
  const loaderData = useLoaderData<typeof clientLoader>();
  const location = useLocation();
  const state = (location.state as VisualizerLocationState | null) ?? null;
  const initialImage = state?.initialImage ?? loaderData.initialImage;
  const initialRender = state?.initialRendered ?? null;
  const name = state?.name ?? loaderData.name ?? "Untitled Project";
  
  const [project, setProject] = useState<DesignItem | null>(null);
  const [isProjectLoading, setIsProjectLoading] = useState(true);
  
  const navigate = useNavigate();
  const hasInitialGenerated = useRef(false);
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentImage, setCurrentImage] = useState<string | null>(initialRender);
  const [shareStatus, setShareStatus] = useState<ShareStatus>("idle");
  const [shareFeedback, setShareFeedback] = useState<string | null>(null);
  
  const handleBack = () => navigate('/');
  const handleExport = async () => {
    if (!currentImage) return;

    try {
      const response = await fetch(currentImage);
      const blob = await response.blob();
      const objectUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      const safeName = (project?.name ?? name ?? "render").replace(/[^a-z0-9-_]+/gi, "-").replace(/^-+|-+$/g, "");

      link.href = objectUrl;
      link.download = `${safeName || "render"}-${id ?? "image"}.png`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(objectUrl);
    } catch (error) {
      console.error("Failed to export image:", error);
    }
  };
  const runGeneration = async (item: DesignItem) => {
    if(!id || !item.sourceImage) return;
    try{
      setIsProcessing(true);
      const result = await generate3DView({
        sourceImage: item.sourceImage
      })
      if(result.renderedImage){
        setCurrentImage(result.renderedImage);
        const updatedItem = {
          ...item,
          renderedImage: result.renderedImage,
          renderedPath: result.renderedPath,
          timestamp: Date.now(),
          ownerId: item.ownerId ?? userId ?? null,
          isPublic: item.isPublic ?? false
        }
        const saved = await createProject({item: updatedItem, visibility: 'private'})
        if(saved){
          upsertPersistedProject(saved);
          setProject(saved);
          setCurrentImage(saved.renderedImage || result.renderedImage);
        }
      }
    }catch(error){
      console.error('Generation failed:' , error)
    }finally{
      setIsProcessing(false);
    }
  }
  useEffect(() => {
    let isMounted = true;
    const loadProject = async() => {
      if(!id){
        if(isMounted){
          setIsProjectLoading(false);
        }
        return;
      }
      if(isMounted){
        setIsProjectLoading(true);
      }
      try{
        const fetchedProject = await getProjectById({id});
        if(!isMounted) return;
        setProject(fetchedProject);
        setCurrentImage(fetchedProject?.renderedImage || null);
        if (fetchedProject) {
          upsertPersistedProject(fetchedProject);
        }
        hasInitialGenerated.current = false;
      }catch(error){
        console.error('Failed to load project:', error);
        if(!isMounted) return;
        const fallbackProject = id ? getProjectFromStorage(id) : null;
        setProject(fallbackProject);
        setCurrentImage(fallbackProject?.renderedImage || null);
      }finally{
        if(isMounted){
          setIsProjectLoading(false);
        }
      }
    };
    loadProject();
    return () => {
      isMounted = false;
    }
  }, [id]);

  useEffect(() => {
    if(
      isProjectLoading ||
      hasInitialGenerated.current ||
      !project?.sourceImage
    ) return;
    if(project.renderedImage){
      setCurrentImage(project.renderedImage);
      hasInitialGenerated.current = true;
      return;
    }
    hasInitialGenerated.current = true;
    void runGeneration(project);
  }, [project, isProjectLoading])

  useEffect(() => {
    if (shareStatus !== "done") return;

    const timeoutId = window.setTimeout(() => {
      setShareStatus("idle");
      setShareFeedback(null);
    }, SHARE_STATUS_RESET_DELAY_MS);

    return () => window.clearTimeout(timeoutId);
  }, [shareStatus]);

  const handleShare = async () => {
    if (!project?.id || !currentImage || shareStatus === "saving") return;

    setShareStatus("saving");
    setShareFeedback(null);

    try {
      let nextProject = project;
      let publicPath = project.publicPath ?? null;

      if (!publicPath) {
        const shared = await shareProject({ id: project.id });

        if (!shared?.project || !shared.publicPath) {
          throw new Error("Missing public share link");
        }

        nextProject = shared.project;
        publicPath = shared.publicPath;
        setProject(shared.project);
        upsertPersistedProject(shared.project);
      }

      const shareUrl = toPublicShareUrl(publicPath);
      const shareTitle = nextProject?.name ?? name ?? "Roomify Project";

      if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
        try {
          await navigator.share({
            title: shareTitle,
            text: "Check out this Roomify visualization.",
            url: shareUrl,
          });

          setShareStatus("done");
          setShareFeedback("Share link ready.");
          return;
        } catch (error) {
          if (error instanceof DOMException && error.name === "AbortError") {
            setShareStatus("idle");
            return;
          }
        }
      }

      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareUrl);
        setShareStatus("done");
        setShareFeedback("Share link copied.");
        return;
      }

      window.prompt("Copy your public share link", shareUrl);
      setShareStatus("done");
      setShareFeedback("Copy the share link from the dialog.");
    } catch (error) {
      console.error("Failed to share project:", error);
      setShareStatus("idle");
      setShareFeedback("Failed to share link. Please try again.");
    }
  };

  const canShare = Boolean(project?.id && currentImage && !isProjectLoading && !isProcessing);
  const shareLabel = shareStatus === "saving"
    ? "Sharing..."
    : project?.publicPath
      ? "Copy Link"
      : "Share";
  const publicShareUrl = project?.publicPath ? toPublicShareUrl(project.publicPath) : null;

  return (
      <div className="visualizer">
        <nav className="topbar">
          <div className="brand">
            <Box className="logo"></Box>
            <span className="name">Roomify</span>
          </div>
          <Button variant="ghost" size="sm" onClick={handleBack} className="exit">
            <X className="icon"></X>
            Exit Editor
          </Button>
        </nav>
        <section className="content">
          <div className="panel">
            <div className="panel-header">
              <div className="panel-meta">
                <p>Project</p>
                <h2>{project?.name ?? `Residence${id ? ` ${id}` : ""}`}</h2>
                <p className="note">Created by Banana</p>
              </div>
              <div className="panel-actions">
                <Button
                  size="sm"
                  onClick={handleExport}
                  className="export"
                  disabled={!currentImage}>
                  <Download className="w-4 h-4 mr-2"></Download>
                  Export
                </Button>
                <Button
                  size="sm"
                  onClick={handleShare}
                  className="share"
                  disabled={!canShare || shareStatus === "saving"}>
                  <Share2 className="w-4 h-4 mr-2"></Share2>
                  {shareLabel}
                </Button>
                {shareFeedback && (
                  <p className="text-xs font-mono uppercase tracking-wide text-zinc-500">
                    {shareFeedback}
                  </p>
                )}
                {!shareFeedback && publicShareUrl && (
                  <a
                    href={publicShareUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs font-mono uppercase tracking-wide text-zinc-500 underline underline-offset-4"
                  >
                    View shared page
                  </a>
                )}
              </div>
            </div>
            <div className={`render-area ${isProcessing ? 'is-processing' :''}`}>
              {
                currentImage ? (
                  <img src={currentImage} alt="AI Render"
                  className="render-img"></img>
                ) : (
                  <div className="render-placeholder">
                    {project?.sourceImage && (
                      <img src={project?.sourceImage} alt="Original"
                      className="render-fallback"></img>
                    )}
                  </div>
                )
              }
              {isProcessing && (
                <div className="render-overlay">
                  <div className="rendering-card">
                    <RefreshCcw className="spinner"></RefreshCcw>
                    <span className="title">Rendering</span>
                    <span className="subtitle">Generating your 3D visualization</span>
                  </div>
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
              <div className="hint">
                Drag to compare
              </div>
            </div>
            <div className="compare-stage">
              {project?.sourceImage && currentImage ? (
                <ReactCompareSlider 
                  defaultValue={50}
                  style={{width: '100%', height: '100%'}}
                  itemOne={
                    <ReactCompareSliderImage src={project?.sourceImage} alt="before" className="compare-img">
                    </ReactCompareSliderImage>
                  } 
                  itemTwo={
                    <ReactCompareSliderImage src={currentImage ?? project?.renderedImage ?? undefined} alt="after" className="compare-img">
                    </ReactCompareSliderImage>
                  }>
                </ReactCompareSlider>
              ): (
                <div className="compare-fallback">
                  {project?.sourceImage && (
                    <img src={project.sourceImage} alt="Before" className="compare-img"></img>
                  )}
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
  );
}