import "@babylonjs/core/Loading/loadingScreen";
import "@babylonjs/core/Rendering/prePassRendererSceneComponent";
import "@babylonjs/core/Rendering/depthRendererSceneComponent";
import "@babylonjs/core/Rendering/geometryBufferRendererSceneComponent";
import "@/Loader/Optimized/bpmxLoader";
import "@/Runtime/Animation/mmdRuntimeCameraAnimation";
import "@/Runtime/Animation/mmdRuntimeModelAnimation";

import type { AssetContainer } from "@babylonjs/core/assetContainer";
import type { AbstractEngine } from "@babylonjs/core/Engines/abstractEngine";
import { Constants } from "@babylonjs/core/Engines/constants";
import { LoadAssetContainerAsync } from "@babylonjs/core/Loading/sceneLoader";
import { ImageProcessingConfiguration } from "@babylonjs/core/Materials/imageProcessingConfiguration";
import { Color4 } from "@babylonjs/core/Maths/math.color";
import { Quaternion, Vector3 } from "@babylonjs/core/Maths/math.vector";
import { DepthOfFieldEffectBlurLevel } from "@babylonjs/core/PostProcesses/depthOfFieldEffect";
import { DefaultRenderingPipeline } from "@babylonjs/core/PostProcesses/RenderPipeline/Pipelines/defaultRenderingPipeline";
import { SSRRenderingPipeline } from "@babylonjs/core/PostProcesses/RenderPipeline/Pipelines/ssrRenderingPipeline";
import { Scene } from "@babylonjs/core/scene";
import type { Nullable } from "@babylonjs/core/types";

import type { MmdAnimation } from "@/Loader/Animation/mmdAnimation";
import type { MaterialInfo, TextureInfo } from "@/Loader/IMmdMaterialBuilder";
import { MmdMaterialRenderMethod } from "@/Loader/materialBuilderBase";
import type { MmdStandardMaterial } from "@/Loader/mmdStandardMaterial";
import { MmdStandardMaterialBuilder } from "@/Loader/mmdStandardMaterialBuilder";
import { BvmdLoader } from "@/Loader/Optimized/bvmdLoader";
import type { ILogger } from "@/Loader/Parser/ILogger";
import type { ReferenceFileResolver } from "@/Loader/referenceFileResolver";
import { MmdHumanoidMapper } from "@/Loader/Util/mmdHumanoidMapper";
import { StreamAudioPlayer } from "@/Runtime/Audio/streamAudioPlayer";
import { MmdCamera } from "@/Runtime/mmdCamera";
import type { MmdMesh } from "@/Runtime/mmdMesh";
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
        audioPlayer.source = "res/private_test/motion/cinderella/cinderella.mp3";
        mmdRuntime.setAudioPlayer(audioPlayer);

        const mmdPlayerControl = new MmdPlayerControl(scene, mmdRuntime, audioPlayer);
        mmdPlayerControl.showPlayerControl();

        const materialBuilder = new MmdStandardMaterialBuilder();
        materialBuilder.loadOutlineRenderingProperties = (): void => { /* do nothing */ };
        const originalLoadToonTexture = materialBuilder.loadToonTexture;
        materialBuilder.loadToonTexture = (
            uniqueId: number,
            material: MmdStandardMaterial,
            materialInfo: MaterialInfo,
            imagePathTable: readonly string[],
            textureInfo: Nullable<TextureInfo>,
            scene: Scene,
            assetContainer: Nullable<AssetContainer>,
            rootUrl: string,
            referenceFileResolver: ReferenceFileResolver,
            logger: ILogger,
            onTextureLoadComplete?: () => void
        ): Promise<void> => {
            if (!materialInfo.isSharedToonTexture && materialInfo.toonTextureIndex === -1) {
                (materialInfo as any).isSharedToonTexture = true;
                (materialInfo as any).toonTextureIndex = 1;
            }
            originalLoadToonTexture(
                uniqueId,
                material,
                materialInfo,
                imagePathTable,
                textureInfo,
                scene,
                assetContainer,
                rootUrl,
                referenceFileResolver,
                logger,
                onTextureLoadComplete
            );

            return Promise.resolve();
        };
        materialBuilder.renderMethod = MmdMaterialRenderMethod.AlphaEvaluation;

        const [
            mmdAnimation,
            mmdMesh
        ] = await parallelLoadAsync(scene, [
            ["motion", (updateProgress): Promise<MmdAnimation> => {
                const bvmdLoader = new BvmdLoader(scene);
                bvmdLoader.loggingEnabled = true;
                return bvmdLoader.loadAsync("motion", "res/private_test/motion/cinderella/motion.bvmd", updateProgress);
            }],
            ["model", async(updateProgress): Promise<MmdMesh> => LoadAssetContainerAsync(
                "res/private_test/model/Moe.bpmx",
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
                "res/private_test/stage/Stage35_02.bpmx",
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

        mmdRuntime.setCamera(mmdCamera);
        mmdCamera.addAnimation(mmdAnimation);
        mmdCamera.setAnimation("motion");

        mmdMesh.scaling.scaleInPlace(14.3);
        mmdMesh.scaling.z *= -1;

        for (const mesh of mmdMesh.metadata.meshes) {
            mesh.receiveShadows = true;
            shadowGenerator.addShadowCaster(mesh, false);
        }

        {
            const bones = mmdMesh.metadata.skeleton!.bones;
            const leftArm = bones.find(bone => bone.name === "Left arm")!;
            const rightArm = bones.find(bone => bone.name === "Right arm")!;
            const degToRad = Math.PI / 180;
            leftArm.rotationQuaternion = Quaternion.FromEulerAngles(0, 0, -35 * degToRad);
            rightArm.rotationQuaternion = Quaternion.FromEulerAngles(0, 0, 35 * degToRad);
        }

        const mmdModel = new HumanoidMmd().createMmdModelFromHumanoid(
            mmdRuntime,
            mmdMesh,
            mmdMesh.metadata.meshes,
            {
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
                transformOffset: mmdMesh
            }
        );
        mmdModel.morph.setMorphWeight("口_真顔", 0.2);
        mmdModel.addAnimation(mmdAnimation);
        mmdModel.setAnimation("motion");

        const translationMatrix = mmdMesh.getWorldMatrix().clone();
        translationMatrix.removeRotationAndScaling();

        attachToBone(scene, mmdModel, {
            directionalLightPosition: directionalLight.position,
            cameraTargetPosition: camera.target,
            cameraTargetYpositionOffset: -3,
            worldMatrix: translationMatrix
        });
        scene.onAfterRenderObservable.addOnce(() => optimizeScene);//(scene));

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
        defaultPipeline.depthOfFieldEnabled = false;
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
