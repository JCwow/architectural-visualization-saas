import puter from "@heyputer/puter.js";
import { HOSTING_CONFIG_KEY, createHostingSlug, fetchBlobFromUrl, getHostedUrl, getImageExtension, imageUrlToPngBlob, isHostedUrl} from "./utils";

type HostingConfig = {
    subdomain: string;
}
type HostingAsset = {
    url: string;
}

type KvWithWrite = {
    set?: (key: string, value: unknown) => Promise<unknown>;
    put?: (key: string, value: unknown) => Promise<unknown>;
}

export const getOrCreateHostingConfig = async (): Promise<HostingConfig | null> => {
    try{
        const existing = (await puter.kv.get(HOSTING_CONFIG_KEY)) as HostingConfig | null;
        if(existing?.subdomain) {
            return { subdomain: existing.subdomain };
        }

        const subdomain = createHostingSlug();
        const created = await puter.hosting.create(subdomain, '.');
        const record = { subdomain: created.subdomain };
        const kv = puter.kv as unknown as KvWithWrite;
        if (typeof kv.set === "function") {
            await kv.set(HOSTING_CONFIG_KEY, record);
        } else if (typeof kv.put === "function") {
            await kv.put(HOSTING_CONFIG_KEY, record);
        } else {
            console.warn("Puter KV does not support set/put; hosting config is not persisted.");
        }
        return record;
    }catch(e){
        console.warn(`Failed to get or create hosting config: ${e}`);
        return null;
    }
}

export const uploadImageToHosting = async ({hosting, url, projectId, label}: StoreHostedImageParams): Promise<HostedAsset | null> => {
    if(!hosting || !url) return null;
    if(isHostedUrl(url)) return {url};
    try{
        const resolved = label === "rendered" ? await imageUrlToPngBlob(url)
                                                .then((blob) => blob ? {blob, contentType: 'image/png'}: null)
                                                : await fetchBlobFromUrl(url);
        if(!resolved) return null;
        const contentType = resolved.contentType || resolved.blob.type || '';
        const ext = getImageExtension(contentType, url);
        const dir = `projects/${projectId}`;
        const filePath = `${dir}/${label}.${ext}`;
        const uploadFile = new File([resolved.blob], `${label}.${ext}`, {
                type: contentType
            })
        await puter.fs.mkdir(dir, {createMissingParents: true});
        await puter.fs.write(filePath, uploadFile);
        const hostedUrl = getHostedUrl({subdomain: hosting.subdomain}, filePath);
        return hostedUrl ? {url: hostedUrl} : null;
    }catch(e){
       console.warn(`Failed to store hosted image: ${e}`);
       return null;
    }
}