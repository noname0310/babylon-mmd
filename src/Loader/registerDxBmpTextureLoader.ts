import { registerTextureLoader } from "@babylonjs/core/Materials/Textures/Loaders/textureLoaderManager";

let registered = false;

export function registerDxBmpTextureLoader(): void {
    if (registered) {
        return;
    }
    registered = true;
    registerTextureLoader(".dxbmp", () => import("./dxBmpTextureLoader").then(((module) => new module._DxBmpTextureLoader())));
}
