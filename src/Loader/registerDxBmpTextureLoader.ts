import { registerTextureLoader } from "@babylonjs/core/Materials/Textures/Loaders/textureLoaderManager";

let Registered = false;

/**
 * Register the bmp texture loader that behaves like the directx bmp texture loader
 *
 * This is completely optional and is required to accurately load MMD models that contain BMP textures with alpha channels.
 *
 * if the loader is already registered, this function does nothing
 */
export function RegisterDxBmpTextureLoader(): void {
    if (Registered) {
        return;
    }
    Registered = true;
    registerTextureLoader(".dxbmp", () => import("./dxBmpTextureLoader").then(((module) => new module._DxBmpTextureLoader())));
}
