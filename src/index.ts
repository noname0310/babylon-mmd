import css from "./index.css";
css;

import * as BABYLON from "babylonjs";

import { MmdDataDeserializer } from "./loader/parser/MmdDataDeserializer";
import { RuntimeBuilder } from "./runtime/base/RuntimeBuilder";
import { SceneBuilder } from "./runtime/instance/SceneBuilder";
import { TickRunner } from "./runtime/instance/TickRunner";

function engineStartup(): void {
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
}

engineStartup;


async function deserializerTest(): Promise<void> {
    const data = await fetch("res/private_test/YYB Hatsune Miku_10th/YYB Hatsune Miku_10th_v1.02.pmx")
        .then((response) => response.arrayBuffer());
    const dataDeserializer = new MmdDataDeserializer(data);

    const magic = dataDeserializer.getUint8();

    console.log(magic);
}

deserializerTest();
