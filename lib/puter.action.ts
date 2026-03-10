import puter from "@heyputer/puter.js";
import {getOrCreateHostingConfig, uploadImageToHosting} from "./puter.hosting";
import {isHostedUrl} from "./utils";
import {PUTER_WORKER_URL} from "./constants";

export const signIn = async () => await puter.auth.signIn();

export const signOut = () => puter.auth.signOut();

export const getCurrentUser = async () => {
    try {
        return await puter.auth.getUser();
    } catch {
        return null;
    }
}

const getWorkerUrl = (path: string) => {
    if (!PUTER_WORKER_URL) {
        throw new Error("Missing VITE_PUTER_WORKER_URL");
    }

    return new URL(`/api${path}`, PUTER_WORKER_URL).toString();
}

const execWorker = (path: string, init: RequestInit) =>
    puter.workers.exec(getWorkerUrl(path), init);

const parseJson = async <T>(response: Response): Promise<T | null> => {
    try {
        return (await response.json()) as T;
    } catch {
        return null;
    }
}

export const createProject = async ({ item, visibility = "private" }: CreateProjectParams): Promise<DesignItem | null | undefined> => {
    const projectId = item.id;

    const hosting = await getOrCreateHostingConfig();

    const hostedSource = projectId ?
        await uploadImageToHosting({ hosting, url: item.sourceImage, projectId, label: 'source', }) : null;

    const hostedRender = projectId && item.renderedImage ?
        await uploadImageToHosting({ hosting, url: item.renderedImage, projectId, label: 'rendered', }) : null;

    const resolvedSource = hostedSource?.url || (isHostedUrl(item.sourceImage)
        ? item.sourceImage
        : ''
    );

    if(!resolvedSource) {
        console.warn('Failed to host source image, skipping save.')
        return null;
    }

    const resolvedRender = hostedRender?.url
        ? hostedRender?.url
        : item.renderedImage && isHostedUrl(item.renderedImage)
            ? item.renderedImage
            : undefined;

    const {
        sourcePath: _sourcePath,
        renderedPath: _renderedPath,
        ...rest
    } = item;

    const payload = {
        ...rest,
        sourceImage: resolvedSource,
        renderedImage: resolvedRender,
    }

    try {
        const response = await execWorker("/projects/save", {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                project: payload,
                visibility
            })
        });

        if(!response.ok) {
            console.error('failed to save the project', await response.text());
            return null;
        }

        const data = await parseJson<{ project?: DesignItem | null }>(response);

        return data?.project ?? null;
    } catch (e) {
        console.log('Failed to save project', e)
        return null;
    }
}

export const getProjects = async () => {
    try {
        const response = await execWorker("/projects/list", { method: 'GET' });

        if(!response.ok) {
            console.error('Failed to fetch history', await response.text());
            return [];
        }

        const data = await parseJson<{ projects?: DesignItem[] | null }>(response);

        return Array.isArray(data?.projects) ? data?.projects : [];
    } catch (e) {
        console.error('Failed to get projects', e);
        return [];
    }
}

export const getProjectById = async ({ id }: { id: string }) => {
    try {
        const response = await execWorker(`/projects/get?id=${encodeURIComponent(id)}`, {
            method: "GET",
        });

        if (!response.ok) {
            console.error("Failed to fetch project:", await response.text());
            return null;
        }

        const data = await parseJson<{
            project?: DesignItem | null;
        }>(response);

        return data?.project ?? null;
    } catch (error) {
        console.error("Failed to fetch project:", error);
        return null;
    }
};

export const shareProject = async ({ id }: { id: string }) => {
    try {
        const response = await execWorker(`/projects/share?id=${encodeURIComponent(id)}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ projectId: id }),
        });

        if (!response.ok) {
            console.error("Failed to share project:", await response.text());
            return null;
        }

        const data = await parseJson<{
            shareId?: string | null;
            publicPath?: string | null;
            project?: DesignItem | null;
        }>(response);

        return {
            shareId: data?.shareId ?? null,
            publicPath: data?.publicPath ?? data?.project?.publicPath ?? null,
            project: data?.project ?? null,
        };
    } catch (error) {
        console.error("Failed to share project:", error);
        return null;
    }
}

export const getPublicProjectByShareId = async ({ shareId }: { shareId: string }) => {
    try {
        const response = await fetch(getWorkerUrl(`/projects/public?id=${encodeURIComponent(shareId)}`), {
            method: "GET",
        });

        if (!response.ok) {
            console.error("Failed to fetch shared project:", await response.text());
            return null;
        }

        const data = await parseJson<{
            project?: DesignItem | null;
        }>(response);

        return data?.project ?? null;
    } catch (error) {
        console.error("Failed to fetch shared project:", error);
        return null;
    }
}