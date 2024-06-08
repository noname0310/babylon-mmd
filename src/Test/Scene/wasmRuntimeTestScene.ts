import "@babylonjs/core/Loading/loadingScreen";
import "@babylonjs/core/Rendering/depthRendererSceneComponent";
import "@/Loader/Optimized/bpmxLoader";
import "@/Runtime/Animation/mmdRuntimeCameraAnimation";
import "@/Runtime/Animation/mmdRuntimeModelAnimation";

import type { AbstractEngine } from "@babylonjs/core/Engines/abstractEngine";
import { SceneLoader } from "@babylonjs/core/Loading/sceneLoader";
import { ImageProcessingConfiguration } from "@babylonjs/core/Materials/imageProcessingConfiguration";
import { Color4 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { DepthOfFieldEffectBlurLevel } from "@babylonjs/core/PostProcesses/depthOfFieldEffect";
import { DefaultRenderingPipeline } from "@babylonjs/core/PostProcesses/RenderPipeline/Pipelines/defaultRenderingPipeline";
import { Scene } from "@babylonjs/core/scene";

import type { MmdAnimation } from "@/Loader/Animation/mmdAnimation";
import type { MmdStandardMaterialBuilder } from "@/Loader/mmdStandardMaterialBuilder";
import type { BpmxLoader } from "@/Loader/Optimized/bpmxLoader";
import { BvmdLoader } from "@/Loader/Optimized/bvmdLoader";
import { SdefInjector } from "@/Loader/sdefInjector";
import { StreamAudioPlayer } from "@/Runtime/Audio/streamAudioPlayer";
import { MmdCamera } from "@/Runtime/mmdCamera";
import type { MmdMesh } from "@/Runtime/mmdMesh";
import { MmdWasmInstanceTypeMD } from "@/Runtime/Optimized/InstanceType/multiDebug";
import { getMmdWasmInstance } from "@/Runtime/Optimized/mmdWasmInstance";
import { MmdWasmRuntime, MmdWasmRuntimeAnimationEvaluationType } from "@/Runtime/Optimized/mmdWasmRuntime";
import ammo from "@/Runtime/Physics/External/ammo.wasm";
import { MmdAmmoJSPlugin } from "@/Runtime/Physics/mmdAmmoJSPlugin";
import { MmdAmmoPhysics } from "@/Runtime/Physics/mmdAmmoPhysics";
import { MmdPlayerControl } from "@/Runtime/Util/mmdPlayerControl";

import type { ISceneBuilder } from "../baseRuntime";
import { attachToBone } from "../Util/attachToBone";
import { createCameraSwitch } from "../Util/createCameraSwitch";
import { createDefaultArcRotateCamera } from "../Util/createDefaultArcRotateCamera";
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
        materialBuilder.loadOutlineRenderingProperties = (): void => { /* do nothing */ };

        const scene = new Scene(engine);
        scene.clearColor = new Color4(0.95, 0.95, 0.95, 1.0);
        const mmdRoot = new TransformNode("mmdRoot", scene);
        const mmdCamera = new MmdCamera("mmdCamera", new Vector3(0, 10, 0), scene);
        mmdCamera.maxZ = 5000;
        mmdCamera.parent = mmdRoot;
        const camera = createDefaultArcRotateCamera(scene);
        createCameraSwitch(scene, canvas, mmdCamera, camera);
        const { directionalLight, shadowGenerator } = createLightComponents(scene);
        shadowGenerator.transparencyShadow = true;

        const audioPlayer = new StreamAudioPlayer(scene);
        audioPlayer.preservesPitch = false;
        audioPlayer.source = "res/private_test/motion/flos/flos - R Sound Design (Piano Cover).mp3";

        const [
            mmdRuntime,
            mmdAnimation,
            modelMesh,
            stageMesh
        ] = await parallelLoadAsync(scene, [
            ["runtime", async(updateProgress): Promise<MmdWasmRuntime> => {
                updateProgress({ lengthComputable: true, loaded: 0, total: 1 });
                const mmdWasmInstance = await getMmdWasmInstance(new MmdWasmInstanceTypeMD());
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
            ["model", (updateProgress): Promise<MmdMesh> => {
                pmxLoader.boundingBoxMargin = 60;
                return SceneLoader.ImportMeshAsync(
                    undefined,
                    "res/private_test/model/",
                    "yyb_deep_canyons_miku.bpmx",
                    scene,
                    updateProgress
                ).then(result => result.meshes[0] as MmdMesh);
            }],
            ["stage", (updateProgress): Promise<MmdMesh> => {
                pmxLoader.boundingBoxMargin = 0;
                pmxLoader.buildSkeleton = false;
                pmxLoader.buildMorph = false;
                return SceneLoader.ImportMeshAsync(
                    undefined,
                    "res/private_test/stage/",
                    "water house.bpmx",
                    scene,
                    updateProgress
                ).then(result => result.meshes[0] as MmdMesh);
            }],
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

        for (const mesh of modelMesh.metadata.meshes) {
            mesh.receiveShadows = true;
            shadowGenerator.addShadowCaster(mesh, false);
        }
        modelMesh.parent = mmdRoot;

        const mmdModel = mmdRuntime.createMmdModel(modelMesh, {
            buildPhysics: true
        });
        mmdModel.addAnimation(mmdAnimation);
        mmdModel.setAnimation("motion");

        attachToBone(scene, mmdModel, {
            directionalLightPosition: directionalLight.position,
            cameraTargetPosition: camera.target
        });
        scene.onAfterRenderObservable.addOnce(() => optimizeScene(scene));

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
        }

        return scene;
    }
}
