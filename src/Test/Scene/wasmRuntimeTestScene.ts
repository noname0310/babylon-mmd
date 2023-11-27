import "@babylonjs/core/Loading/loadingScreen";
import "@babylonjs/core/Rendering/depthRendererSceneComponent";
import "@/Loader/Optimized/bpmxLoader";
import "@/Runtime/Animation/mmdRuntimeCameraAnimation";
import "@/Runtime/Animation/mmdRuntimeModelAnimation";

import type { Engine } from "@babylonjs/core/Engines/engine";
import { SceneLoader } from "@babylonjs/core/Loading/sceneLoader";
import { ImageProcessingConfiguration } from "@babylonjs/core/Materials/imageProcessingConfiguration";
import { Color4 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { Mesh } from "@babylonjs/core/Meshes/mesh";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { DepthOfFieldEffectBlurLevel } from "@babylonjs/core/PostProcesses/depthOfFieldEffect";
import { DefaultRenderingPipeline } from "@babylonjs/core/PostProcesses/RenderPipeline/Pipelines/defaultRenderingPipeline";
import { Scene } from "@babylonjs/core/scene";

import type { MmdAnimation } from "@/Loader/Animation/mmdAnimation";
import type { MmdStandardMaterial } from "@/Loader/mmdStandardMaterial";
import type { MmdStandardMaterialBuilder } from "@/Loader/mmdStandardMaterialBuilder";
import type { BpmxLoader } from "@/Loader/Optimized/bpmxLoader";
import { BvmdLoader } from "@/Loader/Optimized/bvmdLoader";
import { SdefInjector } from "@/Loader/sdefInjector";
import { StreamAudioPlayer } from "@/Runtime/Audio/streamAudioPlayer";
import { MmdCamera } from "@/Runtime/mmdCamera";
import type { MmdMultiMaterial } from "@/Runtime/mmdMesh";
import type { MmdWasmInstance } from "@/Runtime/Optimized/mmdWasmInstance";
import { createMmdWasmInstance } from "@/Runtime/Optimized/mmdWasmInstance";
import { MmdWasmRuntime } from "@/Runtime/Optimized/mmdWasmRuntime";
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
    public async build(canvas: HTMLCanvasElement, engine: Engine): Promise<Scene> {
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

        const audioPlayer = new StreamAudioPlayer(scene);
        audioPlayer.preservesPitch = false;
        audioPlayer.source = "res/private_test/motion/flos/flos_YuNi.mp3";

        const [
            mmdAnimation,
            modelMesh,
            stageMesh,
            mmdWasmInstance
        ] = await parallelLoadAsync(scene, [
            ["motion", (updateProgress): Promise<MmdAnimation> => {
                const bvmdLoader = new BvmdLoader(scene);
                bvmdLoader.loggingEnabled = true;
                return bvmdLoader.loadAsync("motion", "res/private_test/motion/flos/motion.bvmd", updateProgress);
            }],
            ["model", (updateProgress): Promise<Mesh> => {
                pmxLoader.boundingBoxMargin = 60;
                return SceneLoader.ImportMeshAsync(
                    undefined,
                    "res/private_test/model/",
                    "yyb_deep_canyons_miku.bpmx",
                    scene,
                    updateProgress
                ).then(result => result.meshes[0] as Mesh);
            }],
            ["stage", (updateProgress): Promise<Mesh> => {
                pmxLoader.boundingBoxMargin = 0;
                pmxLoader.buildSkeleton = false;
                pmxLoader.buildMorph = false;
                return SceneLoader.ImportMeshAsync(
                    undefined,
                    "res/private_test/stage/",
                    "water house.bpmx",
                    scene,
                    updateProgress
                ).then(result => result.meshes[0] as Mesh);
            }],
            ["runtime", async(updateProgress): Promise<MmdWasmInstance> => {
                updateProgress({ lengthComputable: true, loaded: 0, total: 1 });
                const mmdWasmInstance = await createMmdWasmInstance();
                updateProgress({ lengthComputable: true, loaded: 1, total: 1 });
                return mmdWasmInstance;
            }]
        ]);

        const mmdRuntime = new MmdWasmRuntime(mmdWasmInstance);
        mmdRuntime.loggingEnabled = true;

        mmdRuntime.setAudioPlayer(audioPlayer);

        const mmdPlayerControl = new MmdPlayerControl(scene, mmdRuntime, audioPlayer);
        mmdPlayerControl.showPlayerControl();

        mmdRuntime.register(scene);
        mmdRuntime.playAnimation();

        mmdRuntime.setManualAnimationDuration(mmdAnimation.endFrame);

        mmdRuntime.setCamera(mmdCamera);
        mmdCamera.addAnimation(mmdAnimation);
        mmdCamera.setAnimation("motion");

        modelMesh.receiveShadows = true;
        shadowGenerator.addShadowCaster(modelMesh);
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

        stageMesh.receiveShadows = true;
        stageMesh.position.y += 0.01;
        const stageSubMaterials = (stageMesh!.material as MmdMultiMaterial).subMaterials;
        for (let i = 0; i < stageSubMaterials.length; ++i) {
            const material = (stageSubMaterials[i] as MmdStandardMaterial);
            material.ignoreDiffuseWhenToonTextureIsNull = false;
            material.toonTexture = null;
        }

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

        return scene;
    }
}
