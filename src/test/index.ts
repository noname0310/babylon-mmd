import { Engine } from "@babylonjs/core";

import { BaseRuntime } from "./BaseRuntime";
import css from "./index.css";
import { PmxConverterScene } from "./PmxConverterScene";
// import { SceneBuilder } from "./SceneBuilder";
css;

const canvas = document.getElementById("render-canvas");
if (!(canvas instanceof HTMLCanvasElement)) throw new Error("Invalid canvas element");

const engine = new Engine(canvas, true, {
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
    sceneBuilder: new PmxConverterScene()
}).then(runtime => runtime.run());
