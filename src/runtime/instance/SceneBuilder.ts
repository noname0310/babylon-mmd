import * as BABYLON from "@babylonjs/core";

import type { ISceneBuilder } from "../base/ISceneBuilder";

export class SceneBuilder implements ISceneBuilder {
    public build(canvas: HTMLCanvasElement, engine: BABYLON.Engine): BABYLON.Scene {
        const scene = new BABYLON.Scene(engine);
        scene.clearColor = new BABYLON.Color4(1, 1, 1, 1.0);

        const camera = new BABYLON.UniversalCamera("camera1", new BABYLON.Vector3(0, 5, -10), scene);
        camera.setTarget(BABYLON.Vector3.Zero());
        camera.attachControl(canvas, false);
        camera.keysUp.push("W".charCodeAt(0));
        camera.keysDown.push("S".charCodeAt(0));
        camera.keysLeft.push("A".charCodeAt(0));
        camera.keysRight.push("D".charCodeAt(0));

        const hemisphericLight = new BABYLON.HemisphericLight("light1", new BABYLON.Vector3(0, 1, 0), scene);
        hemisphericLight.intensity = 0.2;
        hemisphericLight.specular = new BABYLON.Color3(0, 0, 0);

        const directionalLight = new BABYLON.DirectionalLight("DirectionalLight", new BABYLON.Vector3(-1, -1, 1), scene);
        directionalLight.intensity = 0.8;

        const csmShadowGenerator = new BABYLON.CascadedShadowGenerator(1024, directionalLight);
        csmShadowGenerator.useContactHardeningShadow = true;
        csmShadowGenerator.forceBackFacesOnly = true;
        csmShadowGenerator.numCascades = 4;
        csmShadowGenerator.autoCalcDepthBounds = true;
        csmShadowGenerator.lambda = 1;
        csmShadowGenerator.depthClamp = true;
        csmShadowGenerator.filteringQuality = BABYLON.ShadowGenerator.QUALITY_HIGH;
        csmShadowGenerator.normalBias = 0.02;

        const sphere = BABYLON.MeshBuilder.CreateSphere("sphere1", {segments: 16, diameter: 2, sideOrientation: BABYLON.Mesh.FRONTSIDE}, scene);
        sphere.position.y = 1;
        sphere.receiveShadows = true;

        const ground = BABYLON.MeshBuilder.CreateGround("ground1", { width: 6, height: 6, subdivisions: 2, updatable: false }, scene);
        ground.receiveShadows = true;

        csmShadowGenerator.addShadowCaster(sphere);
        csmShadowGenerator.addShadowCaster(ground);

        // new BABYLON.TonemapPostProcess("tonemap", BABYLON.TonemappingOperator.Reinhard, 1.8, camera);

        const fxaaPostProcess = new BABYLON.FxaaPostProcess("fxaa", 1.0, camera);
        fxaaPostProcess.samples = 8;

        const imageProcessingPostProcess = new BABYLON.ImageProcessingPostProcess("imageProcessing", 1.0, camera);
        imageProcessingPostProcess.exposure = 1.0;
        imageProcessingPostProcess.contrast = 1.0;
        imageProcessingPostProcess.toneMappingEnabled = true;

        imageProcessingPostProcess.vignetteWeight = 0.5;
        imageProcessingPostProcess.vignetteStretch = 0.5;
        imageProcessingPostProcess.vignetteColor = new BABYLON.Color4(0, 0, 0, 0);
        imageProcessingPostProcess.vignetteEnabled = true;
        (globalThis as any).imageProcessingPostProcess = imageProcessingPostProcess;

        const ssaoRatio = {
            ssaoRatio: 0.5, // Ratio of the SSAO post-process, in a lower resolution
            combineRatio: 1.0 // Ratio of the combine post-process (combines the SSAO and the scene)
        };
        const ssao = new BABYLON.SSAORenderingPipeline("ssao", scene, ssaoRatio);
        ssao.fallOff = 0.000001;
        ssao.area = 1;
        ssao.radius = 0.0001;
        ssao.totalStrength = 1.0;
        ssao.base = 0.5;
        scene.postProcessRenderPipelineManager.attachCamerasToRenderPipeline("ssao", camera);

        return scene;
    }
}
