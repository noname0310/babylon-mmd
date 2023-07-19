import { Engine } from "@babylonjs/core/Engines/engine";

import { BaseRuntime } from "./baseRuntime";
import css from "./index.css";
import { SceneBuilder } from "./sceneBuilder";
css;

const canvas = document.getElementById("render-canvas");
if (!(canvas instanceof HTMLCanvasElement)) throw new Error("Invalid canvas element");

const engine = new Engine(canvas, false, {
    preserveDrawingBuffer: true,
    stencil: true,
    antialias: true,
    powerPreference: "high-performance",
    doNotHandleContextLost: true
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
