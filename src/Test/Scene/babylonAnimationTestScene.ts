import { RegisterAnimatable } from "@babylonjs/core/Animations/animatable.pure";
import { SkeletonViewer } from "@babylonjs/core/Debug/skeletonViewer";
import type { AbstractEngine } from "@babylonjs/core/Engines/abstractEngine.pure";
import { LoadAssetContainerAsync } from "@babylonjs/core/Loading/sceneLoader";
import { ImageProcessingConfiguration } from "@babylonjs/core/Materials/imageProcessingConfiguration.pure";
import { Color4 } from "@babylonjs/core/Maths/math.color.pure";
import { Vector3 } from "@babylonjs/core/Maths/math.vector.pure";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode.pure";
import { SetMissingSideEffectWarningsEnabled } from "@babylonjs/core/Misc/devTools";
import { RegisterJoinedPhysicsEngineComponent } from "@babylonjs/core/Physics/joinedPhysicsEngineComponent.pure";
import { HavokPlugin } from "@babylonjs/core/Physics/v2/Plugins/havokPlugin";
import { DepthOfFieldEffectBlurLevel } from "@babylonjs/core/PostProcesses/depthOfFieldEffect";
import { DefaultRenderingPipeline } from "@babylonjs/core/PostProcesses/RenderPipeline/Pipelines/defaultRenderingPipeline.pure";
import { Scene } from "@babylonjs/core/scene.pure";
import havokPhysics from "@babylonjs/havok";
import { ShowInspector } from "@babylonjs/inspector";

import type { MmdAnimation } from "@/Loader/Animation/mmdAnimation";
import { MmdCameraAnimationContainer, MmdCameraAnimationContainerBezierBuilder } from "@/Loader/Animation/mmdCameraAnimationContainer";
import { MmdModelAnimationContainer, MmdModelAnimationContainerBezierBuilder } from "@/Loader/Animation/mmdModelAnimationContainer";
import { MmdStandardMaterialBuilder } from "@/Loader/mmdStandardMaterialBuilder";
import { RegisterBpmxLoader } from "@/Loader/Optimized/bpmxLoader.pure";
import { BvmdLoader } from "@/Loader/Optimized/bvmdLoader";
import { SdefInjector } from "@/Loader/sdefInjector";
import { RegisterMmdRuntimeCameraAnimationContainer } from "@/Runtime/Animation/mmdRuntimeCameraAnimationContainer.pure";
import { RegisterMmdRuntimeModelAnimationContainer } from "@/Runtime/Animation/mmdRuntimeModelAnimationContainer.pure";
import { StreamAudioPlayer } from "@/Runtime/Audio/streamAudioPlayer";
import { MmdCamera, RegisterMmdCamera } from "@/Runtime/mmdCamera.pure";
import type { MmdMesh } from "@/Runtime/mmdMesh";
import { MmdRuntime } from "@/Runtime/mmdRuntime";
import { MmdPhysics } from "@/Runtime/Physics/mmdPhysics";
import { MmdPlayerControl } from "@/Runtime/Util/mmdPlayerControl";

import type { ISceneBuilder } from "../baseRuntime";
import { AttachToBone } from "../Util/attachToBone";
import { CreateCameraSwitch } from "../Util/createCameraSwitch";
import { CreateDefaultArcRotateCamera } from "../Util/createDefaultArcRotateCamera";
import { CreateLightComponents } from "../Util/createLightComponents";
import { MmdCameraAutoFocus } from "../Util/mmdCameraAutoFocus";
import { ParallelLoadAsync } from "../Util/parallelLoadAsync";

export class SceneBuilder implements ISceneBuilder {
    public async buildAsync(canvas: HTMLCanvasElement, engine: AbstractEngine): Promise<Scene> {
        SetMissingSideEffectWarningsEnabled(true);
        RegisterAnimatable();
        RegisterJoinedPhysicsEngineComponent();
        RegisterBpmxLoader();
        RegisterMmdRuntimeCameraAnimationContainer();
        RegisterMmdRuntimeModelAnimationContainer();
        RegisterMmdCamera();
        SdefInjector.OverrideEngineCreateEffect(engine);

        const scene = new Scene(engine);
        scene.clearColor = new Color4(0.95, 0.95, 0.95, 1.0);
        const mmdRoot = new TransformNode("mmdRoot", scene);
        const mmdCamera = new MmdCamera("mmdCamera", new Vector3(0, 10, 0), scene);
        mmdCamera.maxZ = 5000;
        mmdCamera.parent = mmdRoot;
        const camera = CreateDefaultArcRotateCamera(scene);
        CreateCameraSwitch(scene, canvas, camera, mmdCamera);
        const { directionalLight, shadowGenerator } = CreateLightComponents(scene);
        shadowGenerator.transparencyShadow = true;

        const mmdRuntime = new MmdRuntime(scene, new MmdPhysics(scene));
        mmdRuntime.loggingEnabled = true;

        mmdRuntime.register(scene);

        const audioPlayer = new StreamAudioPlayer(scene);
        audioPlayer.preservesPitch = false;
        audioPlayer.source = "res/private_test/motion/flos/flos_YuNi.mp3";

        const mmdPlayerControl = new MmdPlayerControl(scene, mmdRuntime, audioPlayer);
        mmdPlayerControl.showPlayerControl();

        const materialBuilder = new MmdStandardMaterialBuilder();
        materialBuilder.loadOutlineRenderingProperties = (): void => { /* do nothing */ };

        const [
            mmdAnimation,
            modelMesh,
            stageMesh
        ] = await ParallelLoadAsync(scene, [
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
                const havokInstance = await havokPhysics();
                const havokPlugin = new HavokPlugin(true, havokInstance);
                scene.enablePhysics(new Vector3(0, -9.8 * 10, 0), havokPlugin);
                updateProgress({ lengthComputable: true, loaded: 1, total: 1 });
            }]
        ]);

        for (const mesh of modelMesh.metadata.meshes) {
            mesh.receiveShadows = true;
            shadowGenerator.addShadowCaster(mesh, false);
        }
        modelMesh.parent = mmdRoot;

        const mmdModel = mmdRuntime.createMmdModel(modelMesh, {
            buildPhysics: true
        });

        const mmdModelAnimationContainer = new MmdModelAnimationContainer(mmdAnimation, new MmdModelAnimationContainerBezierBuilder());
        const mmdCameraAnimationContainer = new MmdCameraAnimationContainer(mmdAnimation, new MmdCameraAnimationContainerBezierBuilder());

        mmdModelAnimationContainer.createAnimationGroup(mmdModel).play();
        mmdCameraAnimationContainer.createAnimationGroup(mmdCamera).play();
        audioPlayer.play();

        ShowInspector(scene, { });

        {
            AttachToBone(scene, mmdModel, {
                directionalLightPosition: directionalLight.position,
                cameraTargetPosition: camera.target
            });

            const viewer = new SkeletonViewer(modelMesh.metadata.skeleton!, modelMesh, scene, false, 3, {
                displayMode: SkeletonViewer.DISPLAY_SPHERE_AND_SPURS
            });
            viewer.isEnabled = false;
        }

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
