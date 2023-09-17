import "@babylonjs/core/Loading/loadingScreen";
import "@babylonjs/core/Lights/Shadows/shadowGeneratorSceneComponent";
import "@babylonjs/core/Meshes/thinInstanceMesh";
import "@babylonjs/core/Rendering/prePassRendererSceneComponent";
import "@babylonjs/core/Rendering/depthRendererSceneComponent";
import "@babylonjs/core/Rendering/geometryBufferRendererSceneComponent";
import "@/Loader/Optimized/bpmxLoader";
import "@/Runtime/Animation/mmdRuntimeCameraAnimation";
import "@/Runtime/Animation/mmdRuntimeModelAnimation";

import { ArcRotateCamera } from "@babylonjs/core/Cameras/arcRotateCamera";
import { Constants } from "@babylonjs/core/Engines/constants";
import type { Engine } from "@babylonjs/core/Engines/engine";
import { DirectionalLight } from "@babylonjs/core/Lights/directionalLight";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { ShadowGenerator } from "@babylonjs/core/Lights/Shadows/shadowGenerator";
import { SceneLoader } from "@babylonjs/core/Loading/sceneLoader";
import { ImageProcessingConfiguration } from "@babylonjs/core/Materials/imageProcessingConfiguration";
import type { MultiMaterial } from "@babylonjs/core/Materials/multiMaterial";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
// import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Color3, Color4 } from "@babylonjs/core/Maths/math.color";
import { Matrix, Vector3 } from "@babylonjs/core/Maths/math.vector";
import { CreateGround } from "@babylonjs/core/Meshes/Builders/groundBuilder";
// import { CreateGround } from "@babylonjs/core/Meshes/Builders/groundBuilder";
import type { Mesh } from "@babylonjs/core/Meshes/mesh";
import { DepthOfFieldEffectBlurLevel } from "@babylonjs/core/PostProcesses/depthOfFieldEffect";
import { DefaultRenderingPipeline } from "@babylonjs/core/PostProcesses/RenderPipeline/Pipelines/defaultRenderingPipeline";
import { SSRRenderingPipeline } from "@babylonjs/core/PostProcesses/RenderPipeline/Pipelines/ssrRenderingPipeline";
import { Scene } from "@babylonjs/core/scene";

import type { MmdAnimation } from "@/Loader/Animation/mmdAnimation";
import type { MmdStandardMaterial } from "@/Loader/mmdStandardMaterial";
import type { MmdStandardMaterialBuilder } from "@/Loader/mmdStandardMaterialBuilder";
import type { BpmxLoader } from "@/Loader/Optimized/bpmxLoader";
import { BvmdLoader } from "@/Loader/Optimized/bvmdLoader";
import { SdefInjector } from "@/Loader/sdefInjector";
import { StreamAudioPlayer } from "@/Runtime/Audio/streamAudioPlayer";
import { MmdCamera } from "@/Runtime/mmdCamera";
import { MmdRuntime } from "@/Runtime/mmdRuntime";
import { MmdPlayerControl } from "@/Runtime/Util/mmdPlayerControl";

import type { ISceneBuilder } from "../baseRuntime";

