import { registerTextureLoader } from "@babylonjs/core/Materials/Textures/Loaders/textureLoaderManager";

let registered = false;

/**
 * Register the bmp texture loader that behaves like the directx bmp texture loader
 *
 * This is completely optional and is required to accurately load MMD models that contain BMP textures with alpha channels.
 *
 * if the loader is already registered, this function does nothing
 */
export function registerDxBmpTextureLoader(): void {
    if (registered) {
        return;
    }
    registered = true;
    registerTextureLoader(".dxbmp", () => import("./dxBmpTextureLoader").then(((module) => new module._DxBmpTextureLoader())));
}
