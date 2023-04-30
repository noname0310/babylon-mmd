import css from "./index.css";
css;

import * as BABYLON from "babylonjs";

import { RuntimeBuilder } from "./runtime/base/RuntimeBuilder";
import { SceneBuilder } from "./runtime/instance/SceneBuilder";
import { TickRunner } from "./runtime/instance/TickRunner";

const canvas = document.getElementById("render-canvas") as HTMLCanvasElement;
const engine = new BABYLON.WebGPUEngine(canvas, {
    powerPreference: "high-performance",
    antialias: true,
    stencil: true
});

const runtime = new RuntimeBuilder(canvas, engine)
    .withSceneBuilder(new SceneBuilder())
    .withTickRunner(new TickRunner())
    .make();

runtime.run();

(globalThis as any).runtime = runtime;
