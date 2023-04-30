import * as BABYLON from "babylonjs";
import { ISceneBuilder } from "../base/ISceneBuilder";

export class SceneBuilder implements ISceneBuilder {
    public build(canvas: HTMLCanvasElement, engine: BABYLON.Engine): BABYLON.Scene {
        const scene = new BABYLON.Scene(engine);
        const camera = new BABYLON.FreeCamera("camera1", new BABYLON.Vector3(0, 5, -10), scene);
        camera.setTarget(BABYLON.Vector3.Zero());
        camera.attachControl(canvas, false);

        const light = new BABYLON.HemisphericLight("light1", new BABYLON.Vector3(0, 1, 0), scene);

        const sphere = BABYLON.MeshBuilder.CreateSphere("sphere1", {segments: 16, diameter: 2, sideOrientation: BABYLON.Mesh.FRONTSIDE}, scene);
        sphere.position.y = 1;

        const ground = BABYLON.MeshBuilder.CreateGround("ground1", { width: 6, height: 6, subdivisions: 2, updatable: false }, scene);

        light;
        ground;

        return scene;
    }
}
