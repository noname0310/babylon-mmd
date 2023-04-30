import * as BABYLON from "babylonjs";

export interface ISceneBuilder {
    build(canvas: HTMLCanvasElement, engine: BABYLON.Engine): BABYLON.Scene;
}
