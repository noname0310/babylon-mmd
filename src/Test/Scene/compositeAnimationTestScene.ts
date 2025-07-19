import "@babylonjs/core/Loading/loadingScreen";
import "@babylonjs/core/Rendering/depthRendererSceneComponent";
import "@/Loader/Optimized/bpmxLoader";
import "@/Runtime/Animation/mmdCompositeRuntimeCameraAnimation";
import "@/Runtime/Animation/mmdCompositeRuntimeModelAnimation";
import "@/Runtime/Animation/mmdRuntimeCameraAnimation";
import "@/Runtime/Animation/mmdRuntimeModelAnimation";

import { BezierCurveEase } from "@babylonjs/core/Animations/easing";
import type { AbstractEngine } from "@babylonjs/core/Engines/abstractEngine";
import { Constants } from "@babylonjs/core/Engines/constants";
import { LoadAssetContainerAsync } from "@babylonjs/core/Loading/sceneLoader";
import { ImageProcessingConfiguration } from "@babylonjs/core/Materials/imageProcessingConfiguration";
import { Color4 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { HavokPlugin } from "@babylonjs/core/Physics/v2/Plugins/havokPlugin";
import { DepthOfFieldEffectBlurLevel } from "@babylonjs/core/PostProcesses/depthOfFieldEffect";
import { DefaultRenderingPipeline } from "@babylonjs/core/PostProcesses/RenderPipeline/Pipelines/defaultRenderingPipeline";
import { Scene } from "@babylonjs/core/scene";
import havokPhysics from "@babylonjs/havok";

import type { MmdAnimation } from "@/Loader/Animation/mmdAnimation";
import { MmdStandardMaterialBuilder } from "@/Loader/mmdStandardMaterialBuilder";
import { BvmdLoader } from "@/Loader/Optimized/bvmdLoader";
import { SdefInjector } from "@/Loader/sdefInjector";
import { MmdAnimationSpan, MmdCompositeAnimation } from "@/Runtime/Animation/mmdCompositeAnimation";
import { StreamAudioPlayer } from "@/Runtime/Audio/streamAudioPlayer";
import { MmdCamera } from "@/Runtime/mmdCamera";
import type { MmdMesh } from "@/Runtime/mmdMesh";
import { MmdRuntime } from "@/Runtime/mmdRuntime";
import { MmdPhysics } from "@/Runtime/Physics/mmdPhysics";
import { DisplayTimeFormat, MmdPlayerControl } from "@/Runtime/Util/mmdPlayerControl";

import type { ISceneBuilder } from "../baseRuntime";
import { CreateCameraSwitch } from "../Util/createCameraSwitch";
import { CreateDefaultArcRotateCamera } from "../Util/createDefaultArcRotateCamera";
import { CreateDefaultGround } from "../Util/createDefaultGround";
import { CreateGroundCollider } from "../Util/createGroundCollider";
import { CreateLightComponents } from "../Util/createLightComponents";
import { MmdCameraAutoFocus } from "../Util/mmdCameraAutoFocus";
import { OptimizeScene } from "../Util/optimizeScene";
import { ParallelLoadAsync } from "../Util/parallelLoadAsync";

export class SceneBuilder implements ISceneBuilder {
    public async buildAsync(canvas: HTMLCanvasElement, engine: AbstractEngine): Promise<Scene> {
        SdefInjector.OverrideEngineCreateEffect(engine);

        const scene = new Scene(engine);
        scene.clearColor = new Color4(0.95, 0.95, 0.95, 1.0);
        const mmdRoot = new TransformNode("mmdRoot", scene);
        const cameraRoot = new TransformNode("cameraRoot", scene);
        cameraRoot.scaling.y = 0.98;
        cameraRoot.parent = mmdRoot;
        const mmdCamera = new MmdCamera("mmdCamera", new Vector3(0, 10, 0), scene);
        mmdCamera.maxZ = 5000;
        mmdCamera.ignoreParentScaling = true;
        mmdCamera.parent = cameraRoot;
        const camera = CreateDefaultArcRotateCamera(scene);
        CreateCameraSwitch(scene, canvas, camera, mmdCamera);
        const { shadowGenerator } = CreateLightComponents(scene, {
            orthoLeftOffset: -15,
            orthoRightOffset: 13,
            orthoBottomOffset: -5,
            orthoTopOffset: 10,
            shadowMaxZOffset: 13
        });
        shadowGenerator.transparencyShadow = true;
        CreateDefaultGround(scene);

        const mmdRuntime = new MmdRuntime(scene, new MmdPhysics(scene));
        mmdRuntime.loggingEnabled = true;
        mmdRuntime.register(scene);

        const audioPlayer = new StreamAudioPlayer(scene);
        audioPlayer.preservesPitch = false;
        audioPlayer.source = "res/private_test/motion/kimini_totte/kimini totte.mp3";
        mmdRuntime.setAudioPlayer(audioPlayer);

        mmdRuntime.playAnimation();

        const playerControl = new MmdPlayerControl(scene, mmdRuntime, audioPlayer);
        playerControl.displayTimeFormat = DisplayTimeFormat.Frames;
        playerControl.showPlayerControl();

        const bvmdLoader = new BvmdLoader(scene);
        bvmdLoader.loggingEnabled = true;

        const materialBuilder = new MmdStandardMaterialBuilder();
        materialBuilder.loadOutlineRenderingProperties = (): void => { /* do nothing */ };
        materialBuilder.afterBuildSingleMaterial = (material): void => {
            if (material.name.toLowerCase() === "hairshadow") material.alphaMode = Constants.ALPHA_SUBTRACT;
        };

        const [
            mmdAnimation1,
            mmdAnimation2,
            cameraAnimation,
            modelMesh,
            modelMeshA,
            modelMeshB
        ] = await ParallelLoadAsync(scene, [
            ["motion1", (updateProgress): Promise<MmdAnimation> =>
                bvmdLoader.loadAsync("motion1", "res/private_test/motion/kimini_totte/motion_a.bvmd", updateProgress)],
            ["motion2", (updateProgress): Promise<MmdAnimation> =>
                bvmdLoader.loadAsync("motion2", "res/private_test/motion/kimini_totte/motion_b.bvmd", updateProgress)],
            ["camera", (updateProgress): Promise<MmdAnimation> =>
                bvmdLoader.loadAsync("camera", "res/private_test/motion/kimini_totte/camera.bvmd", updateProgress)],
            ["model", (updateProgress): Promise<MmdMesh> => LoadAssetContainerAsync(
                "res/private_test/model/YYB miku Crown Knight.bpmx",
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
            ["model_a", (updateProgress): Promise<MmdMesh> => LoadAssetContainerAsync(
                "res/private_test/model/YYB Hatsune Miku Default.bpmx",
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
            ["model_b", (updateProgress): Promise<MmdMesh> => LoadAssetContainerAsync(
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
            ["physics", async(updateProgress): Promise<void> => {
                updateProgress({ lengthComputable: true, loaded: 0, total: 1 });
                const havokInstance = await havokPhysics();
                const havokPlugin = new HavokPlugin(true, havokInstance);
                scene.enablePhysics(new Vector3(0, -9.8 * 10, 0), havokPlugin);
                updateProgress({ lengthComputable: true, loaded: 1, total: 1 });
            }]
        ]);

        mmdRuntime.addAnimatable(mmdCamera);
        const cameraAnimationHandle = mmdCamera.createRuntimeAnimation(cameraAnimation);
        mmdCamera.setRuntimeAnimation(cameraAnimationHandle);

        for (const mesh of modelMesh.metadata.meshes) {
            mesh.receiveShadows = true;
            shadowGenerator.addShadowCaster(mesh, false);
        }
        modelMesh.parent = mmdRoot;
        const mmdModel = mmdRuntime.createMmdModel(modelMesh, {
            buildPhysics: true
        });
        const compositeAnimation = new MmdCompositeAnimation("composite");
        const duration = Math.max(mmdAnimation1.endFrame, mmdAnimation2.endFrame);
        const animationSpan1 = new MmdAnimationSpan(mmdAnimation1, undefined, duration, 0, 0);
        const animationSpan2 = new MmdAnimationSpan(mmdAnimation2, undefined, duration, 0, 0);
        compositeAnimation.addSpan(animationSpan1);
        compositeAnimation.addSpan(animationSpan2);

        const easingFunction = new BezierCurveEase(0.7, 0.01, 0.3, 0.99);
        const transitionPoints = [ 252, 456, 540, 610, 1048, 1281, 1411, 1447, 1516, 1545, 1694, 1913, 2052, 2089, 2274, 2392, 2464, 2756, 2870, 2945, 3024, 3106, 3249, 3395, 3643, 3776, 3881, 4012, 4047, 4151, 4542, 4687, 4739, 4797, 4848, 5013, 5141, 5452, 5722, 6078, 6407, 6644, 6915, duration ];
        let lastTransitionPoint = 0;
        for (let i = 0; i < transitionPoints.length; ++i) {
            const transitionPoint = transitionPoints[i];

            const animationSpan = new MmdAnimationSpan(i % 2 === 0 ? mmdAnimation1 : mmdAnimation2, lastTransitionPoint - 30, transitionPoint, 0, 1);
            animationSpan.easeInFrameTime = 30;
            animationSpan.easeOutFrameTime = 30;
            animationSpan.easingFunction = easingFunction;
            compositeAnimation.addSpan(animationSpan);

            lastTransitionPoint = transitionPoints[i];
        }

        mmdModel.addAnimation(compositeAnimation);
        mmdModel.setAnimation("composite");

        for (const mesh of modelMeshA.metadata.meshes) {
            mesh.receiveShadows = true;
            shadowGenerator.addShadowCaster(mesh, false);
        }
        modelMeshA.parent = mmdRoot;
        modelMeshA.position.z = 10;
        const mmdModelA = mmdRuntime.createMmdModel(modelMeshA, {
            buildPhysics: true
        });
        mmdModelA.addAnimation(mmdAnimation1);
        mmdModelA.setAnimation("motion1");

        for (const mesh of modelMeshB.metadata.meshes) {
            mesh.receiveShadows = true;
            shadowGenerator.addShadowCaster(mesh, false);
        }
        modelMeshB.parent = mmdRoot;
        modelMeshB.position.z = 10;
        const mmdModelB = mmdRuntime.createMmdModel(modelMeshB, {
            buildPhysics: true
        });
        mmdModelB.addAnimation(mmdAnimation2);
        mmdModelB.setAnimation("motion2");

        scene.onAfterRenderObservable.addOnce(() => OptimizeScene(scene));

        CreateGroundCollider(scene);

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

        const parentControl = engine.getInputElement()!.parentElement!;
        const ownerDocument = parentControl.ownerDocument;

        const newCanvasContainer = ownerDocument.createElement("div");
        {
            newCanvasContainer.style.display = parentControl.style.display;

            while (parentControl.childElementCount > 0) {
                const child = parentControl.childNodes[0];
                parentControl.removeChild(child);
                newCanvasContainer.appendChild(child);
            }

            parentControl.appendChild(newCanvasContainer);

            newCanvasContainer.style.width = "100%";
            newCanvasContainer.style.height = "100%";
            newCanvasContainer.style.overflow = "hidden";
        }

        const uiContainerRoot = ownerDocument.createElement("div");
        uiContainerRoot.style.position = "absolute";
        uiContainerRoot.style.top = "0";
        uiContainerRoot.style.left = "0";
        uiContainerRoot.style.width = "100%";
        uiContainerRoot.style.height = "100%";
        uiContainerRoot.style.overflow = "hidden";
        uiContainerRoot.style.pointerEvents = "none";
        newCanvasContainer.appendChild(uiContainerRoot);

        scene.onDisposeObservable.addOnce(() => {
            newCanvasContainer.removeChild(uiContainerRoot);

            while (newCanvasContainer.childElementCount > 0) {
                const child = newCanvasContainer.childNodes[0];
                newCanvasContainer.removeChild(child);
                parentControl.appendChild(child);
            }

            parentControl.removeChild(newCanvasContainer);
        });

        const uiContainer = ownerDocument.createElement("div");
        uiContainer.style.position = "absolute";
        uiContainer.style.top = "0";
        uiContainer.style.right = "0";
        uiContainer.style.fontFamily = "sans-serif";
        uiContainer.style.color = "white";
        uiContainer.style.transition = "right 0.5s";
        uiContainer.style.pointerEvents = "auto";
        uiContainerRoot.appendChild(uiContainer);

        const uiInnerContainer = ownerDocument.createElement("div");
        uiInnerContainer.style.display = "flex";
        uiInnerContainer.style.flexDirection = "column";
        uiInnerContainer.style.justifyContent = "space-between";
        uiInnerContainer.style.alignItems = "center";
        uiInnerContainer.style.backgroundColor = "rgba(34, 34, 34, 0.4)";
        uiInnerContainer.style.padding = "5px";
        uiInnerContainer.style.boxSizing = "border-box";
        uiContainer.appendChild(uiInnerContainer);

        const blendSliderDiv = ownerDocument.createElement("div");
        blendSliderDiv.style.width = "300px";
        blendSliderDiv.style.height = "30px";
        blendSliderDiv.style.display = "flex";
        blendSliderDiv.style.flexDirection = "row";
        blendSliderDiv.style.justifyContent = "space-between";
        blendSliderDiv.style.alignItems = "center";
        blendSliderDiv.style.backgroundColor = "rgba(0, 0, 0, 0.5)";
        blendSliderDiv.style.margin = "10px";
        blendSliderDiv.style.padding = "5px";
        uiInnerContainer.appendChild(blendSliderDiv);

        const blendSliderLabel = ownerDocument.createElement("label");
        blendSliderLabel.textContent = "Blend";
        blendSliderLabel.style.width = "60px";
        blendSliderLabel.style.color = "white";
        blendSliderLabel.style.textAlign = "left";
        blendSliderLabel.style.marginRight = "10px";
        blendSliderLabel.style.fontSize = "16px";
        blendSliderDiv.appendChild(blendSliderLabel);

        const blendSlider = ownerDocument.createElement("input");
        blendSlider.type = "range";
        blendSlider.min = "0";
        blendSlider.max = "1";
        blendSlider.step = "0.02";
        blendSlider.value = "0";
        blendSlider.style.flexGrow = "1";
        blendSliderDiv.appendChild(blendSlider);
        blendSlider.oninput = (): void => {
            const value = Number(blendSlider.value);

            const spans = compositeAnimation.spans;
            for (let i = 0; i < spans.length; ++i) {
                spans[i].weight = 0;
            }

            animationSpan1.weight = 1 - value;
            animationSpan2.weight = value;
        };

        return scene;
    }
}
