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

import { ArcRotateCamera } from "@babylonjs/core/Cameras/arcRotateCamera";
import { Constants } from "@babylonjs/core/Engines/constants";
import type { Engine } from "@babylonjs/core/Engines/engine";
import { SceneLoader } from "@babylonjs/core/Loading/sceneLoader";
import { ImageProcessingConfiguration } from "@babylonjs/core/Materials/imageProcessingConfiguration";
import type { MultiMaterial } from "@babylonjs/core/Materials/multiMaterial";
import { Color4 } from "@babylonjs/core/Maths/math.color";
import { Matrix, Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { Mesh } from "@babylonjs/core/Meshes/mesh";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { HavokPlugin } from "@babylonjs/core/Physics/v2/Plugins/havokPlugin";
import { DepthOfFieldEffectBlurLevel } from "@babylonjs/core/PostProcesses/depthOfFieldEffect";
import { DefaultRenderingPipeline } from "@babylonjs/core/PostProcesses/RenderPipeline/Pipelines/defaultRenderingPipeline";
import { Scene } from "@babylonjs/core/scene";
import { WebXRFeatureName } from "@babylonjs/core/XR/webXRFeaturesManager";
import HavokPhysics from "@babylonjs/havok";

import type { MmdAnimation } from "@/Loader/Animation/mmdAnimation";
import type { MmdStandardMaterial } from "@/Loader/mmdStandardMaterial";
import type { MmdStandardMaterialBuilder } from "@/Loader/mmdStandardMaterialBuilder";
import type { BpmxLoader } from "@/Loader/Optimized/bpmxLoader";
import { BvmdLoader } from "@/Loader/Optimized/bvmdLoader";
import { SdefInjector } from "@/Loader/sdefInjector";
import { StreamAudioPlayer } from "@/Runtime/Audio/streamAudioPlayer";
import { MmdCamera } from "@/Runtime/mmdCamera";
import { MmdPhysics } from "@/Runtime/mmdPhysics";
import { MmdRuntime } from "@/Runtime/mmdRuntime";
import { MmdPlayerControl } from "@/Runtime/Util/mmdPlayerControl";

import type { ISceneBuilder } from "../baseRuntime";
import { createLightComponents } from "../Util/createLightComponents";
import { optimizeScene } from "../Util/optimizeScene";

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

        const worldScale = 0.09;

        const mmdRoot = new TransformNode("mmdRoot", scene);
        mmdRoot.scaling.scaleInPlace(worldScale);

        const mmdCamera = new MmdCamera("mmdCamera", new Vector3(0, 10, 0), scene);
        mmdCamera.maxZ = 5000;
        mmdCamera.parent = mmdRoot;

        const camera = new ArcRotateCamera("arcRotateCamera", 0, 0, 45, new Vector3(0, 10, 0), scene);
        camera.maxZ = 5000;
        camera.setPosition(new Vector3(0, 10, -45));
        camera.attachControl(canvas, false);
        camera.inertia = 0.8;
        camera.speed = 10;
        camera.parent = mmdRoot;

        const { directionalLight, shadowGenerator } = createLightComponents(scene, { worldScale });

        const mmdRuntime = new MmdRuntime(new MmdPhysics(scene));
        mmdRuntime.loggingEnabled = true;

        mmdRuntime.register(scene);
        mmdRuntime.playAnimation();

        const audioPlayer = new StreamAudioPlayer(scene);
        audioPlayer.preservesPitch = false;
        audioPlayer.source = "res/private_test/motion/intergalactia/INTERGALACTIA.mp3";
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

        promises.push(bvmdLoader.loadAsync("motion", "res/private_test/motion/intergalactia/intergalactia_ik.bvmd",
            (event) => updateLoadingText(0, `Loading motion... ${event.loaded}/${event.total} (${Math.floor(event.loaded * 100 / event.total)}%)`))
        );

        pmxLoader.boundingBoxMargin = 60;
        promises.push(SceneLoader.ImportMeshAsync(
            undefined,
            "res/private_test/model/",
            "muubu_miku.bpmx",
            scene,
            (event) => updateLoadingText(1, `Loading model... ${event.loaded}/${event.total} (${Math.floor(event.loaded * 100 / event.total)}%)`)
        ));

        pmxLoader.boundingBoxMargin = 0;
        pmxLoader.buildSkeleton = false;
        pmxLoader.buildMorph = false;
        promises.push(SceneLoader.ImportMeshAsync(
            undefined,
            "res/private_test/stage/",
            "舞踏会風ステージVer2_forcemerged.bpmx",
            scene,
            (event) => updateLoadingText(2, `Loading stage... ${event.loaded}/${event.total} (${Math.floor(event.loaded * 100 / event.total)}%)`)
        ));

        promises.push((async(): Promise<void> => {
            updateLoadingText(3, "Loading physics engine...");
            const havokInstance = await HavokPhysics();
            const havokPlugin = new HavokPlugin(true, havokInstance);
            scene.enablePhysics(new Vector3(0, -9.8 * 10 * worldScale, 0), havokPlugin);
            updateLoadingText(3, "Loading physics engine... Done");
        })());

        loadingTexts = new Array(promises.length).fill("");
        const loadResults = await Promise.all(promises);

        mmdRuntime.setManualAnimationDuration((loadResults[0] as MmdAnimation).endFrame);

        scene.onAfterRenderObservable.addOnce(() => engine.hideLoadingUI());

        mmdRuntime.setCamera(mmdCamera);
        mmdCamera.addAnimation(loadResults[0] as MmdAnimation);
        mmdCamera.setAnimation("motion");

        {
            const modelMesh = loadResults[1].meshes[0] as Mesh;
            shadowGenerator.addShadowCaster(modelMesh);
            modelMesh.receiveShadows = true;
            modelMesh.parent = mmdRoot;

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
                directionalLight.position.y -= 10 * worldScale;

                camera.target.copyFrom(directionalLight.position);
                camera.target.y += 13 * worldScale;
            });

            scene.onAfterRenderObservable.addOnce(() => optimizeScene(scene));
        }

        const stageMesh = loadResults[2].meshes[0] as Mesh;
        stageMesh.receiveShadows = true;
        stageMesh.parent = mmdRoot;

        const defaultPipeline = new DefaultRenderingPipeline("default", true, scene, [mmdCamera, camera]);
        defaultPipeline.samples = 4;
        defaultPipeline.bloomEnabled = false;
        defaultPipeline.chromaticAberrationEnabled = false;
        defaultPipeline.depthOfFieldEnabled = false;
        defaultPipeline.depthOfFieldBlurLevel = DepthOfFieldEffectBlurLevel.High;
        defaultPipeline.fxaaEnabled = false;
        defaultPipeline.imageProcessingEnabled = true;
        defaultPipeline.imageProcessing.toneMappingEnabled = false;
        defaultPipeline.imageProcessing.toneMappingType = ImageProcessingConfiguration.TONEMAPPING_ACES;
        defaultPipeline.imageProcessing.vignetteWeight = 0.5;
        defaultPipeline.imageProcessing.vignetteStretch = 0.5;
        defaultPipeline.imageProcessing.vignetteColor = new Color4(0, 0, 0, 0);
        defaultPipeline.imageProcessing.vignetteEnabled = false;

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
                scene.activeCamera = camera;
            } else {
                scene.activeCamera = mmdCamera;
            }
        };

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
                movementSpeed: 0.1,
                rotationSpeed: 0.3,
                xrInput: xr.input
            });

            xr.baseExperience.sessionManager.onXRFrameObservable.addOnce(() => {
                defaultPipeline.addCamera(xr.baseExperience.camera);
            });
        }


        return scene;
    }
}
