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
import type { Mesh } from "@babylonjs/core/Meshes/mesh";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { HavokPlugin } from "@babylonjs/core/Physics/v2/Plugins/havokPlugin";
import { DepthOfFieldEffectBlurLevel } from "@babylonjs/core/PostProcesses/depthOfFieldEffect";
import { DefaultRenderingPipeline } from "@babylonjs/core/PostProcesses/RenderPipeline/Pipelines/defaultRenderingPipeline";
import { Scene } from "@babylonjs/core/scene";
import havokPhysics from "@babylonjs/havok";

import type { MmdAnimation } from "@/Loader/Animation/mmdAnimation";
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

        const mmdRuntime = new MmdRuntime(scene, new MmdPhysics(scene));
        mmdRuntime.loggingEnabled = true;

        mmdRuntime.register(scene);
        mmdRuntime.playAnimation();

        const audioPlayer = new StreamAudioPlayer(scene);
        audioPlayer.preservesPitch = false;
        audioPlayer.source = "res/private_test/motion/flos/flos - R Sound Design (Piano Cover).mp3";
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
                ).then((result) => result.meshes[0] as MmdMesh);
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
                ).then((result) => result.meshes[0] as MmdMesh);
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

        for (const mesh of modelMesh.metadata.meshes) mesh.receiveShadows = true;
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

        // const viewer = new SkeletonViewer(modelMesh.metadata.skeleton, modelMesh, scene, false, 3, {
        //     displayMode: SkeletonViewer.DISPLAY_SPHERE_AND_SPURS
        // });

        for (const mesh of stageMesh.metadata.meshes) mesh.receiveShadows = true;
        stageMesh.position.y += 0.01;

        {
            // const physicsViewer = new PhysicsViewer(scene);
            // const modelMesh = loadResults[1].meshes[0] as Mesh;
            // for (const node of modelMesh.getChildren()) {
            //     if ((node as TransformNode).physicsBody) {
            //         physicsViewer.showBody((node as TransformNode).physicsBody);
            //     }
            // }
            // physicsViewer.showBody(groundRigidBody);
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

        for (const depthRenderer of Object.values(scene._depthRenderer)) {
            depthRenderer.forceDepthWriteTransparentMeshes = true;
        }

        return scene;
    }
}
