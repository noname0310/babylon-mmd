import { ArcRotateCamera } from "@babylonjs/core/Cameras/arcRotateCamera";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { Scene } from "@babylonjs/core/scene";

export interface ICreateDefaultArcRotateCameraOptions {
    worldScale?: number;
}

export function createDefaultArcRotateCamera(scene: Scene, options: ICreateDefaultArcRotateCameraOptions = {}): ArcRotateCamera {
    const worldScale = options.worldScale ?? 1;

    const camera = new ArcRotateCamera("arcRotateCamera", 0, 0, 45 * worldScale, new Vector3(0, 10 * worldScale, 0), scene);
    camera.minZ = 1 * worldScale;
    camera.maxZ = 5000 * worldScale;
    camera.setPosition(new Vector3(0, 10 * worldScale, -45 * worldScale));
    camera.attachControl(undefined, false);
    camera.inertia = 0.8;
    camera.speed = 10 * worldScale;

    return camera;
}
