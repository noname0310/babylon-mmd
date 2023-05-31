import { Engine, Scene } from "@babylonjs/core";

export interface ISceneBuilder {
    build(canvas: HTMLCanvasElement, engine: Engine): Scene;
}
