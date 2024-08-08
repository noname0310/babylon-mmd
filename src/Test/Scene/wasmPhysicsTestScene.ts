import "@babylonjs/core/Loading/loadingScreen";
import "@babylonjs/core/Rendering/prePassRendererSceneComponent";
import "@babylonjs/core/Rendering/depthRendererSceneComponent";
import "@babylonjs/core/Rendering/geometryBufferRendererSceneComponent";
import "@/Loader/Optimized/bpmxLoader";
import "@/Loader/mmdOutlineRenderer";
import "@/Runtime/Animation/mmdRuntimeCameraAnimation";
import "@/Runtime/Optimized/Animation/mmdWasmRuntimeModelAnimation";

import type { AbstractEngine } from "@babylonjs/core/Engines/abstractEngine";
import { Constants } from "@babylonjs/core/Engines/constants";
import { SceneLoader } from "@babylonjs/core/Loading/sceneLoader";
import { ImageProcessingConfiguration } from "@babylonjs/core/Materials/imageProcessingConfiguration";
import { Color4 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
// import { HavokPlugin } from "@babylonjs/core/Physics/v2/Plugins/havokPlugin";
import { DepthOfFieldEffectBlurLevel } from "@babylonjs/core/PostProcesses/depthOfFieldEffect";
import { DefaultRenderingPipeline } from "@babylonjs/core/PostProcesses/RenderPipeline/Pipelines/defaultRenderingPipeline";
import { SSRRenderingPipeline } from "@babylonjs/core/PostProcesses/RenderPipeline/Pipelines/ssrRenderingPipeline";
import { Scene } from "@babylonjs/core/scene";

// import havokPhysics from "@babylonjs/havok";
import type { MmdAnimation } from "@/Loader/Animation/mmdAnimation";
import type { MmdStandardMaterialBuilder } from "@/Loader/mmdStandardMaterialBuilder";
import type { BpmxLoader } from "@/Loader/Optimized/bpmxLoader";
import { BvmdLoader } from "@/Loader/Optimized/bvmdLoader";
import { SdefInjector } from "@/Loader/sdefInjector";
import { StreamAudioPlayer } from "@/Runtime/Audio/streamAudioPlayer";
import { MmdCamera } from "@/Runtime/mmdCamera";
import type { MmdMesh } from "@/Runtime/mmdMesh";
// import { MmdPhysics } from "@/Runtime/mmdPhysics";
import { MmdWasmAnimation } from "@/Runtime/Optimized/Animation/mmdWasmAnimation";
import { MmdWasmInstanceTypeMPD } from "@/Runtime/Optimized/InstanceType/multiPhysicsDebug";
import type { MmdWasmInstance } from "@/Runtime/Optimized/mmdWasmInstance";
import { getMmdWasmInstance } from "@/Runtime/Optimized/mmdWasmInstance";
import { MmdWasmRuntime, MmdWasmRuntimeAnimationEvaluationType } from "@/Runtime/Optimized/mmdWasmRuntime";
import { MmdWasmPhysics } from "@/Runtime/Optimized/Physics/mmdWasmPhysics";
import { MmdPlayerControl } from "@/Runtime/Util/mmdPlayerControl";

import type { ISceneBuilder } from "../baseRuntime";
import { attachToBone } from "../Util/attachToBone";
import { createCameraSwitch } from "../Util/createCameraSwitch";
import { createDefaultArcRotateCamera } from "../Util/createDefaultArcRotateCamera";
import { createDefaultGround } from "../Util/createDefaultGround";
import { createLightComponents } from "../Util/createLightComponents";
import { MmdCameraAutoFocus } from "../Util/mmdCameraAutoFocus";
import { optimizeScene } from "../Util/optimizeScene";
import { parallelLoadAsync } from "../Util/parallelLoadAsync";

export class SceneBuilder implements ISceneBuilder {
    public async build(canvas: HTMLCanvasElement, engine: AbstractEngine): Promise<Scene> {
        SdefInjector.OverrideEngineCreateEffect(engine);
        const pmxLoader = SceneLoader.GetPluginForExtension(".bpmx") as BpmxLoader;
        pmxLoader.loggingEnabled = true;
        const materialBuilder = pmxLoader.materialBuilder as MmdStandardMaterialBuilder;
        materialBuilder;
        // materialBuilder.loadOutlineRenderingProperties = (): void => { /* do nothing */ };

        const scene = new Scene(engine);
        scene.clearColor = new Color4(0.95, 0.95, 0.95, 1.0);
        scene.autoClear = false;

        const mmdCamera = new MmdCamera("mmdCamera", new Vector3(0, 10, 0), scene);
        mmdCamera.maxZ = 5000;
        const camera = createDefaultArcRotateCamera(scene);
        createCameraSwitch(scene, canvas, mmdCamera, camera);
        const { directionalLight, shadowGenerator } = createLightComponents(scene);
        shadowGenerator.transparencyShadow = true;
        createDefaultGround(scene);

        const audioPlayer = new StreamAudioPlayer(scene);
        audioPlayer.preservesPitch = false;
        audioPlayer.source = "res/private_test/motion/patchwork_staccato/pv_912.mp3";

        const [
            [mmdRuntime, mmdAnimation, mmdWasmAnimation],
            modelMesh
        ] = await parallelLoadAsync(scene, [
            ["runtime & motion", async(updateProgress): Promise<[MmdWasmRuntime, MmdAnimation, MmdWasmAnimation]> => {
                const [mmdWasmInstance, mmdAnimation] = await parallelLoadAsync(scene, [
                    ["runtime", async(): Promise<MmdWasmInstance> => {
                        const mmdWasmInstance = await getMmdWasmInstance(new MmdWasmInstanceTypeMPD(), 2);
                        return mmdWasmInstance;
                    }],
                    ["motion", (): Promise<MmdAnimation> => {
                        const bvmdLoader = new BvmdLoader(scene);
                        bvmdLoader.loggingEnabled = true;
                        return bvmdLoader.loadAsync("motion", "res/private_test/motion/patchwork_staccato/motion_nonphys.bvmd", updateProgress);
                    }]
                ]);

                const mmdWasmAnimation = new MmdWasmAnimation(mmdAnimation, mmdWasmInstance, scene);

                const mmdRuntime = new MmdWasmRuntime(mmdWasmInstance, scene, new MmdWasmPhysics(scene));
                mmdRuntime.loggingEnabled = true;
                mmdRuntime.evaluationType = MmdWasmRuntimeAnimationEvaluationType.Buffered;

                mmdRuntime.setAudioPlayer(audioPlayer);

                const mmdPlayerControl = new MmdPlayerControl(scene, mmdRuntime, audioPlayer);
                mmdPlayerControl.showPlayerControl();

                mmdRuntime.register(scene);
                await mmdRuntime.playAnimation();

                return [mmdRuntime, mmdAnimation, mmdWasmAnimation];
            }],
            ["model", (updateProgress): Promise<MmdMesh> => {
                return SceneLoader.ImportMeshAsync(
                    "res/private_test/model/YYB Hatsune Miku_10th.bpmx",
                    scene,
                    {
                        onProgress: updateProgress,
                        pluginOptions: {
                            mmdmodel: {
                                boundingBoxMargin: 60
                            }
                        }
                    }
                ).then(result => result.meshes[0] as MmdMesh);
            }],
            ["stage", (updateProgress): Promise<MmdMesh> => {
                return SceneLoader.ImportMeshAsync(
                    "res/private_test/stage/Stage35_02_toonfix.bpmx",
                    scene,
                    {
                        onProgress: updateProgress,
                        pluginOptions: {
                            mmdmodel: {
                                buildSkeleton: false,
                                buildMorph: false,
                                boundingBoxMargin: 0
                            }
                        }
                    }
                ).then(result => result.meshes[0] as MmdMesh);
            }]
        ]);

        mmdRuntime.setManualAnimationDuration(mmdAnimation.endFrame);

        mmdRuntime.setCamera(mmdCamera);
        mmdCamera.addAnimation(mmdWasmAnimation);
        mmdCamera.setAnimation("motion");

        for (const mesh of modelMesh.metadata.meshes) {
            mesh.receiveShadows = true;
            shadowGenerator.addShadowCaster(mesh, false);
        }

        const mmdModel = mmdRuntime.createMmdModel(modelMesh, {
            buildPhysics: {
                worldId: 0
            }
        });
        mmdModel.addAnimation(mmdWasmAnimation);
        mmdModel.setAnimation("motion");

        attachToBone(scene, mmdModel, {
            directionalLightPosition: directionalLight.position,
            cameraTargetPosition: camera.target
        });
        scene.onAfterRenderObservable.addOnce(() => optimizeScene(scene));

        const ssr = new SSRRenderingPipeline(
            "ssr",
            scene,
            undefined,
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

        const defaultPipeline = new DefaultRenderingPipeline("default", true, scene);
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
        const mmdCameraAutoFocus = new MmdCameraAutoFocus(mmdCamera, defaultPipeline);
        mmdCameraAutoFocus.setTarget(mmdModel);
        mmdCameraAutoFocus.register(scene);

        for (const depthRenderer of Object.values(scene._depthRenderer)) {
            depthRenderer.forceDepthWriteTransparentMeshes = true;
        }

        const video = document.createElement("video");
        video.srcObject = canvas.captureStream();
        video.muted = true;
        video.play();

        document.addEventListener("keydown", (event: KeyboardEvent) => {
            if (event.key !== "p") return;
            if (document.pictureInPictureEnabled) video.requestPictureInPicture();
        });

        video.addEventListener("enterpictureinpicture", (event: Event) => {
            const pipEvent = event as PictureInPictureEvent;
            engine.setSize(pipEvent.pictureInPictureWindow.width, pipEvent.pictureInPictureWindow.height);
            pipEvent.pictureInPictureWindow.onresize = (event: Event): void => {
                const pipWindow = event.target as PictureInPictureWindow;
                engine.setSize(pipWindow.width, pipWindow.height);
            };
        });
        video.addEventListener("leavepictureinpicture", () => {
            engine.resize();
        });

        mmdRuntime.onPauseAnimationObservable.add(() => {
            if (mmdRuntime.animationFrameTimeDuration === mmdRuntime.currentFrameTime) {
                mmdRuntime.seekAnimation(0);
                mmdRuntime.playAnimation().then(() => {
                    mmdRuntime.initializeAllMmdModelsPhysics(true);
                });
            }
        });

        return scene;
    }
}
