import { Engine } from "@babylonjs/core/Engines/engine";

import { BaseRuntime } from "./baseRuntime";
import { SceneBuilder } from "./Scene/vmdConverterScene";

const Canvas = document.createElement("canvas");
Canvas.style.width = "100%";
Canvas.style.height = "100%";
Canvas.style.display = "block";
document.body.appendChild(Canvas);

const Eengine = new Engine(Canvas, false, {
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

BaseRuntime.CreateAsync({
    canvas: Canvas,
    engine: Eengine,
    sceneBuilder: new SceneBuilder()
}).then(runtime => runtime.run());
