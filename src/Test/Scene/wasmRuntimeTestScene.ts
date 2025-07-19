import "@babylonjs/core/Loading/loadingScreen";
import "@babylonjs/core/Rendering/depthRendererSceneComponent";
import "@/Loader/Optimized/bpmxLoader";
import "@/Runtime/Animation/mmdRuntimeCameraAnimation";
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
import { MmdWasmInstanceTypeMD } from "@/Runtime/Optimized/InstanceType/multiDebug";
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
        const { directionalLight, shadowGenerator } = CreateLightComponents(scene);
        shadowGenerator.transparencyShadow = true;

        const audioPlayer = new StreamAudioPlayer(scene);
        audioPlayer.preservesPitch = false;
        audioPlayer.source = "res/private_test/motion/flos/flos - R Sound Design (Piano Cover).mp3";

        const materialBuilder = new MmdStandardMaterialBuilder();
        materialBuilder.loadOutlineRenderingProperties = (): void => { /* do nothing */ };

        const [
            mmdRuntime,
            mmdAnimation,
            modelMesh,
            stageMesh
        ] = await ParallelLoadAsync(scene, [
            ["runtime", async(updateProgress): Promise<MmdWasmRuntime> => {
                updateProgress({ lengthComputable: true, loaded: 0, total: 1 });
                const mmdWasmInstance = await GetMmdWasmInstance(new MmdWasmInstanceTypeMD());
                updateProgress({ lengthComputable: true, loaded: 1, total: 1 });

                const mmdRuntime = new MmdWasmRuntime(mmdWasmInstance, scene, new MmdAmmoPhysics(scene));
                mmdRuntime.loggingEnabled = true;
                mmdRuntime.evaluationType = MmdWasmRuntimeAnimationEvaluationType.Immediate;

                mmdRuntime.setAudioPlayer(audioPlayer);

                const mmdPlayerControl = new MmdPlayerControl(scene, mmdRuntime, audioPlayer);
                mmdPlayerControl.showPlayerControl();

                mmdRuntime.register(scene);
                mmdRuntime.playAnimation();

                return mmdRuntime;
            }],
            ["motion", (updateProgress): Promise<MmdAnimation> => {
                const bvmdLoader = new BvmdLoader(scene);
                bvmdLoader.loggingEnabled = true;
                return bvmdLoader.loadAsync("motion", "res/private_test/motion/flos/motion.bvmd", updateProgress);
            }],
            ["model", (updateProgress): Promise<MmdMesh> => LoadAssetContainerAsync(
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

        mmdRuntime.addAnimatable(mmdCamera);
        const cameraAnimationHandle = mmdCamera.createRuntimeAnimation(mmdAnimation);
        mmdCamera.setRuntimeAnimation(cameraAnimationHandle);

        for (const mesh of modelMesh.metadata.meshes) {
            mesh.receiveShadows = true;
            shadowGenerator.addShadowCaster(mesh, false);
        }
        modelMesh.parent = mmdRoot;

        const mmdModel = mmdRuntime.createMmdModel(modelMesh, {
            buildPhysics: true
        });
        const modelRuntimeAnimationHandle = mmdModel.createRuntimeAnimation(mmdAnimation);
        mmdModel.setRuntimeAnimation(modelRuntimeAnimationHandle);

        AttachToBone(scene, mmdModel, {
            directionalLightPosition: directionalLight.position,
            cameraTargetPosition: camera.target
        });
        scene.onAfterRenderObservable.addOnce(() => OptimizeScene(scene));

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
