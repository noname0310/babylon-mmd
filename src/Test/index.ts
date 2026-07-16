import { BaseRuntime } from "./baseRuntime";
import { SceneBuilder } from "./Scene/wasmPhysicsTestScene";

const Canvas = document.createElement("canvas");
Canvas.style.width = "100%";
Canvas.style.height = "100%";
Canvas.style.display = "block";
document.body.appendChild(Canvas);

let Engine;

const UseWebGPU = false;
if (UseWebGPU) {
    const [ engineModule, registerEngineExtensionsModule ] = await Promise.all([
        import("@babylonjs/core/Engines/webgpuEngine.pure"),
        import("./Util/registerEngineWebGPUExtensions")
    ]);
    registerEngineExtensionsModule.RegisterEngineWebGPUExtensions();
    Engine = new engineModule.WebGPUEngine(Canvas, {
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
    const [ engineModule, registerEngineExtensionsModule ] = await Promise.all([
        import("@babylonjs/core/Engines/engine.pure"),
        import("./Util/registerEngineExtensions")
    ]);
    registerEngineExtensionsModule.RegisterEngineExtensions();
    Engine = new engineModule.Engine(Canvas, false, {
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
