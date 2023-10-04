import { Engine } from "@babylonjs/core/Engines/engine";

import { BaseRuntime } from "./baseRuntime";
import { SceneBuilder } from "./Scene/humanoidMmdTestScene2";

window.onload = (): void => {
    const canvas = document.createElement("canvas");
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.style.display = "block";
    document.body.appendChild(canvas);

    const engine = new Engine(canvas, false, {
        preserveDrawingBuffer: false,
        stencil: false,
        premultipliedAlpha: false,
        antialias: false,
        doNotHandleTouchAction: true,
        audioEngine: false,
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
};
