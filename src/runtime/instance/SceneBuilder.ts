import * as BABYLON from "@babylonjs/core";

import { PmxLoader } from "@/loader/PmxLoader";

import type { ISceneBuilder } from "../base/ISceneBuilder";

export class SceneBuilder implements ISceneBuilder {
    public build(canvas: HTMLCanvasElement, engine: BABYLON.Engine): BABYLON.Scene {
        BABYLON.SceneLoader.RegisterPlugin(new PmxLoader());

        const scene = new BABYLON.Scene(engine);
        scene.clearColor = new BABYLON.Color4(1, 1, 1, 1.0);

        const camera = new BABYLON.UniversalCamera("camera1", new BABYLON.Vector3(0, 15, -40), scene);
        camera.setTarget(new BABYLON.Vector3(0, 10, 0));
        camera.attachControl(canvas, false);
        camera.keysUp.push("W".charCodeAt(0));
        camera.keysDown.push("S".charCodeAt(0));
        camera.keysLeft.push("A".charCodeAt(0));
        camera.keysRight.push("D".charCodeAt(0));

        const hemisphericLight = new BABYLON.HemisphericLight("light1", new BABYLON.Vector3(0, 1, 0), scene);
        hemisphericLight.intensity = 0.4;
        hemisphericLight.specular = new BABYLON.Color3(0, 0, 0);
        hemisphericLight.groundColor = new BABYLON.Color3(1, 1, 1);

        const directionalLight = new BABYLON.DirectionalLight("DirectionalLight", new BABYLON.Vector3(-1, -1, 1), scene);
        directionalLight.intensity = 0.8;

        const csmShadowGenerator = new BABYLON.CascadedShadowGenerator(1024, directionalLight);
        csmShadowGenerator.forceBackFacesOnly = true;
        csmShadowGenerator.numCascades = 4;
        csmShadowGenerator.autoCalcDepthBounds = true;
        csmShadowGenerator.lambda = 1;
        csmShadowGenerator.depthClamp = true;
        csmShadowGenerator.filteringQuality = BABYLON.ShadowGenerator.QUALITY_HIGH;
        csmShadowGenerator.normalBias = 0.02;

        // const sphere = BABYLON.MeshBuilder.CreateSphere("sphere1", {segments: 16, diameter: 2, sideOrientation: BABYLON.Mesh.FRONTSIDE}, scene);
        // sphere.position.y = 1;
        // sphere.receiveShadows = true;

        // BABYLON.SceneLoader.Append("res/private_test/model/YYB Hatsune Miku_10th_v1.02.glb");

        BABYLON.SceneLoader.Append(
            "res/private_test/model/YYB Hatsune Miku_10th/YYB Hatsune Miku_10th_v1.02.pmx",
            undefined,
            scene,
            (scene) => {
                scene.meshes.forEach((mesh) => {
                    mesh.receiveShadows = true;
                    csmShadowGenerator.addShadowCaster(mesh);
                });
            }
        );

        // BABYLON.SceneLoader.ImportMesh(
        //     "sans",
        //     "res/private_test/model/YYB Hatsune Miku_10th/YYB Hatsune Miku_10th_v1.02.pmx"
        // );

        const ground = BABYLON.MeshBuilder.CreateGround("ground1", { width: 60, height: 60, subdivisions: 2, updatable: false }, scene);
        ground.receiveShadows = true;

        //csmShadowGenerator.addShadowCaster(sphere);
        // csmShadowGenerator.addShadowCaster(
        csmShadowGenerator.addShadowCaster(ground);

        const motionBlur = new BABYLON.MotionBlurPostProcess("motionBlur", scene, 1.0, camera);
        motionBlur.motionStrength = 1;

        const ssaoRatio = {
            ssaoRatio: 0.5, // Ratio of the SSAO post-process, in a lower resolution
            combineRatio: 1.0 // Ratio of the combine post-process (combines the SSAO and the scene)
        };
        const ssao = new BABYLON.SSAORenderingPipeline("ssao", scene, ssaoRatio);
        ssao.fallOff = 0.000001;
        ssao.area = 1;
        ssao.radius = 0.0001;
        ssao.totalStrength = 0.5;
        ssao.base = 0.5;
        scene.postProcessRenderPipelineManager.attachCamerasToRenderPipeline("ssao", camera);

        const ssr = new BABYLON.SSRRenderingPipeline(
            "ssr",
            scene,
            [camera],
            false,
            BABYLON.Constants.TEXTURETYPE_UNSIGNED_BYTE
        );
        ssr.thickness = 0.1;
        ssr.selfCollisionNumSkip = 2;
        ssr.enableAutomaticThicknessComputation = true;
        ssr.blurDispersionStrength = 0.03;
        ssr.roughnessFactor = 0.1;
        ssr.samples = 4;

        const defaultPipeline = new BABYLON.DefaultRenderingPipeline("default", true, scene, [camera]);
        defaultPipeline.samples = 4;
        defaultPipeline.bloomEnabled = true;
        defaultPipeline.chromaticAberrationEnabled = true;
        defaultPipeline.chromaticAberration.aberrationAmount = 1;
        defaultPipeline.depthOfFieldEnabled = false;
        defaultPipeline.fxaaEnabled = true;
        defaultPipeline.imageProcessingEnabled = true;
        defaultPipeline.imageProcessing.toneMappingEnabled = true;
        defaultPipeline.imageProcessing.toneMappingType = BABYLON.ImageProcessingConfiguration.TONEMAPPING_ACES;
        defaultPipeline.imageProcessing.vignetteWeight = 0.5;
        defaultPipeline.imageProcessing.vignetteStretch = 0.5;
        defaultPipeline.imageProcessing.vignetteColor = new BABYLON.Color4(0, 0, 0, 0);
        defaultPipeline.imageProcessing.vignetteEnabled = true;

        return scene;
    }
}
