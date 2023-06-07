import type { Engine } from "@babylonjs/core";
import {
    CascadedShadowGenerator,
    Color3,
    Color4,
    Constants,
    DefaultRenderingPipeline,
    DirectionalLight,
    HemisphericLight,
    ImageProcessingConfiguration,
    MeshBuilder,
    MotionBlurPostProcess,
    Scene,
    SceneLoader,
    ShadowGenerator,
    SSAORenderingPipeline,
    SSRRenderingPipeline,
    UniversalCamera,
    Vector3
} from "@babylonjs/core";

import type { MmdStandardMaterialBuilder } from "@/loader/MmdStandardMaterialBuilder";
import { PmxLoader } from "@/loader/PmxLoader";

import type { ISceneBuilder } from "../base/ISceneBuilder";

export class SceneBuilder implements ISceneBuilder {
    public build(canvas: HTMLCanvasElement, engine: Engine): Scene {
        const pmxLoader = new PmxLoader();
        const materialBuilder = pmxLoader.materialBuilder as MmdStandardMaterialBuilder;
        // materialBuilder.loadDiffuseTexture = (): void => { /* do nothing */ };
        // materialBuilder.loadSphereTexture = (): void => { /* do nothing */ };
        // materialBuilder.loadToonTexture = (): void => { /* do nothing */ };
        materialBuilder.loadOutlineRenderingProperties = (): void => { /* do nothing */ };
        SceneLoader.RegisterPlugin(pmxLoader);

        const scene = new Scene(engine);
        scene.clearColor = new Color4(1, 1, 1, 1.0);

        const camera = new UniversalCamera("camera1", new Vector3(0, 15, -40), scene);
        camera.maxZ = 1000;
        camera.setTarget(new Vector3(0, 10, 0));
        camera.attachControl(canvas, false);
        camera.keysUp.push("W".charCodeAt(0));
        camera.keysDown.push("S".charCodeAt(0));
        camera.keysLeft.push("A".charCodeAt(0));
        camera.keysRight.push("D".charCodeAt(0));
        camera.inertia = 0;
        camera.angularSensibility = 500;
        camera.speed = 10;

        const hemisphericLight = new HemisphericLight("light1", new Vector3(0, 1, 0), scene);
        hemisphericLight.intensity = 0.4;
        hemisphericLight.specular = new Color3(0, 0, 0);
        hemisphericLight.groundColor = new Color3(1, 1, 1);

        const directionalLight = new DirectionalLight("DirectionalLight", new Vector3(0.5, -1, 1), scene);
        directionalLight.intensity = 0.8;

        const csmShadowGenerator = new CascadedShadowGenerator(1024, directionalLight);
        csmShadowGenerator.forceBackFacesOnly = true;
        csmShadowGenerator.numCascades = 4;
        csmShadowGenerator.autoCalcDepthBounds = true;
        csmShadowGenerator.lambda = 1;
        csmShadowGenerator.depthClamp = true;
        csmShadowGenerator.filteringQuality = ShadowGenerator.QUALITY_HIGH;
        csmShadowGenerator.normalBias = 0.02;

        // SceneLoader.Append("res/private_test/model/YYB Hatsune Miku_10th_v1.02.glb");

        SceneLoader.Append(
            "res/private_test/model/YYB Hatsune Miku_10th/YYB Hatsune Miku_10th_v1.02.pmx",
            undefined,
            scene,
            (scene) => {
                scene.meshes.forEach((mesh) => {
                    mesh.receiveShadows = true;
                    csmShadowGenerator.addShadowCaster(mesh);

                    if (mesh.skeleton) {
                        // const viewer = new SkeletonViewer(mesh.skeleton!, mesh, scene, false, 3, {
                        //     displayMode: SkeletonViewer.DISPLAY_SPHERE_AND_SPURS
                        // });
                        // viewer.isEnabled = true;

                        const skeleton = mesh.skeleton;

                        skeleton.bones[skeleton.getBoneIndexByName("左ひざD")].setRotation(new Vector3(0, Math.PI, 0));
                    }
                });
            }
        );

        // SceneLoader.ImportMesh(
        //     "sans",
        //     "res/private_test/model/YYB Hatsune Miku_10th/YYB Hatsune Miku_10th_v1.02.pmx"
        // );

        const ground = MeshBuilder.CreateGround("ground1", { width: 60, height: 60, subdivisions: 2, updatable: false }, scene);
        ground.receiveShadows = true;

        csmShadowGenerator.addShadowCaster(ground);

        const useHavyPostProcess = false;
        const useBasicPostProcess = true;

        if (useHavyPostProcess) {
            const motionBlur = new MotionBlurPostProcess("motionBlur", scene, 1.0, camera);
            motionBlur.motionStrength = 1;

            const ssaoRatio = {
                ssaoRatio: 0.5, // Ratio of the SSAO post-process, in a lower resolution
                combineRatio: 1.0 // Ratio of the combine post-process (combines the SSAO and the scene)
            };
            const ssao = new SSAORenderingPipeline("ssao", scene, ssaoRatio);
            ssao.fallOff = 0.000001;
            ssao.area = 1;
            ssao.radius = 0.0001;
            ssao.totalStrength = 0.5;
            ssao.base = 0.5;
            scene.postProcessRenderPipelineManager.attachCamerasToRenderPipeline("ssao", camera);

            const ssr = new SSRRenderingPipeline(
                "ssr",
                scene,
                [camera],
                false,
                Constants.TEXTURETYPE_UNSIGNED_BYTE
            );
            ssr.thickness = 0.1;
            ssr.selfCollisionNumSkip = 2;
            ssr.enableAutomaticThicknessComputation = true;
            ssr.blurDispersionStrength = 0.03;
            ssr.roughnessFactor = 0.1;
            ssr.samples = 4;
        }

        if (useBasicPostProcess) {
            const defaultPipeline = new DefaultRenderingPipeline("default", true, scene, [camera]);
            defaultPipeline.samples = 4;
            defaultPipeline.bloomEnabled = true;
            defaultPipeline.chromaticAberrationEnabled = true;
            defaultPipeline.chromaticAberration.aberrationAmount = 1;
            defaultPipeline.depthOfFieldEnabled = false;
            defaultPipeline.fxaaEnabled = true;
            defaultPipeline.imageProcessingEnabled = true;
            defaultPipeline.imageProcessing.toneMappingEnabled = true;
            defaultPipeline.imageProcessing.toneMappingType = ImageProcessingConfiguration.TONEMAPPING_ACES;
            defaultPipeline.imageProcessing.vignetteWeight = 0.5;
            defaultPipeline.imageProcessing.vignetteStretch = 0.5;
            defaultPipeline.imageProcessing.vignetteColor = new Color4(0, 0, 0, 0);
            defaultPipeline.imageProcessing.vignetteEnabled = true;
        }

        return scene;
    }
}
