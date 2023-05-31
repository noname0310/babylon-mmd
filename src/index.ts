import { Engine } from "@babylonjs/core";

import css from "./index.css";
css;

import { RuntimeBuilder } from "./runtime/base/RuntimeBuilder";
import { SceneBuilder } from "./runtime/instance/SceneBuilder";
import { TickRunner } from "./runtime/instance/TickRunner";

function engineStartup(): void {
    const canvas = document.getElementById("render-canvas");
    if (!(canvas instanceof HTMLCanvasElement)) throw new Error("Invalid canvas element");

    const engine = new Engine(canvas, true, {
        preserveDrawingBuffer: true,
        stencil: true,
        antialias: true
    }, true);

    const runtime = new RuntimeBuilder(canvas, engine)
        .withSceneBuilder(new SceneBuilder())
        .withTickRunner(new TickRunner())
        .make();

    runtime.run();

    Object.defineProperty(globalThis, "runtime", {
        value: runtime,
        writable: false,
        enumerable: true,
        configurable: false
    });
}

engineStartup();
