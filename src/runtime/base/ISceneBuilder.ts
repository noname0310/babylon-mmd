import * as BABYLON from "@babylonjs/core";

export interface ISceneBuilder {
    build(canvas: HTMLCanvasElement, engine: BABYLON.Engine): BABYLON.Scene;
}