export class SceneBuilder implements ISceneBuilder {
    public async build(canvas: HTMLCanvasElement, engine: Engine): Promise<Scene> {
        SdefInjector.OverrideEngineCreateEffect(engine);
        const pmxLoader = SceneLoader.GetPluginForExtension(".bpmx") as BpmxLoader;
        pmxLoader.loggingEnabled = true;
        const materialBuilder = pmxLoader.materialBuilder as MmdStandardMaterialBuilder;
        // materialBuilder.loadDiffuseTexture = (): void => { /* do nothing */ };
        // materialBuilder.loadSphereTexture = (): void => { /* do nothing */ };
        // materialBuilder.loadToonTexture = (): void => { /* do nothing */ };
        materialBuilder.loadOutlineRenderingProperties = (): void => { /* do nothing */ };

        const scene = new Scene(engine);
        scene.clearColor = new Color4(0.95, 0.95, 0.95, 1.0);
        // scene.autoClearDepthAndStencil = false;

        const mmdCamera = new MmdCamera("mmdCamera", new Vector3(0, 10, 0), scene);
        mmdCamera.maxZ = 5000;

        const camera = new ArcRotateCamera("arcRotateCamera", 0, 0, 45, new Vector3(0, 10, 0), scene);
        camera.maxZ = 5000;
        camera.setPosition(new Vector3(0, 10, -45));
        camera.attachControl(canvas, false);
        camera.inertia = 0.8;
        camera.speed = 10;

        const hemisphericLight = new HemisphericLight("hemisphericLight", new Vector3(0, 1, 0), scene);
        hemisphericLight.intensity = 0.4;
        hemisphericLight.specular = new Color3(0, 0, 0);
        hemisphericLight.groundColor = new Color3(1, 1, 1);

        const directionalLight = new DirectionalLight("directionalLight", new Vector3(0.5, -1, 1), scene);
        directionalLight.intensity = 0.8;
        directionalLight.autoCalcShadowZBounds = false;
        directionalLight.autoUpdateExtends = false;
        directionalLight.shadowMaxZ = 20;
        directionalLight.shadowMinZ = -20;
        directionalLight.orthoTop = 18;
        directionalLight.orthoBottom = -3;
        directionalLight.orthoLeft = -10;
        directionalLight.orthoRight = 10;
        directionalLight.shadowOrthoScale = 0;

        // const directionalLightFrustumViewer = new DirectionalLightFrustumViewer(directionalLight, mmdCamera);
        // scene.onBeforeRenderObservable.add(() => directionalLightFrustumViewer.update());

        const shadowGenerator = new ShadowGenerator(1024, directionalLight, true);
        shadowGenerator.usePercentageCloserFiltering = true;
        shadowGenerator.forceBackFacesOnly = false;
        shadowGenerator.bias = 0.01;
        shadowGenerator.filteringQuality = ShadowGenerator.QUALITY_MEDIUM;
        shadowGenerator.frustumEdgeFalloff = 0.1;

        const ground = CreateGround("ground1", { width: 120, height: 120, subdivisions: 2, updatable: false }, scene);
        ground.receiveShadows = true;
        const groundMaterial = ground.material = new StandardMaterial("groundMaterial", scene);
        groundMaterial.diffuseColor = new Color3(1.02, 1.02, 1.02);
        ground.position.z += 50;

        const mmdRuntime = new MmdRuntime();
        mmdRuntime.loggingEnabled = true;

        mmdRuntime.register(scene);
        mmdRuntime.playAnimation();

        const audioPlayer = new StreamAudioPlayer(scene);
        audioPlayer.preservesPitch = false;
        audioPlayer.source = "res/private_test/motion/patchwork_staccato/pv_912.mp3";
        mmdRuntime.setAudioPlayer(audioPlayer);

        const mmdPlayerControl = new MmdPlayerControl(scene, mmdRuntime, audioPlayer);
        mmdPlayerControl.showPlayerControl();

        engine.displayLoadingUI();

        let loadingTexts: string[] = [];
        const updateLoadingText = (updateIndex: number, text: string): void => {
            loadingTexts[updateIndex] = text;
            engine.loadingUIText = "<br/><br/><br/><br/>" + loadingTexts.join("<br/><br/>");
        };

        const promises: Promise<any>[] = [];

        const bvmdLoader = new BvmdLoader(scene);
        bvmdLoader.loggingEnabled = true;

        promises.push(bvmdLoader.loadAsync("motion", "res/private_test/motion/patchwork_staccato/motion.bvmd",
            (event) => updateLoadingText(0, `Loading motion... ${event.loaded}/${event.total} (${Math.floor(event.loaded * 100 / event.total)}%)`))
        );

        pmxLoader.boundingBoxMargin = 60;
        promises.push(SceneLoader.ImportMeshAsync(
            undefined,
            "res/private_test/model/",
            "YYB Hatsune Miku_10th.bpmx",
            scene,
            (event) => updateLoadingText(1, `Loading model... ${event.loaded}/${event.total} (${Math.floor(event.loaded * 100 / event.total)}%)`)
        ));

        pmxLoader.boundingBoxMargin = 0;
        pmxLoader.buildSkeleton = false;
        pmxLoader.buildMorph = false;
        promises.push(SceneLoader.ImportMeshAsync(
            undefined,
            "res/private_test/stage/",
            "Stage35_02.bpmx",
            scene,
            (event) => updateLoadingText(2, `Loading stage... ${event.loaded}/${event.total} (${Math.floor(event.loaded * 100 / event.total)}%)`)
        ));

        loadingTexts = new Array(promises.length).fill("");

        const loadResults = await Promise.all(promises);

        mmdRuntime.setManualAnimationDuration((loadResults[0] as MmdAnimation).endFrame);

        scene.onAfterRenderObservable.addOnce(() => {
            engine.hideLoadingUI();

            scene.freezeMaterials();

            const meshes = scene.meshes;
            for (let i = 0, len = meshes.length; i < len; ++i) {
                const mesh = meshes[i];
                mesh.freezeWorldMatrix();
                mesh.doNotSyncBoundingInfo = true;
                mesh.isPickable = false;
                mesh.doNotSyncBoundingInfo = true;
                mesh.alwaysSelectAsActiveMesh = true;
            }

            scene.skipPointerMovePicking = true;
            scene.skipPointerDownPicking = true;
            scene.skipPointerUpPicking = true;
            scene.skipFrustumClipping = true;
            scene.blockMaterialDirtyMechanism = true;
        });

        mmdRuntime.setCamera(mmdCamera);
        mmdCamera.addAnimation(loadResults[0] as MmdAnimation);
        mmdCamera.setAnimation("motion");

        {
            const modelMesh = loadResults[1].meshes[0] as Mesh;
            shadowGenerator.addShadowCaster(modelMesh);
            modelMesh.receiveShadows = true;

            const mmdModel = mmdRuntime.createMmdModel(modelMesh, {
                buildPhysics: true
            });
            mmdModel.addAnimation(loadResults[0] as MmdAnimation);
            mmdModel.setAnimation("motion");

            const bodyBone = modelMesh.skeleton!.bones.find((bone) => bone.name === "センター");
            const meshWorldMatrix = modelMesh.getWorldMatrix();
            const boneWorldMatrix = new Matrix();
            scene.onBeforeRenderObservable.add(() => {
                boneWorldMatrix.copyFrom(bodyBone!.getFinalMatrix()).multiplyToRef(meshWorldMatrix, boneWorldMatrix);
                boneWorldMatrix.getTranslationToRef(directionalLight.position);
                directionalLight.position.y -= 10;

                camera.target.copyFrom(directionalLight.position);
                camera.target.y += 13;
            });
        }

        const ssr = new SSRRenderingPipeline(
            "ssr",
            scene,
            [mmdCamera, camera],
            false,
            Constants.TEXTURETYPE_UNSIGNED_BYTE
        );
        ssr.step = 32;
        ssr.maxSteps = 128;
        ssr.maxDistance = 500;
        ssr.enableSmoothReflections = false;
        ssr.enableAutomaticThicknessComputation = false;
        ssr.blurDownsample = 2;
        ssr.ssrDownsample = 2;
        ssr.thickness = 0.1;
        ssr.selfCollisionNumSkip = 2;
        ssr.blurDispersionStrength = 0;
        ssr.roughnessFactor = 0.1;
        ssr.reflectivityThreshold = 0.9;
        ssr.samples = 4;

        setTimeout(() => {
            let frameSum = 0;
            const performanceTestStart = performance.now();
            const performanceTest = (): void => {
                frameSum += 1;
                if (frameSum === 60) {
                    const fps = frameSum / ((performance.now() - performanceTestStart) / 1000);

                    if (fps < 30) {
                        scene.onAfterRenderObservable.add(disableSsr);
                    }
                    scene.onAfterRenderObservable.removeCallback(performanceTest);
                }
            };
            scene.onAfterRenderObservable.add(performanceTest);
        }, 2000);

        const disableSsr = (): void => {
            ssr.strength -= 0.1;

            if (ssr.strength <= 0) {
                scene.onAfterRenderObservable.removeCallback(disableSsr);
                ssr.dispose(true);
            }
        };

        const defaultPipeline = new DefaultRenderingPipeline("default", true, scene, [mmdCamera, camera]);
        defaultPipeline.samples = 4;
        defaultPipeline.bloomEnabled = true;
        defaultPipeline.chromaticAberrationEnabled = false;
        defaultPipeline.depthOfFieldEnabled = true;
        defaultPipeline.depthOfFieldBlurLevel = DepthOfFieldEffectBlurLevel.High;
        defaultPipeline.fxaaEnabled = true;
        defaultPipeline.imageProcessingEnabled = true;
        defaultPipeline.imageProcessing.toneMappingEnabled = true;
        defaultPipeline.imageProcessing.toneMappingType = ImageProcessingConfiguration.TONEMAPPING_ACES;
        defaultPipeline.imageProcessing.vignetteWeight = 0.5;
        defaultPipeline.imageProcessing.vignetteStretch = 0.5;
        defaultPipeline.imageProcessing.vignetteColor = new Color4(0, 0, 0, 0);
        defaultPipeline.imageProcessing.vignetteEnabled = true;

        defaultPipeline.depthOfField.fStop = 0.05;
        defaultPipeline.depthOfField.focalLength = 20;

        const modelMesh = loadResults[1].meshes[0] as Mesh;
        const modelMaterials = (modelMesh.material as MultiMaterial).subMaterials;
        for (let i = 0; i < modelMaterials.length; ++i) {
            const material = modelMaterials[i] as MmdStandardMaterial;
            if (material.name === "Hairshadow") {
                material.alphaMode = Constants.ALPHA_SUBTRACT;
            }
        }

        // note: this dof distance compute will broken when camera and mesh is not in same space
        const headBone = modelMesh.skeleton!.bones.find((bone) => bone.name === "頭");

        const rotationMatrix = new Matrix();
        const cameraNormal = new Vector3();
        const cameraEyePosition = new Vector3();
        const headRelativePosition = new Vector3();

        scene.onBeforeRenderObservable.add(() => {
            const cameraRotation = mmdCamera.rotation;
            Matrix.RotationYawPitchRollToRef(-cameraRotation.y, -cameraRotation.x, -cameraRotation.z, rotationMatrix);

            Vector3.TransformNormalFromFloatsToRef(0, 0, 1, rotationMatrix, cameraNormal);

            mmdCamera.position.addToRef(
                Vector3.TransformCoordinatesFromFloatsToRef(0, 0, mmdCamera.distance, rotationMatrix, cameraEyePosition),
                cameraEyePosition
            );

            headBone!.getFinalMatrix().getTranslationToRef(headRelativePosition)
                .subtractToRef(cameraEyePosition, headRelativePosition);

            defaultPipeline.depthOfField.focusDistance = (Vector3.Dot(headRelativePosition, cameraNormal) / Vector3.Dot(cameraNormal, cameraNormal)) * 1000;
        });

        // const stageMesh = loadResults[2].meshes[0] as Mesh;
        // stageMesh.position.z += 50;

        let lastClickTime = -Infinity;
        canvas.onclick = (): void => {
            const currentTime = performance.now();
            if (500 < currentTime - lastClickTime) {
                lastClickTime = currentTime;
                return;
            }

            lastClickTime = -Infinity;

            if (scene.activeCamera === mmdCamera) {
                defaultPipeline.depthOfFieldEnabled = false;
                scene.activeCamera = camera;
            } else {
                defaultPipeline.depthOfFieldEnabled = true;
                scene.activeCamera = mmdCamera;
            }
        };

        return scene;
    }
}
