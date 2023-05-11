import css from "./index.css";
css;

import * as BABYLON from "babylonjs";

import { PmxReader } from "./loader/parser/PmxReader";
import { VmdObject } from "./loader/parser/VmdObject";
import { RuntimeBuilder } from "./runtime/base/RuntimeBuilder";
import { SceneBuilder } from "./runtime/instance/SceneBuilder";
import { TickRunner } from "./runtime/instance/TickRunner";

function engineStartup(): void {
    const canvas = document.getElementById("render-canvas");
    if (!(canvas instanceof HTMLCanvasElement)) throw new Error("Invalid canvas element");

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

    Object.defineProperty(globalThis, "runtime", {
        value: runtime,
        writable: false,
        enumerable: true,
        configurable: false
    });
}

engineStartup;

async function deserializerTest(): Promise<void> {
    const pmxData = await fetch("res/private_test/model/YYB Hatsune Miku_10th/YYB Hatsune Miku_10th_v1.02_2.1t.pmx")
        .then((response) => response.arrayBuffer());

    const pmxObject = PmxReader.parse(pmxData);
    console.log(pmxObject);

    function printParsedVmdObject(vmdObject: VmdObject): void {
        const printObject: any = {};

        const boneKeyFrames = vmdObject.boneKeyFrames;
        const boneKeyFrameLength = boneKeyFrames.length;
        const parsedBoneKeyFrames: VmdObject.BoneKeyFrame[] = [];
        for (let i = 0; i < boneKeyFrameLength; ++i) {
            const keyFrame = boneKeyFrames.get(i);
            parsedBoneKeyFrames.push(keyFrame);
        }
        printObject.aBoneKeyFrames = parsedBoneKeyFrames;

        const morphKeyFrames = vmdObject.morphKeyFrames;
        const morphKeyFrameLength = morphKeyFrames.length;
        const parsedMorphKeyFrames: VmdObject.MorphKeyFrame[] = [];
        for (let i = 0; i < morphKeyFrameLength; ++i) {
            const keyFrame = morphKeyFrames.get(i);
            parsedMorphKeyFrames.push(keyFrame);
        }
        printObject.bMorphKeyFrames = parsedMorphKeyFrames;

        const cameraKeyFrames = vmdObject.cameraKeyFrames;
        const cameraKeyFrameLength = cameraKeyFrames.length;
        const parsedCameraKeyFrames: VmdObject.CameraKeyFrame[] = [];
        for (let i = 0; i < cameraKeyFrameLength; ++i) {
            const keyFrame = cameraKeyFrames.get(i);
            parsedCameraKeyFrames.push(keyFrame);
        }
        printObject.cCameraKeyFrames = parsedCameraKeyFrames;

        const lightKeyFrames = vmdObject.lightKeyFrames;
        const lightKeyFrameLength = lightKeyFrames.length;
        const parsedLightKeyFrames: VmdObject.LightKeyFrame[] = [];
        for (let i = 0; i < lightKeyFrameLength; ++i) {
            const keyFrame = lightKeyFrames.get(i);
            parsedLightKeyFrames.push(keyFrame);
        }
        printObject.dLightKeyFrames = parsedLightKeyFrames;

        const selfShadowKeyFrames = vmdObject.selfShadowKeyFrames;
        const selfShadowKeyFrameLength = selfShadowKeyFrames.length;
        const parsedSelfShadowKeyFrames: VmdObject.SelfShadowKeyFrame[] = [];
        for (let i = 0; i < selfShadowKeyFrameLength; ++i) {
            const keyFrame = selfShadowKeyFrames.get(i);
            parsedSelfShadowKeyFrames.push(keyFrame);
        }
        printObject.eSelfShadowKeyFrames = parsedSelfShadowKeyFrames;

        console.log(printObject);
    }

    const vmdCameraData = await fetch("res/private_test/motion/flos/camera.vmd")
        .then((response) => response.arrayBuffer());

    const vmdCameraObject = VmdObject.parseFromBuffer(vmdCameraData);
    console.log(vmdCameraObject);
    printParsedVmdObject(vmdCameraObject);

    const vmdModelData = await fetch("res/private_test/motion/flos/model.vmd")
        .then((response) => response.arrayBuffer());

    const vmdModelObject = VmdObject.parseFromBuffer(vmdModelData);
    console.log(vmdModelObject);
    printParsedVmdObject(vmdModelObject);
}

deserializerTest();
