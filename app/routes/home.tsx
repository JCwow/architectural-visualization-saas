import Navbar from "components/Navbar";
import type { Route } from "./+types/home";
import { ArrowRight } from "lucide-react";
import Button from "components/ui/Button";
import { Layers, Clock } from "lucide-react";
import Upload from "components/Upload";
import { useNavigate } from "react-router";
import { useEffect, useState } from "react";
import { createProject } from "lib/puter.action";

const PROJECTS_STORAGE_KEY = "roomify:projects";

const toValidProject = (value: unknown): DesignItem | null => {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<DesignItem>;

  if (
    typeof candidate.id !== "string" ||
    typeof candidate.sourceImage !== "string" ||
    typeof candidate.timestamp !== "number"
  ) {
    return null;
  }

  if (candidate.name != null && typeof candidate.name !== "string") return null;
  if (candidate.renderedImage != null && typeof candidate.renderedImage !== "string") return null;

  return {
    id: candidate.id,
    name: candidate.name ?? null,
    sourceImage: candidate.sourceImage,
    renderedImage: candidate.renderedImage ?? null,
    timestamp: candidate.timestamp,
    sourcePath: candidate.sourcePath ?? null,
    renderedPath: candidate.renderedPath ?? null,
    publicPath: candidate.publicPath ?? null,
    ownerId: candidate.ownerId ?? null,
    sharedBy: candidate.sharedBy ?? null,
    sharedAt: candidate.sharedAt ?? null,
    isPublic: candidate.isPublic ?? false,
  };
};

const readPersistedProjects = (): DesignItem[] => {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(PROJECTS_STORAGE_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .map((item) => toValidProject(item))
      .filter((item): item is DesignItem => Boolean(item));
  } catch (error) {
    console.error("Failed to read saved projects", error);
    return [];
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
export function meta({}: Route.MetaArgs) {
  return [
    { title: "New React Router App" },
    { name: "description", content: "Welcome to React Router!" },
  ];
}

export default function Home() {
  const navigate  = useNavigate();
  const [projects, setProjects] = useState<DesignItem[]>([]);
  useEffect(() => {
    const savedProjects = readPersistedProjects();
    if (savedProjects.length === 0) return;
    setProjects(savedProjects);
  }, []);

  const handleUploadComplete = async(based64Image: string) => {
    const newId = Date.now().toString();
    const name = `Residence ${newId}`;
    const newItem = {
      id: newId, name, sourceImage: based64Image, 
      renderedImage: undefined,
      timestamp: Date.now()
    }
    const saved = await createProject({item: newItem, visibility: 'private'});
    if(!saved){
      console.error("Failed to create project");
      return false;
    }
    setProjects((prev) => {
      const nextProjects = [saved, ...prev].filter(
        (project, index, all) => all.findIndex((item) => item.id === project.id) === index,
      );
      persistProjects(nextProjects);
      return nextProjects;
    });

    // sessionStorage.setItem(`roomify:source:${newId}`, based64Image);
    navigate(`/visualize/${saved.id}`, { 
      state: { 
        initialImage: saved.sourceImage,
        initialRendered:  saved.renderedImage || null,
        name
      } });
    return true;
  }
  return (
    <div className="home">
      <Navbar></Navbar>
      <section className="hero">
        <div className="announce">
          <div className="dot">
            <div className="pulse"></div>
          </div>
          <p>Introducing Roomify 2.0</p>
        </div>
        <h1>Build beautiful spaces at the speed of thought with Roomify</h1>
        <p className="subtitle">
          Roomify is an AI-first design environment that helps you visualize, render, and ship that helps you visualize, render, and ship architectural projects faster than ever.
        </p>
        <div className="actions">
          <a href="#upload" className="cta">Start Building <ArrowRight className="icon"></ArrowRight></a>
          <Button variant="outline" size="lg" className="demo">Watch Demo</Button>
        </div>
        <div id="upload" className="upload-shell">
          <div className="grid-overlay"></div>
          <div className="upload-card">
            <div className="upload-head">
              <div className="upload-icon">
                <Layers className="icon"></Layers>
              </div>
              <h3>Upload your floor plan</h3>
              <p>Supports JPG, PNG, formats up to 10MB</p>
            </div>
            <Upload onComplete={handleUploadComplete}></Upload>
          </div>
        </div>
      </section>
      <section className="projects">
        <div className="section-inner">
          <div className="section-head">
            <div className="copy">
              <h2>Projects</h2>
              <p>Your latest work and shared community projects, all in one place.</p>
            </div>
          </div>
          <div className="projects-grid">
            {projects.map(({ id, name, renderedImage, sourceImage, timestamp }) => (
              <div key={id} className="project-card group">
                <div className="preview">
                  <img 
                  src={renderedImage || sourceImage} 
                  alt="Project"></img>
                  <div className="badge">
                    <span>Private</span>
                  </div>
                </div>
                <div className="card-body">
                  <div>
                    <h3>{name}</h3>

                    <div className="meta">
                      <Clock size={12}></Clock>
                      <span>{new Date(timestamp).toLocaleDateString()}</span>
                      <span>By You</span>
                    </div>
                  </div>
                  <div className="arrow">
                    <ArrowRight size={18}></ArrowRight>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}
