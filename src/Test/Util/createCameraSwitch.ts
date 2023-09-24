import type { Camera } from "@babylonjs/core/Cameras/camera";
import type { Scene } from "@babylonjs/core/scene";

export function createCameraSwitch(scene: Scene, canvas: HTMLCanvasElement, camera1: Camera, camera2: Camera): void {
    let lastClickTime = -Infinity;
    canvas.onclick = (): void => {
        const currentTime = performance.now();
        if (500 < currentTime - lastClickTime) {
            lastClickTime = currentTime;
            return;
        }

        lastClickTime = -Infinity;

        if (scene.activeCamera === camera1) {
            scene.activeCamera = camera2;
        } else {
            scene.activeCamera = camera1;
        }
    };
}
