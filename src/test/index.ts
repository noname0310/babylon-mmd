import { Engine } from "@babylonjs/core";

import { BaseRuntime } from "./BaseRuntime";
import { ConverterScene } from "./ConverterScene";
import css from "./index.css";
css;

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
    sceneBuilder: new ConverterScene()
}).then(runtime => runtime.run());
