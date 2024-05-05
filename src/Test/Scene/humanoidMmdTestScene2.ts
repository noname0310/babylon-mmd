import "@babylonjs/core/Loading/loadingScreen";
import "@babylonjs/core/Rendering/prePassRendererSceneComponent";
import "@babylonjs/core/Rendering/depthRendererSceneComponent";
import "@babylonjs/core/Rendering/geometryBufferRendererSceneComponent";
import "@babylonjs/loaders/glTF/2.0/glTFLoader";
import "@/Loader/Optimized/bpmxLoader";
import "@/Runtime/Animation/mmdRuntimeCameraAnimation";
import "@/Runtime/Animation/mmdRuntimeModelAnimation";

import type { AbstractEngine } from "@babylonjs/core/Engines/abstractEngine";
import { Constants } from "@babylonjs/core/Engines/constants";
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
import { type MmdStandardMaterialBuilder, MmdStandardMaterialRenderMethod } from "@/Loader/mmdStandardMaterialBuilder";
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
    public async build(canvas: HTMLCanvasElement, engine: AbstractEngine): Promise<Scene> {
        const pmxLoader = SceneLoader.GetPluginForExtension(".bpmx") as BpmxLoader;
        pmxLoader.loggingEnabled = true;
        const materialBuilder = pmxLoader.materialBuilder as MmdStandardMaterialBuilder;
        materialBuilder.loadOutlineRenderingProperties = (): void => { /* do nothing */ };
        materialBuilder.renderMethod = MmdStandardMaterialRenderMethod.AlphaEvaluation;

        const scene = new Scene(engine);
        scene.clearColor = new Color4(0.95, 0.95, 0.95, 1.0);
        scene.autoClear = false;

        const mmdCamera = new MmdCamera("mmdCamera", new Vector3(0, 10, 0), scene);
        mmdCamera.maxZ = 5000;
        const camera = createDefaultArcRotateCamera(scene);
        createCameraSwitch(scene, canvas, mmdCamera, camera);
        const { directionalLight, shadowGenerator } = createLightComponents(scene);
        createDefaultGround(scene);

        const mmdRuntime = new MmdRuntime(scene);
        mmdRuntime.loggingEnabled = true;
        mmdRuntime.register(scene);

        mmdRuntime.playAnimation();

        const audioPlayer = new StreamAudioPlayer(scene);
        audioPlayer.preservesPitch = false;
        audioPlayer.source = "res/private_test/motion/105 degrees Celsius/Japanese Cover.mp3";
        mmdRuntime.setAudioPlayer(audioPlayer);

        const mmdPlayerControl = new MmdPlayerControl(scene, mmdRuntime, audioPlayer);
        mmdPlayerControl.showPlayerControl();

        const [
            mmdAnimation,
            modelLoadResult
        ] = await parallelLoadAsync(scene, [
            ["motion", (updateProgress): Promise<MmdAnimation> => {
                const bvmdLoader = new BvmdLoader(scene);
                bvmdLoader.loggingEnabled = true;
                return bvmdLoader.loadAsync("motion", "res/private_test/motion/105 degrees Celsius/motion.bvmd", updateProgress);
            }],
            ["model", (updateProgress): Promise<ISceneLoaderAsyncResult> => {
                return SceneLoader.ImportMeshAsync(
                    undefined,
                    "res/private_test/model/",
                    "Karin.glb",
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

        mmdRuntime.setManualAnimationDuration(mmdAnimation.endFrame);

        mmdRuntime.setCamera(mmdCamera);
        mmdCamera.addAnimation(mmdAnimation);
        mmdCamera.setAnimation("motion");

        const modelRoot = modelLoadResult.meshes[0] as Mesh;
        modelRoot.rotationQuaternion!.set(0, 0, 0, 1);
        modelRoot.scaling.scaleInPlace(0.143);
        const armature = modelLoadResult.transformNodes.find((transformNode) => transformNode.name === "Armature")!;
        armature.scaling.setAll(1);
        for (const mesh of modelLoadResult.meshes as Mesh[]) {
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
            material.metallic = 0;
        }
        const modelMesh = modelLoadResult.meshes[1] as Mesh;
        {
            const transformNodes = modelLoadResult.transformNodes;
            const leftArm = transformNodes.find((transformNode) => transformNode.name === "LeftUpperArm")!;
            const rightArm = transformNodes.find((transformNode) => transformNode.name === "RightUpperArm")!;
            const degToRad = Math.PI / 180;
            leftArm.rotationQuaternion = leftArm.rotationQuaternion!.multiply(Quaternion.FromEulerAngles(0, 0, -35 * degToRad));
            rightArm.rotationQuaternion = rightArm.rotationQuaternion!.multiply(Quaternion.FromEulerAngles(0, 0, 35 * degToRad));
        }

        const mmdModel = new HumanoidMmd().createMmdModelFromHumanoid(
            mmdRuntime,
            modelRoot,
            [modelMesh],
            {
                boneMap: new MmdHumanoidMapper({
                    hips: "Hips",
                    spine: "Spine",
                    chest: "Chest",
                    neck: "Neck",
                    head: "Head",
                    leftShoulder: "LeftShoulder",
                    leftUpperArm: "LeftUpperArm",
                    leftLowerArm: "LeftLowerArm",
                    leftHand: "LeftHand",
                    rightShoulder: "RightShoulder",
                    rightUpperArm: "RightUpperArm",
                    rightLowerArm: "RightLowerArm",
                    rightHand: "RightHand",
                    leftUpperLeg: "LeftUpperLeg",
                    leftLowerLeg: "LeftLowerLeg",
                    leftFoot: "LeftFoot",
                    leftToes: "LeftToeBase",
                    rightUpperLeg: "RightUpperLeg",
                    rightLowerLeg: "RightLowerLeg",
                    rightFoot: "RightFoot",
                    rightToes: "RightToeBase",

                    leftEye: "LeftEye",
                    rightEye: "RightEye",

                    leftThumbProximal: "LeftThumbProximal",
                    leftThumbIntermediate: "LeftThumbIntermediate",
                    leftThumbDistal: "LeftThumbDistal",
                    leftIndexProximal: "LeftIndexProximal",
                    leftIndexIntermediate: "LeftIndexIntermediate",
                    leftIndexDistal: "LeftIndexDistal",
                    leftMiddleProximal: "LeftMiddleProximal",
                    leftMiddleIntermediate: "LeftMiddleIntermediate",
                    leftMiddleDistal: "LeftMiddleDistal",
                    leftRingProximal: "LeftRingProximal",
                    leftRingIntermediate: "LeftRingIntermediate",
                    leftRingDistal: "LeftRingDistal",
                    leftLittleProximal: "LeftLittleProximal",
                    leftLittleIntermediate: "LeftLittleIntermediate",
                    leftLittleDistal: "LeftLittleDistal",

                    rightThumbProximal: "RightThumbProximal",
                    rightThumbIntermediate: "RightThumbIntermediate",
                    rightThumbDistal: "RightThumbDistal",
                    rightIndexProximal: "RightIndexProximal",
                    rightIndexIntermediate: "RightIndexIntermediate",
                    rightIndexDistal: "RightIndexDistal",
                    rightMiddleProximal: "RightMiddleProximal",
                    rightMiddleIntermediate: "RightMiddleIntermediate",
                    rightMiddleDistal: "RightMiddleDistal",
                    rightRingProximal: "RightRingProximal",
                    rightRingIntermediate: "RightRingIntermediate",
                    rightRingDistal: "RightRingDistal",
                    rightLittleProximal: "RightLittleProximal",
                    rightLittleIntermediate: "RightLittleIntermediate",
                    rightLittleDistal: "RightLittleDistal"
                }).boneMap,
                transformOffset: modelMesh
            }
        );
        mmdModel.morph.setMorphWeight("口_真顔", 0.2);
        mmdModel.addAnimation(mmdAnimation);
        mmdModel.setAnimation("motion");

        const translationMatrix = modelMesh.getWorldMatrix().clone();
        translationMatrix.removeRotationAndScaling();

        attachToBone(scene, mmdModel, {
            directionalLightPosition: directionalLight.position,
            cameraTargetPosition: camera.target,
            cameraTargetYpositionOffset: -3,
            worldMatrix: translationMatrix
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
        mmdCameraAutoFocus.setTarget(mmdModel);
        mmdCameraAutoFocus.setSkeletonWorldMatrix(translationMatrix);
        mmdCameraAutoFocus.register(scene);

        return scene;
    }
}
