import "@babylonjs/core/Engines/WebGPU/Extensions/engine.alpha";
import "@babylonjs/core/Engines/WebGPU/Extensions/engine.multiRender";
import "@babylonjs/core/Engines/WebGPU/Extensions/engine.rawTexture";
import "@babylonjs/core/Engines/WebGPU/Extensions/engine.readTexture";
import "@babylonjs/core/Engines/WebGPU/Extensions/engine.renderTarget";
import "@babylonjs/core/Engines/WebGPU/Extensions/engine.renderTargetTexture";

import { BaseRuntime } from "./baseRuntime";
import { SceneBuilder } from "./Scene/physicsToggleTestScene";

const Canvas = document.createElement("canvas");
Canvas.style.width = "100%";
Canvas.style.height = "100%";
Canvas.style.display = "block";
document.body.appendChild(Canvas);

let Engine;

const UseWebGPU = false;
if (UseWebGPU) {
    Engine = new (await import("@babylonjs/core/Engines/webgpuEngine")).WebGPUEngine(Canvas, {
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
    await Engine.initAsync();
} else {
    Engine = new (await import("@babylonjs/core/Engines/engine")).Engine(Canvas, false, {
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

BaseRuntime.CreateAsync({
    canvas: Canvas,
    engine: Engine,
    sceneBuilder: new SceneBuilder()
}).then(runtime => runtime.run());
