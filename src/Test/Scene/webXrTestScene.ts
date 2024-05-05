import "@babylonjs/core/Loading/loadingScreen";
import "@babylonjs/core/Meshes/thinInstanceMesh";
import "@babylonjs/core/Rendering/prePassRendererSceneComponent";
import "@babylonjs/core/Rendering/depthRendererSceneComponent";
import "@babylonjs/core/Rendering/geometryBufferRendererSceneComponent";
import "@babylonjs/core/Helpers/sceneHelpers";
import "@babylonjs/loaders/glTF/2.0/glTFLoader";
import "@babylonjs/core/Materials/Node/Blocks";
import "@babylonjs/core/XR/features/WebXRControllerMovement";
import "@babylonjs/core/Materials/Textures/Loaders/tgaTextureLoader";
import "@/Loader/Optimized/bpmxLoader";
import "@/Runtime/Animation/mmdRuntimeCameraAnimation";
import "@/Runtime/Animation/mmdRuntimeModelAnimation";

import type { AbstractEngine } from "@babylonjs/core/Engines/abstractEngine";
import { Constants } from "@babylonjs/core/Engines/constants";
import { SceneLoader } from "@babylonjs/core/Loading/sceneLoader";
import { ImageProcessingConfiguration } from "@babylonjs/core/Materials/imageProcessingConfiguration";
import { Color3, Color4 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { HavokPlugin } from "@babylonjs/core/Physics/v2/Plugins/havokPlugin";
import { DepthOfFieldEffectBlurLevel } from "@babylonjs/core/PostProcesses/depthOfFieldEffect";
import { DefaultRenderingPipeline } from "@babylonjs/core/PostProcesses/RenderPipeline/Pipelines/defaultRenderingPipeline";
import { Scene } from "@babylonjs/core/scene";
import { WebXRFeatureName } from "@babylonjs/core/XR/webXRFeaturesManager";
import havokPhysics from "@babylonjs/havok";

import type { MmdAnimation } from "@/Loader/Animation/mmdAnimation";
import type { MmdStandardMaterial } from "@/Loader/mmdStandardMaterial";
import type { MmdStandardMaterialBuilder } from "@/Loader/mmdStandardMaterialBuilder";
import type { BpmxLoader } from "@/Loader/Optimized/bpmxLoader";
import { BvmdLoader } from "@/Loader/Optimized/bvmdLoader";
import { SdefInjector } from "@/Loader/sdefInjector";
import { StreamAudioPlayer } from "@/Runtime/Audio/streamAudioPlayer";
import { MmdCamera } from "@/Runtime/mmdCamera";
import type { MmdMesh } from "@/Runtime/mmdMesh";
import { MmdPhysics } from "@/Runtime/mmdPhysics";
import { MmdRuntime } from "@/Runtime/mmdRuntime";
import { MmdPlayerControl } from "@/Runtime/Util/mmdPlayerControl";

import type { ISceneBuilder } from "../baseRuntime";
import { attachToBone } from "../Util/attachToBone";
import { createCameraSwitch } from "../Util/createCameraSwitch";
import { createDefaultArcRotateCamera } from "../Util/createDefaultArcRotateCamera";
import { createLightComponents } from "../Util/createLightComponents";
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
        mmdCamera.minZ = 4;
        mmdCamera.maxZ = 400;
        mmdCamera.parent = mmdRoot;
        const camera = createDefaultArcRotateCamera(scene);
        camera.maxZ = 1000;
        camera.parent = mmdRoot;
        createCameraSwitch(scene, canvas, mmdCamera, camera);
        const { directionalLight, shadowGenerator } = createLightComponents(scene);
        shadowGenerator.transparencyShadow = true;

        const mmdRuntime = new MmdRuntime(scene, new MmdPhysics(scene));
        mmdRuntime.loggingEnabled = true;
        mmdRuntime.register(scene);

        mmdRuntime.playAnimation();

        const audioPlayer = new StreamAudioPlayer(scene);
        audioPlayer.preservesPitch = false;
        audioPlayer.source = "res/private_test/motion/intergalactia/INTERGALACTIA.mp3";
        mmdRuntime.setAudioPlayer(audioPlayer);

        const mmdPlayerControl = new MmdPlayerControl(scene, mmdRuntime, audioPlayer);
        mmdPlayerControl.showPlayerControl();

        const [
            mmdAnimation,
            modelMesh,
            stageMesh
        ] = await parallelLoadAsync(scene, [
            ["motion", (updateProgress): Promise<MmdAnimation> => {
                const bvmdLoader = new BvmdLoader(scene);
                bvmdLoader.loggingEnabled = true;
                return bvmdLoader.loadAsync("motion", "res/private_test/motion/intergalactia/intergalactia_ik.bvmd", updateProgress);
            }],
            ["model", (updateProgress): Promise<MmdMesh> => {
                pmxLoader.boundingBoxMargin = 60;
                return SceneLoader.ImportMeshAsync(
                    undefined,
                    "res/private_test/model/",
                    "muubu_miku.bpmx",
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
                    "舞踏会風ステージVer2_forcemerged.bpmx",
                    scene,
                    updateProgress
                ).then(result => result.meshes[0] as MmdMesh);
            }],
            ["physics", async(updateProgress): Promise<void> => {
                updateProgress({ lengthComputable: true, loaded: 0, total: 1 });
                const havokInstance = await havokPhysics();
                const havokPlugin = new HavokPlugin(true, havokInstance);
                scene.enablePhysics(new Vector3(0, -9.8 * 10, 0), havokPlugin);
                updateProgress({ lengthComputable: true, loaded: 1, total: 1 });
            }]
        ]);

        mmdRuntime.setManualAnimationDuration(mmdAnimation.endFrame);

        mmdRuntime.setCamera(mmdCamera);
        mmdCamera.addAnimation(mmdAnimation);
        mmdCamera.setAnimation("motion");

        {
            shadowGenerator.addShadowCaster(modelMesh);
            for (const mesh of modelMesh.metadata.meshes) mesh.receiveShadows = true;
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
            scene.onAfterRenderObservable.addOnce(() => optimizeScene(scene, { clearCachedVertexData: false }));
        }

        for (const mesh of stageMesh.metadata.meshes) {
            mesh.receiveShadows = true;

            const material = mesh.material as MmdStandardMaterial;
            material.ignoreDiffuseWhenToonTextureIsNull = false;
            material.toonTexture?.dispose();
            material.toonTexture = null;
            material.emissiveColor = new Color3(0.5, 0.5, 0.5);
        }
        stageMesh.parent = mmdRoot;

        const defaultPipeline = new DefaultRenderingPipeline("default", true, scene);
        defaultPipeline.samples = 4;
        defaultPipeline.bloomEnabled = false;
        defaultPipeline.chromaticAberrationEnabled = false;
        defaultPipeline.depthOfFieldEnabled = false;
        defaultPipeline.depthOfFieldBlurLevel = DepthOfFieldEffectBlurLevel.High;
        defaultPipeline.fxaaEnabled = false;
        defaultPipeline.imageProcessingEnabled = true;
        defaultPipeline.imageProcessing.toneMappingEnabled = true;
        defaultPipeline.imageProcessing.toneMappingType = ImageProcessingConfiguration.TONEMAPPING_ACES;
        defaultPipeline.imageProcessing.vignetteWeight = 0.5;
        defaultPipeline.imageProcessing.vignetteStretch = 0.5;
        defaultPipeline.imageProcessing.vignetteColor = new Color4(0, 0, 0, 0);
        defaultPipeline.imageProcessing.vignetteEnabled = false;

        for (const mesh of modelMesh.metadata.meshes) {
            const material = mesh.material as MmdStandardMaterial;
            if (material.name === "Hairshadow") {
                material.alphaMode = Constants.ALPHA_SUBTRACT;
            }
        }

        const xr = await scene.createDefaultXRExperienceAsync({
            outputCanvasOptions: {
                canvasOptions: {
                    framebufferScaleFactor: 1
                }
            },
            disableTeleportation: true
            // floorMeshes: [ground]
        });

        if (xr.baseExperience !== undefined) {
            const featuresManager = xr.baseExperience.featuresManager;
            featuresManager.enableFeature(WebXRFeatureName.MOVEMENT, "latest", {
                movementThreshold: 0.7,
                rotationThreshold: 0.7,
                movementSpeed: 1,
                rotationSpeed: 0.2,
                xrInput: xr.input
            });

            xr.baseExperience.sessionManager.onXRFrameObservable.addOnce(() => {
                defaultPipeline.addCamera(xr.baseExperience.camera);
            });
            xr.baseExperience.sessionManager.worldScalingFactor = 9;

            xr.baseExperience.camera.minZ = 1;
            xr.baseExperience.camera.maxZ = 70;
        }

        return scene;
    }
}
