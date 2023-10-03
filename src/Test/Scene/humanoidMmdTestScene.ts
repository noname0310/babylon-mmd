import "@babylonjs/core/Loading/loadingScreen";
import "@babylonjs/core/Rendering/prePassRendererSceneComponent";
import "@babylonjs/core/Rendering/depthRendererSceneComponent";
import "@babylonjs/core/Rendering/geometryBufferRendererSceneComponent";
import "@babylonjs/loaders/glTF/2.0/glTFLoader";
import "@/Loader/Optimized/bpmxLoader";
import "@/Runtime/Animation/mmdRuntimeCameraAnimation";
import "@/Runtime/Animation/mmdRuntimeModelAnimation";

import { Constants } from "@babylonjs/core/Engines/constants";
import type { Engine } from "@babylonjs/core/Engines/engine";
import type { ISceneLoaderAsyncResult } from "@babylonjs/core/Loading/sceneLoader";
import { SceneLoader } from "@babylonjs/core/Loading/sceneLoader";
import { ImageProcessingConfiguration } from "@babylonjs/core/Materials/imageProcessingConfiguration";
import type { PBRMaterial } from "@babylonjs/core/Materials/PBR/pbrMaterial";
import { Color3, Color4 } from "@babylonjs/core/Maths/math.color";
import { Quaternion, Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { Mesh } from "@babylonjs/core/Meshes/mesh";
import { DepthOfFieldEffectBlurLevel } from "@babylonjs/core/PostProcesses/depthOfFieldEffect";
import { DefaultRenderingPipeline } from "@babylonjs/core/PostProcesses/RenderPipeline/Pipelines/defaultRenderingPipeline";
import { SSRRenderingPipeline } from "@babylonjs/core/PostProcesses/RenderPipeline/Pipelines/ssrRenderingPipeline";
import { Scene } from "@babylonjs/core/scene";

import type { MmdAnimation } from "@/Loader/Animation/mmdAnimation";
import type { MmdStandardMaterialBuilder } from "@/Loader/mmdStandardMaterialBuilder";
import type { BpmxLoader } from "@/Loader/Optimized/bpmxLoader";
import { BvmdLoader } from "@/Loader/Optimized/bvmdLoader";
import { MmdHumanoidMapper } from "@/Loader/Util/mmdHumanoidMapper";
import { StreamAudioPlayer } from "@/Runtime/Audio/streamAudioPlayer";
import { MmdCamera } from "@/Runtime/mmdCamera";
import { MmdRuntime } from "@/Runtime/mmdRuntime";
import { HumanoidMmd } from "@/Runtime/Util/humanoidMmd";
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
    public async build(canvas: HTMLCanvasElement, engine: Engine): Promise<Scene> {
        const pmxLoader = SceneLoader.GetPluginForExtension(".bpmx") as BpmxLoader;
        pmxLoader.loggingEnabled = true;
        const materialBuilder = pmxLoader.materialBuilder as MmdStandardMaterialBuilder;
        materialBuilder.loadOutlineRenderingProperties = (): void => { /* do nothing */ };

        const scene = new Scene(engine);
        scene.clearColor = new Color4(0.95, 0.95, 0.95, 1.0);
        scene.autoClear = false;

        const mmdCamera = new MmdCamera("mmdCamera", new Vector3(0, 10, 0), scene);
        mmdCamera.maxZ = 5000;
        const camera = createDefaultArcRotateCamera(scene);
        createCameraSwitch(scene, canvas, mmdCamera, camera);
        const { directionalLight, shadowGenerator } = createLightComponents(scene);
        createDefaultGround(scene);

        const mmdRuntime = new MmdRuntime();
        mmdRuntime.loggingEnabled = true;
        mmdRuntime.register(scene);

        mmdRuntime.playAnimation();

        const audioPlayer = new StreamAudioPlayer(scene);
        audioPlayer.preservesPitch = false;
        audioPlayer.source = "res/private_test/motion/patchwork_staccato/pv_912.mp3";
        mmdRuntime.setAudioPlayer(audioPlayer);

        const mmdPlayerControl = new MmdPlayerControl(scene, mmdRuntime, audioPlayer);
        mmdPlayerControl.showPlayerControl();

        const loadResults = await parallelLoadAsync(scene, [
            ["motion", (updateProgress): Promise<MmdAnimation> => {
                const bvmdLoader = new BvmdLoader(scene);
                bvmdLoader.loggingEnabled = true;
                return bvmdLoader.loadAsync("motion", "res/private_test/motion/patchwork_staccato/motion_nonphys.bvmd", updateProgress);
            }],
            ["model", (updateProgress): Promise<ISceneLoaderAsyncResult> => {
                return SceneLoader.ImportMeshAsync(
                    undefined,
                    "res/private_test/model/",
                    "Moe.glb",
                    scene,
                    updateProgress
                );
            }],
            ["stage", (updateProgress): Promise<ISceneLoaderAsyncResult> => {
                pmxLoader.boundingBoxMargin = 0;
                pmxLoader.buildSkeleton = false;
                pmxLoader.buildMorph = false;
                return SceneLoader.ImportMeshAsync(
                    undefined,
                    "res/private_test/stage/",
                    "Stage35_02.bpmx",
                    scene,
                    updateProgress
                );
            }]
        ]);

        mmdRuntime.setManualAnimationDuration((loadResults[0] as MmdAnimation).endFrame);

        mmdRuntime.setCamera(mmdCamera);
        mmdCamera.addAnimation(loadResults[0] as MmdAnimation);
        mmdCamera.setAnimation("motion");

        loadResults[1].meshes[0].rotationQuaternion!.set(0, 0, 0, 1);
        loadResults[1].meshes[0].scaling.scaleInPlace(14);
        for (const mesh of loadResults[1].meshes as Mesh[]) {
            const boundingInfo = mesh.getBoundingInfo();
            const subMeshes = mesh.subMeshes;
            if (subMeshes !== undefined) {
                for (let i = 0; i < subMeshes.length; i++) {
                    const subMesh = subMeshes[i];
                    subMesh.setBoundingInfo(boundingInfo);
                }
            }

            if (mesh.material === null) continue;
            shadowGenerator.addShadowCaster(mesh);
            mesh.receiveShadows = true;
            mesh.alwaysSelectAsActiveMesh = true;
            const material = mesh.material as PBRMaterial;
            material.albedoColor = new Color3(1, 1, 1);
            material.emissiveColor.set(0, 0, 0);
            material.albedoTexture = material.emissiveTexture;
            material.metallic = 0;
        }
        const modelMesh = loadResults[1].meshes[1] as Mesh;
        {
            const transformNodes = loadResults[1].transformNodes;
            const leftArm = transformNodes.find((transformNode) => transformNode.name === "Left arm")!;
            const rightArm = transformNodes.find((transformNode) => transformNode.name === "Right arm")!;
            const degToRad = Math.PI / 180;
            leftArm.rotationQuaternion = Quaternion.FromEulerAngles(-35 * degToRad, 0, 0);
            rightArm.rotationQuaternion = Quaternion.FromEulerAngles(-35 * degToRad, 0, 0);
        }

        const mmdModel = new HumanoidMmd().createMmdModelFromHumanoid(mmdRuntime, modelMesh, {
            boneMap: new MmdHumanoidMapper({
                hips: "Hips",
                spine: "Spine",
                chest: "Chest",
                neck: "Neck",
                head: "Head",
                leftShoulder: "Left shoulder",
                leftUpperArm: "Left arm",
                leftLowerArm: "Left elbow",
                leftHand: "Left wrist",
                rightShoulder: "Right shoulder",
                rightUpperArm: "Right arm",
                rightLowerArm: "Right elbow",
                rightHand: "Right wrist",
                leftUpperLeg: "Left leg",
                leftLowerLeg: "Left knee",
                leftFoot: "Left ankle",
                leftToes: "Left Toe",
                rightUpperLeg: "Right leg",
                rightLowerLeg: "Right knee",
                rightFoot: "Right ankle",
                rightToes: "Right Toe",

                leftEye: "Eye_L",
                rightEye: "Eye_R",

                leftThumbProximal: "Thumb_Proximal_L",
                leftThumbIntermediate: "Thumb_Intermediate_L",
                leftThumbDistal: "Thumb_Distal_L",
                leftIndexProximal: "Index_Proximal_L",
                leftIndexIntermediate: "Index_Intermediate_L",
                leftIndexDistal: "Index_Distal_L",
                leftMiddleProximal: "Middle_Proximal_L",
                leftMiddleIntermediate: "Middle_Intermediate_L",
                leftMiddleDistal: "Middle_Distal_L",
                leftRingProximal: "Ring_Proximal_L",
                leftRingIntermediate: "Ring_Intermediate_L",
                leftRingDistal: "Ring_Distal_L",
                leftLittleProximal: "Little_Proximal_L",
                leftLittleIntermediate: "Little_Intermediate_L",
                leftLittleDistal: "Little_Distal_L",

                rightThumbProximal: "Thumb_Proximal_R",
                rightThumbIntermediate: "Thumb_Intermediate_R",
                rightThumbDistal: "Thumb_Distal_R",
                rightIndexProximal: "Index_Proximal_R",
                rightIndexIntermediate: "Index_Intermediate_R",
                rightIndexDistal: "Index_Distal_R",
                rightMiddleProximal: "Middle_Proximal_R",
                rightMiddleIntermediate: "Middle_Intermediate_R",
                rightMiddleDistal: "Middle_Distal_R",
                rightRingProximal: "Ring_Proximal_R",
                rightRingIntermediate: "Ring_Intermediate_R",
                rightRingDistal: "Ring_Distal_R",
                rightLittleProximal: "Little_Proximal_R",
                rightLittleIntermediate: "Little_Intermediate_R",
                rightLittleDistal: "Little_Distal_R"
            }).boneMap,
            scale: 14,
            invertZ: true
        });
        mmdModel.morph.setMorphWeight("口_真顔", 0.9);
        mmdModel.addAnimation(loadResults[0] as MmdAnimation);
        mmdModel.setAnimation("motion");

        attachToBone(scene, modelMesh, {
            directionalLightPosition: directionalLight.position,
            cameraTargetPosition: camera.target,
            cameraTargetYpositionOffset: -3,
            centerBoneName: "Spine"
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
        mmdCameraAutoFocus.setTarget(modelMesh, "Head");
        mmdCameraAutoFocus.register(scene);

        return scene;
    }
}
