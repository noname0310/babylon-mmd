import { Engine } from "@babylonjs/core";

import css from "./index.css";
css;

import { BaseRuntime } from "./runtime/base/BaseRuntime";
import { SceneBuilder } from "./runtime/base/SceneBuilder";

const canvas = document.getElementById("render-canvas");
if (!(canvas instanceof HTMLCanvasElement)) throw new Error("Invalid canvas element");

const engine = new Engine(canvas, true, {
    preserveDrawingBuffer: true,
    stencil: true,
    antialias: true
}, true);

// const webGPUEngine = new WebGPUEngine(canvas, {
//     stencil: true,
//     antialias: true
// });
// await webGPUEngine.initAsync();

BaseRuntime.Create({
    canvas,
    engine,
    sceneBuilder: new SceneBuilder()
}).then(runtime => runtime.run());
