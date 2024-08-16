import "@babylonjs/core/Engines/WebGPU/Extensions/engine.alpha";
import "@babylonjs/core/Engines/WebGPU/Extensions/engine.multiRender";
import "@babylonjs/core/Engines/WebGPU/Extensions/engine.rawTexture";
import "@babylonjs/core/Engines/WebGPU/Extensions/engine.readTexture";
import "@babylonjs/core/Engines/WebGPU/Extensions/engine.renderTarget";
import "@babylonjs/core/Engines/WebGPU/Extensions/engine.renderTargetTexture";

import { BaseRuntime } from "./baseRuntime";
import { SceneBuilder } from "./Scene/bakedAnimationTestScene";

await new Promise(resolve => window.onload = resolve);

const canvas = document.createElement("canvas");
canvas.style.width = "100%";
canvas.style.height = "100%";
canvas.style.display = "block";
document.body.appendChild(canvas);

let engine;

const useWebGPU = false;
if (useWebGPU) {
    engine = new (await import("@babylonjs/core/Engines/webgpuEngine")).WebGPUEngine(canvas, {
        stencil: false,
        antialias: true,
        doNotHandleTouchAction: true,
        doNotHandleContextLost: true,
        audioEngine: false,
        glslangOptions: {
            jsPath: new URL("@babylonjs/core/assets/glslang/glslang.js", import.meta.url).href,
            wasmPath: new URL("@babylonjs/core/assets/glslang/glslang.wasm", import.meta.url).href
        },
        twgslOptions: {
            jsPath: new URL("@babylonjs/core/assets/twgsl/twgsl.js", import.meta.url).href,
            wasmPath: new URL("@babylonjs/core/assets/twgsl/twgsl.wasm", import.meta.url).href
        }
    });
    await engine.initAsync();
} else {
    engine = new (await import("@babylonjs/core/Engines/engine")).Engine(canvas, false, {
        preserveDrawingBuffer: false,
        stencil: false,
        antialias: true,
        alpha: true,
        premultipliedAlpha: false,
        powerPreference: "high-performance",
        doNotHandleTouchAction: true,
        doNotHandleContextLost: true,
        audioEngine: false,
        disableWebGL2Support: false
    }, true);
}

BaseRuntime.Create({
    canvas,
    engine,
    sceneBuilder: new SceneBuilder()
}).then(runtime => runtime.run());
