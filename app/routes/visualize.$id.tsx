import type { Route } from "./+types/visualize.$id";
import { useLoaderData, useLocation, useNavigate } from "react-router";
import {useRef, useState, useEffect} from 'react'
import { generate3DView } from "lib/ai.action";
import { Box, Download, X, Share2, RefreshCcw} from "lucide-react";
import Button from "components/ui/Button";
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
  const initialRender = state?.initialRendered ?? null;
  const name = state?.name ?? loaderData.name ?? "Untitled Project";
  
  const navigate = useNavigate();
  const hasInitialGenerated = useRef(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentImage, setCurrentImage] = useState<string | null>(initialRender);
  const handleBack = () => navigate('/');
  const runGeneration = async () => {
    if(!initialImage) return;
    try{
      setIsProcessing(true);
      const result = await generate3DView({
        sourceImage: initialImage
      })
      if(result.renderedImage){
        setCurrentImage(result.renderedImage);
        // update the project with the rendered image.

      }
    }catch(error){
      console.error('Generation failed:' , error)
    }finally{
      setIsProcessing(false);
    }
  }
  useEffect(() => {
    if(!initialImage || hasInitialGenerated.current) return;
    if(initialRender){
      setCurrentImage(initialRender)
      hasInitialGenerated.current = true;
      return;
    }
    hasInitialGenerated.current = true;
    runGeneration()
  }, [initialImage, initialRender])
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
                <h2>{name}</h2>
                <p className="note">Created by Banana</p>
              </div>
              <div className="panel-actions">
                <Button
                  size="sm"
                  onClick={() => {}}
                  className="export"
                  disabled={!currentImage}>
                  <Download className="w-4 h-4 mr-2"></Download>
                  Export
                </Button>
                <Button size="sm" onClick={() => {}} className="share">
                  <Share2 className="w-4 h-4 mr-2"></Share2>
                  Share
                </Button>
              </div>
            </div>
            <div className={`render-area ${isProcessing ? 'is-processing' :''}`}>
              {
                currentImage ? (
                  <img src={currentImage} alt="AI Render"
                  className="render-img"></img>
                ) : (
                  <div className="render-placeholder">
                    {initialImage && (
                      <img src={initialImage} alt="Original"
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
        </section>
      </div>
  );
}