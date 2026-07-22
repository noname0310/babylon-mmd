import type { AbstractEngine } from "@babylonjs/core/Engines/abstractEngine.pure";
import { LoadAssetContainerAsync } from "@babylonjs/core/Loading/sceneLoader";
import { ImageProcessingConfiguration } from "@babylonjs/core/Materials/imageProcessingConfiguration.pure";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial.pure";
import { MirrorTexture } from "@babylonjs/core/Materials/Textures/mirrorTexture.pure";
import { Color3, Color4 } from "@babylonjs/core/Maths/math.color.pure";
import { Plane } from "@babylonjs/core/Maths/math.plane";
import { Vector3 } from "@babylonjs/core/Maths/math.vector.pure";
import { CreateGround } from "@babylonjs/core/Meshes/Builders/groundBuilder.pure";
import { SetMissingSideEffectWarningsEnabled } from "@babylonjs/core/Misc/devTools";
import { DepthOfFieldEffectBlurLevel } from "@babylonjs/core/PostProcesses/depthOfFieldEffect";
import { DefaultRenderingPipeline } from "@babylonjs/core/PostProcesses/RenderPipeline/Pipelines/defaultRenderingPipeline.pure";
import { Scene } from "@babylonjs/core/scene.pure";

import type { MmdAnimation } from "@/Loader/Animation/mmdAnimation";
import { RegisterMmdOutlineRenderer } from "@/Loader/mmdOutlineRenderer.pure";
import { MmdStandardMaterialBuilder } from "@/Loader/mmdStandardMaterialBuilder";
import { RegisterBpmxLoader } from "@/Loader/Optimized/bpmxLoader.pure";
import { BvmdLoader } from "@/Loader/Optimized/bvmdLoader";
import { SdefInjector } from "@/Loader/sdefInjector";
import { RegisterMmdRuntimeCameraAnimation } from "@/Runtime/Animation/mmdRuntimeCameraAnimation.pure";
import { RegisterMmdRuntimeModelAnimation } from "@/Runtime/Animation/mmdRuntimeModelAnimation.pure";
import { StreamAudioPlayer } from "@/Runtime/Audio/streamAudioPlayer";
import { MmdCamera, RegisterMmdCamera } from "@/Runtime/mmdCamera.pure";
import type { MmdMesh } from "@/Runtime/mmdMesh";
import { MmdRuntime } from "@/Runtime/mmdRuntime";
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
        SetMissingSideEffectWarningsEnabled(true);
        RegisterBpmxLoader();
        RegisterMmdOutlineRenderer();
        RegisterMmdRuntimeCameraAnimation();
        RegisterMmdRuntimeModelAnimation();
        RegisterMmdCamera();
        SdefInjector.OverrideEngineCreateEffect(engine);

        const scene = new Scene(engine);
        scene.clearColor = new Color4(0.95, 0.95, 0.95, 1.0);
        scene.autoClear = false;
        scene.ambientColor.set(1.0, 1.0, 1.0);

        const mmdCamera = new MmdCamera("mmdCamera", new Vector3(0, 10, 0), scene);
        mmdCamera.maxZ = 5000;
        const camera = CreateDefaultArcRotateCamera(scene);
        CreateCameraSwitch(scene, canvas, mmdCamera, camera);
        const { directionalLight, shadowGenerator } = CreateLightComponents(scene);
        shadowGenerator.transparencyShadow = true;

        const mmdRuntime = new MmdRuntime(scene);
        mmdRuntime.loggingEnabled = true;
        mmdRuntime.register(scene);

        mmdRuntime.playAnimation();

        const audioPlayer = new StreamAudioPlayer(scene);
        audioPlayer.preservesPitch = false;
        audioPlayer.source = "res/private_test/motion/patchwork_staccato/pv_912.mp3";
        mmdRuntime.setAudioPlayer(audioPlayer);

        const mmdPlayerControl = new MmdPlayerControl(scene, mmdRuntime, audioPlayer);
        mmdPlayerControl.showPlayerControl();

        const materialBuilder = new MmdStandardMaterialBuilder();

        const [
            mmdAnimation,
            modelMesh,
            stageMesh
        ] = await ParallelLoadAsync(scene, [
            ["motion", (updateProgress): Promise<MmdAnimation> => {
                const bvmdLoader = new BvmdLoader(scene);
                bvmdLoader.loggingEnabled = true;
                return bvmdLoader.loadAsync("motion", "res/private_test/motion/patchwork_staccato/motion.bvmd", updateProgress);
            }],
            ["model", (updateProgress): Promise<MmdMesh> => LoadAssetContainerAsync(
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
            ["stage", (updateProgress): Promise<MmdMesh> => LoadAssetContainerAsync(
                "res/private_test/stage/Stage35_02_toonfix.bpmx",
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
            })]
        ]);

        mmdRuntime.setManualAnimationDuration(mmdAnimation.endFrame);

        mmdRuntime.addAnimatable(mmdCamera);
        const cameraAnimationHandle = mmdCamera.createRuntimeAnimation(mmdAnimation);
        mmdCamera.setRuntimeAnimation(cameraAnimationHandle);

        for (const mesh of modelMesh.metadata.meshes) {
            mesh.receiveShadows = true;
            shadowGenerator.addShadowCaster(mesh, false);
        }

        const mmdModel = mmdRuntime.createMmdModel(modelMesh, {
            buildPhysics: true
        });
        const modelRuntimeAnimationHandle = mmdModel.createRuntimeAnimation(mmdAnimation);
        mmdModel.setRuntimeAnimation(modelRuntimeAnimationHandle);

        AttachToBone(scene, mmdModel, {
            directionalLightPosition: directionalLight.position,
            cameraTargetPosition: camera.target
        });
        scene.onAfterRenderObservable.addOnce(() => OptimizeScene(scene, { clearCachedVertexData: false }));


        const ground = CreateGround("Ground", { width: 100, height: 100, subdivisions: 2, updatable: false }, scene);
        ground.receiveShadows = true;
        const groundMaterial = ground.material = new StandardMaterial("GroundMaterial", scene);
        groundMaterial.diffuseColor = new Color3(0.7, 0.7, 0.7);
        groundMaterial.specularPower = 128;
        const groundReflectionTexture = groundMaterial.reflectionTexture = new MirrorTexture("MirrorTexture", 1024, scene, true, undefined, undefined, true);
        groundReflectionTexture.mirrorPlane = Plane.FromPositionAndNormal(ground.position, ground.getFacetNormal(0).scale(-1));
        groundReflectionTexture.renderList = [...modelMesh.metadata.meshes, ...stageMesh.metadata.meshes];
        groundReflectionTexture.level = 0.45;

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
            engine.onResizeObservable.add(() => depthRenderer.getDepthMap().resize({
                width: engine.getRenderWidth(),
                height: engine.getRenderHeight()
            }));
        }

        return scene;
    }
}
