import "@babylonjs/core/Loading/loadingScreen";
import "@babylonjs/core/Rendering/depthRendererSceneComponent";
import "@/Loader/Optimized/bpmxLoader";
import "@/Runtime/Animation/mmdRuntimeCameraAnimation";
import "@/Runtime/Optimized/Animation/mmdWasmRuntimeModelAnimation";
import "@/Runtime/Animation/mmdRuntimeModelAnimation";

import type { AbstractEngine } from "@babylonjs/core/Engines/abstractEngine";
import { LoadAssetContainerAsync } from "@babylonjs/core/Loading/sceneLoader";
import { ImageProcessingConfiguration } from "@babylonjs/core/Materials/imageProcessingConfiguration";
import { Color4 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { DepthOfFieldEffectBlurLevel } from "@babylonjs/core/PostProcesses/depthOfFieldEffect";
import { DefaultRenderingPipeline } from "@babylonjs/core/PostProcesses/RenderPipeline/Pipelines/defaultRenderingPipeline";
import { Scene } from "@babylonjs/core/scene";

import type { MmdAnimation } from "@/Loader/Animation/mmdAnimation";
import { MmdStandardMaterialBuilder } from "@/Loader/mmdStandardMaterialBuilder";
import { BvmdLoader } from "@/Loader/Optimized/bvmdLoader";
import { SdefInjector } from "@/Loader/sdefInjector";
import { StreamAudioPlayer } from "@/Runtime/Audio/streamAudioPlayer";
import { MmdCamera } from "@/Runtime/mmdCamera";
import type { MmdMesh } from "@/Runtime/mmdMesh";
import { MmdWasmAnimation } from "@/Runtime/Optimized/Animation/mmdWasmAnimation";
import { MmdWasmInstanceTypeMD } from "@/Runtime/Optimized/InstanceType/multiDebug";
import type { IMmdWasmInstance } from "@/Runtime/Optimized/mmdWasmInstance";
import { GetMmdWasmInstance } from "@/Runtime/Optimized/mmdWasmInstance";
import { MmdWasmRuntime, MmdWasmRuntimeAnimationEvaluationType } from "@/Runtime/Optimized/mmdWasmRuntime";
import ammo from "@/Runtime/Physics/External/ammo.wasm";
import { MmdAmmoJSPlugin } from "@/Runtime/Physics/mmdAmmoJSPlugin";
import { MmdAmmoPhysics } from "@/Runtime/Physics/mmdAmmoPhysics";
import { MmdPlayerControl } from "@/Runtime/Util/mmdPlayerControl";

import type { ISceneBuilder } from "../baseRuntime";
import { AttachToBone } from "../Util/attachToBone";
import { CreateCameraSwitch } from "../Util/createCameraSwitch";
import { CreateDefaultArcRotateCamera } from "../Util/createDefaultArcRotateCamera";
import { CreateLightComponents } from "../Util/createLightComponents";
import { MmdCameraAutoFocus } from "../Util/mmdCameraAutoFocus";
import { OptimizeScene } from "../Util/optimizeScene";
import { ParallelLoadAsync } from "../Util/parallelLoadAsync";

export class SceneBuilder implements ISceneBuilder {
    public async buildAsync(canvas: HTMLCanvasElement, engine: AbstractEngine): Promise<Scene> {
        SdefInjector.OverrideEngineCreateEffect(engine);
        engine.compatibilityMode = false;

        const scene = new Scene(engine);
        scene.clearColor = new Color4(0.95, 0.95, 0.95, 1.0);
        const mmdRoot = new TransformNode("mmdRoot", scene);
        const mmdCamera = new MmdCamera("mmdCamera", new Vector3(0, 10, 0), scene);
        mmdCamera.maxZ = 5000;
        mmdCamera.parent = mmdRoot;
        const camera = CreateDefaultArcRotateCamera(scene);
        CreateCameraSwitch(scene, canvas, mmdCamera, camera);
        const { directionalLight, shadowGenerator } = CreateLightComponents(scene, {
            orthoLeftOffset: -20,
            orthoRightOffset: 20,
            orthoBottomOffset: -5,
            orthoTopOffset: 5,
            shadowMinZOffset: -5
        });
        shadowGenerator.transparencyShadow = true;

        const audioPlayer = new StreamAudioPlayer(scene);
        audioPlayer.preservesPitch = false;
        audioPlayer.source = "res/private_test/motion/flos/flos - R Sound Design (Piano Cover).mp3";

        const materialBuilder = new MmdStandardMaterialBuilder();
        materialBuilder.loadOutlineRenderingProperties = (): void => { /* do nothing */ };

        const [
            [mmdRuntime, mmdAnimation, mmdWasmAnimation],
            modelMesh1,
            modelMesh2,
            modelMesh3,
            modelMesh4,
            modelMesh5,
            stageMesh
        ] = await ParallelLoadAsync(scene, [
            ["runtime & motion", async(updateProgress): Promise<[MmdWasmRuntime, MmdAnimation, MmdWasmAnimation]> => {
                const [mmdWasmInstance, mmdAnimation] = await ParallelLoadAsync(scene, [
                    ["runtime", async(): Promise<IMmdWasmInstance> => {
                        const mmdWasmInstance = await GetMmdWasmInstance(new MmdWasmInstanceTypeMD());
                        return mmdWasmInstance;
                    }],
                    ["motion", (): Promise<MmdAnimation> => {
                        const bvmdLoader = new BvmdLoader(scene);
                        bvmdLoader.loggingEnabled = true;
                        return bvmdLoader.loadAsync("motion", "res/private_test/motion/flos/motion.bvmd", updateProgress);
                    }]
                ]);

                const mmdWasmAnimation = new MmdWasmAnimation(mmdAnimation, mmdWasmInstance, scene);

                const mmdRuntime = new MmdWasmRuntime(mmdWasmInstance, scene, new MmdAmmoPhysics(scene));
                mmdRuntime.loggingEnabled = true;
                mmdRuntime.evaluationType = MmdWasmRuntimeAnimationEvaluationType.Buffered;

                mmdRuntime.setAudioPlayer(audioPlayer);

                const mmdPlayerControl = new MmdPlayerControl(scene, mmdRuntime, audioPlayer);
                mmdPlayerControl.showPlayerControl();

                mmdRuntime.register(scene);
                await mmdRuntime.playAnimation();

                return [mmdRuntime, mmdAnimation, mmdWasmAnimation];
            }],
            ["model1", (updateProgress): Promise<MmdMesh> => LoadAssetContainerAsync(
                "res/private_test/model/yyb_deep_canyons_miku.bpmx",
                scene,
                {
                    onProgress: updateProgress,
                    pluginOptions: {
                        mmdmodel: {
                            materialBuilder: materialBuilder,
                            boundingBoxMargin: 60,
                            loggingEnabled: true
                        }
                    }
                }
            ).then(result => {
                result.addAllToScene();
                return result.meshes[0] as MmdMesh;
            })],
            ["model2", (updateProgress): Promise<MmdMesh> => LoadAssetContainerAsync(
                "res/private_test/model/YYB Hatsune Miku_10th.bpmx",
                scene,
                {
                    onProgress: updateProgress,
                    pluginOptions: {
                        mmdmodel: {
                            materialBuilder: materialBuilder,
                            boundingBoxMargin: 60,
                            loggingEnabled: true
                        }
                    }
                }
            ).then(result => {
                result.addAllToScene();
                return result.meshes[0] as MmdMesh;
            })],
            ["model3", (updateProgress): Promise<MmdMesh> => LoadAssetContainerAsync(
                "res/private_test/model/YYB miku Crown Knight.bpmx",
                scene,
                {
                    onProgress: updateProgress,
                    pluginOptions: {
                        mmdmodel: {
                            materialBuilder: materialBuilder,
                            boundingBoxMargin: 60,
                            loggingEnabled: true
                        }
                    }
                }
            ).then(result => {
                result.addAllToScene();
                return result.meshes[0] as MmdMesh;
            })],
            ["model4", (updateProgress): Promise<MmdMesh> => LoadAssetContainerAsync(
                "res/private_test/model/YYB Piano dress Miku Collision fix FF BF.bpmx",
                scene,
                {
                    onProgress: updateProgress,
                    pluginOptions: {
                        mmdmodel: {
                            materialBuilder: materialBuilder,
                            boundingBoxMargin: 60,
                            loggingEnabled: true
                        }
                    }
                }
            ).then(result => {
                result.addAllToScene();
                return result.meshes[0] as MmdMesh;
            })],
            ["model5", (updateProgress): Promise<MmdMesh> => LoadAssetContainerAsync(
                "res/private_test/model/yyb Symphony Miku by HB-Squiddy FF.bpmx",
                scene,
                {
                    onProgress: updateProgress,
                    pluginOptions: {
                        mmdmodel: {
                            materialBuilder: materialBuilder,
                            boundingBoxMargin: 60,
                            loggingEnabled: true
                        }
                    }
                }
            ).then(result => {
                result.addAllToScene();
                return result.meshes[0] as MmdMesh;
            })],
            ["stage", (updateProgress): Promise<MmdMesh> => LoadAssetContainerAsync(
                "res/private_test/stage/water house.bpmx",
                scene,
                {
                    onProgress: updateProgress,
                    pluginOptions: {
                        mmdmodel: {
                            materialBuilder: materialBuilder,
                            buildSkeleton: false,
                            buildMorph: false,
                            boundingBoxMargin: 0,
                            loggingEnabled: true
                        }
                    }
                }
            ).then(result => {
                result.addAllToScene();
                return result.meshes[0] as MmdMesh;
            })],
            ["physics", async(updateProgress): Promise<void> => {
                updateProgress({ lengthComputable: true, loaded: 0, total: 1 });
                const ammoInstance = await ammo();
                const ammoPlugin = new MmdAmmoJSPlugin(true, ammoInstance);
                scene.enablePhysics(new Vector3(0, -9.8 * 10, 0), ammoPlugin);
                updateProgress({ lengthComputable: true, loaded: 1, total: 1 });
            }]
        ]);

        mmdRuntime.setManualAnimationDuration(mmdAnimation.endFrame);

        mmdRuntime.setCamera(mmdCamera);
        mmdCamera.addAnimation(mmdAnimation);
        mmdCamera.setAnimation("motion");

        for (const mesh of modelMesh1.metadata.meshes) {
            mesh.receiveShadows = true;
            shadowGenerator.addShadowCaster(mesh, false);
        }
        modelMesh1.parent = mmdRoot;

        const mmdModel = mmdRuntime.createMmdModel(modelMesh1, {
            buildPhysics: true
        });
        mmdModel.addAnimation(mmdWasmAnimation);
        mmdModel.setAnimation("motion");

        {
            for (const mesh of modelMesh2.metadata.meshes) {
                mesh.receiveShadows = true;
                shadowGenerator.addShadowCaster(mesh, false);
            }
            modelMesh2.parent = mmdRoot;
            modelMesh2.position.x = 10;

            const mmdModel2 = mmdRuntime.createMmdModel(modelMesh2, {
                buildPhysics: true
            });
            mmdModel2.addAnimation(mmdWasmAnimation);
            mmdModel2.setAnimation("motion");

            for (const mesh of modelMesh3.metadata.meshes) {
                mesh.receiveShadows = true;
                shadowGenerator.addShadowCaster(mesh, false);
            }
            modelMesh3.parent = mmdRoot;
            modelMesh3.position.x = -10;

            const mmdModel3 = mmdRuntime.createMmdModel(modelMesh3, {
                buildPhysics: true
            });
            mmdModel3.addAnimation(mmdWasmAnimation);
            mmdModel3.setAnimation("motion");

            for (const mesh of modelMesh4.metadata.meshes) {
                mesh.receiveShadows = true;
                shadowGenerator.addShadowCaster(mesh, false);
            }
            modelMesh4.parent = mmdRoot;
            modelMesh4.position.x = 20;

            const mmdModel4 = mmdRuntime.createMmdModel(modelMesh4, {
                buildPhysics: true
            });
            mmdModel4.addAnimation(mmdAnimation);
            mmdModel4.setAnimation("motion");

            for (const mesh of modelMesh5.metadata.meshes) {
                mesh.receiveShadows = true;
                shadowGenerator.addShadowCaster(mesh, false);
            }
            modelMesh5.parent = mmdRoot;
            modelMesh5.position.x = -20;

            setTimeout(() => {
                const mmdModel5 = mmdRuntime.createMmdModel(modelMesh5, {
                    buildPhysics: true
                });
                mmdModel5.addAnimation(mmdWasmAnimation);
                mmdModel5.setAnimation("motion");
                scene.onAfterRenderObservable.addOnce(() => OptimizeScene(scene));
            });
        }

        AttachToBone(scene, mmdModel, {
            directionalLightPosition: directionalLight.position,
            cameraTargetPosition: camera.target
        });

        for (const mesh of stageMesh.metadata.meshes) mesh.receiveShadows = true;
        stageMesh.position.y += 0.01;

        const defaultPipeline = new DefaultRenderingPipeline("default", true, scene);
        defaultPipeline.samples = 4;
        defaultPipeline.bloomEnabled = true;
        defaultPipeline.chromaticAberrationEnabled = true;
        defaultPipeline.chromaticAberration.aberrationAmount = 1;
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
            engine.onResizeObservable.add(() => depthRenderer.getDepthMap().resize({
                width: engine.getRenderWidth(),
                height: engine.getRenderHeight()
            }));
        }

        return scene;
    }
}
