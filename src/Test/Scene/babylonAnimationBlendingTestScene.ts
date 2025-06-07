import "@babylonjs/core/Animations/animatable";
import "@babylonjs/core/Loading/loadingScreen";
import "@babylonjs/core/Rendering/depthRendererSceneComponent";
import "@/Loader/Optimized/bpmxLoader";
import "@/Runtime/Animation/mmdRuntimeCameraAnimationGroup";
import "@/Runtime/Animation/mmdRuntimeModelAnimationGroup";

import { SkeletonViewer } from "@babylonjs/core/Debug/skeletonViewer";
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
import { MmdCameraAnimationGroup, MmdCameraAnimationGroupBezierBuilder } from "@/Loader/Animation/mmdCameraAnimationGroup";
import { MmdModelAnimationGroup, MmdModelAnimationGroupBezierBuilder } from "@/Loader/Animation/mmdModelAnimationGroup";
import { MmdStandardMaterialBuilder } from "@/Loader/mmdStandardMaterialBuilder";
import { BvmdLoader } from "@/Loader/Optimized/bvmdLoader";
import { SdefInjector } from "@/Loader/sdefInjector";
import { StreamAudioPlayer } from "@/Runtime/Audio/streamAudioPlayer";
import { MmdCamera } from "@/Runtime/mmdCamera";
import type { MmdMesh } from "@/Runtime/mmdMesh";
import { MmdRuntime } from "@/Runtime/mmdRuntime";
import { MmdPhysics } from "@/Runtime/Physics/mmdPhysics";

import type { ISceneBuilder } from "../baseRuntime";
import { AttachToBone } from "../Util/attachToBone";
import { CreateCameraSwitch } from "../Util/createCameraSwitch";
import { CreateDefaultArcRotateCamera } from "../Util/createDefaultArcRotateCamera";
import { CreateDefaultGround } from "../Util/createDefaultGround";
import { CreateGroundCollider } from "../Util/createGroundCollider";
import { CreateLightComponents } from "../Util/createLightComponents";
import { MmdCameraAutoFocus } from "../Util/mmdCameraAutoFocus";
import { ParallelLoadAsync } from "../Util/parallelLoadAsync";

export class SceneBuilder implements ISceneBuilder {
    public async buildAsync(canvas: HTMLCanvasElement, engine: AbstractEngine): Promise<Scene> {
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
        CreateDefaultGround(scene);

        const mmdRuntime = new MmdRuntime(scene, new MmdPhysics(scene));
        mmdRuntime.loggingEnabled = true;
        mmdRuntime.register(scene);

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
            modelMesh,
            stageMesh
        ] = await ParallelLoadAsync(scene, [
            ["motion1", (updateProgress): Promise<MmdAnimation> =>
                bvmdLoader.loadAsync("motion1", "res/private_test/motion/intergalactia/intergalactia.bvmd", updateProgress)],
            ["motion2", (updateProgress): Promise<MmdAnimation> =>
                bvmdLoader.loadAsync("motion2", "res/private_test/motion/conqueror/motion_light.bvmd", updateProgress)],
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
            ["stage", (updateProgress): Promise<MmdMesh> => LoadAssetContainerAsync(
                "res/private_test/stage/ガラス片ドームB.bpmx",
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

        // disable ik solver for motion captured assets
        const disableIkBones = [ "右足ＩＫ", "右つま先ＩＫ", "左足ＩＫ", "左つま先ＩＫ", "右ひじＩＫ", "左ひじＩＫ" ];
        const runtimeBones = mmdModel.runtimeBones;
        const ikSolverStates = mmdModel.ikSolverStates;
        for (let i = 0; i < runtimeBones.length; ++i) {
            const runtimeBone = runtimeBones[i];
            if (disableIkBones.includes(runtimeBone.name)) {
                ikSolverStates[runtimeBone.ikSolverIndex] = 0;
            }
        }

        const audioPlayer1 = new StreamAudioPlayer(scene);
        audioPlayer1.source = "res/private_test/motion/intergalactia/INTERGALACTIA.mp3";

        const audioPlayer2 = new StreamAudioPlayer(scene);
        audioPlayer2.source = "res/private_test/motion/conqueror/MMDConquerorIA.mp3";

        const mmdModelAnimationGroup1 = new MmdModelAnimationGroup(mmdAnimation1, new MmdModelAnimationGroupBezierBuilder());
        const mmdCameraAnimationGroup1 = new MmdCameraAnimationGroup(mmdAnimation1, new MmdCameraAnimationGroupBezierBuilder());

        const mmdModelAnimationGroup2 = new MmdModelAnimationGroup(mmdAnimation2, new MmdModelAnimationGroupBezierBuilder());
        const mmdCameraAnimationGroup2 = new MmdCameraAnimationGroup(mmdAnimation2, new MmdCameraAnimationGroupBezierBuilder());

        const bindedModelAnimationGroup1 = mmdModelAnimationGroup1.createAnimationGroup(mmdModel);
        for (const animation of mmdModelAnimationGroup1.propertyAnimations) {
            bindedModelAnimationGroup1.removeTargetedAnimation(animation);
        }
        const bindedCameraAnimationGroup1 = mmdCameraAnimationGroup1.createAnimationGroup(mmdCamera);

        // for match animation duration
        bindedModelAnimationGroup1.normalize(mmdAnimation1.startFrame, mmdAnimation1.endFrame);
        bindedCameraAnimationGroup1.normalize(mmdAnimation1.startFrame, mmdAnimation1.endFrame);


        const bindedModelAnimationGroup2 = mmdModelAnimationGroup2.createAnimationGroup(mmdModel);
        for (const animation of mmdModelAnimationGroup2.propertyAnimations) {
            bindedModelAnimationGroup2.removeTargetedAnimation(animation);
        }
        const bindedCameraAnimationGroup2 = mmdCameraAnimationGroup2.createAnimationGroup(mmdCamera);

        // for match animation duration
        bindedModelAnimationGroup2.normalize(mmdAnimation2.startFrame, mmdAnimation2.endFrame);
        bindedCameraAnimationGroup2.normalize(mmdAnimation2.startFrame, mmdAnimation2.endFrame);

        bindedModelAnimationGroup1.weight = 1;
        bindedCameraAnimationGroup1.weight = 1;

        bindedModelAnimationGroup2.weight = 0;
        bindedCameraAnimationGroup2.weight = 0;

        // wait for audio ready (little tricky method because there is no audio sync implementation with babylon.js animation runtime)
        await audioPlayer1.play();
        audioPlayer1.pause();
        await audioPlayer2.play();
        audioPlayer2.pause();

        audioPlayer1.volume = 1;
        audioPlayer2.volume = 0;
        audioPlayer1.play();
        audioPlayer2.play();

        bindedCameraAnimationGroup1.play(true);
        bindedModelAnimationGroup1.play(true);

        bindedCameraAnimationGroup2.play(true);
        bindedModelAnimationGroup2.play(true);

        bindedCameraAnimationGroup1.onAnimationGroupLoopObservable.add(async() => {
            audioPlayer1.currentTime = 0;
            await audioPlayer1.play();
        });

        bindedCameraAnimationGroup2.onAnimationGroupLoopObservable.add(async() => {
            audioPlayer2.currentTime = 0;
            await audioPlayer2.play();
        });

        // UI
        {
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

            const uiContainer = ownerDocument.createElement("div");
            uiContainer.style.position = "relative";
            uiContainer.style.bottom = "0";
            uiContainer.style.left = "0";
            uiContainer.style.fontFamily = "sans-serif";
            newCanvasContainer.appendChild(uiContainer);

            scene.onDisposeObservable.addOnce(() => {
                newCanvasContainer.removeChild(uiContainer);

                while (newCanvasContainer.childElementCount > 0) {
                    const child = newCanvasContainer.childNodes[0];
                    newCanvasContainer.removeChild(child);
                    parentControl.appendChild(child);
                }

                parentControl.removeChild(newCanvasContainer);
            });

            const uiInnerContainer = ownerDocument.createElement("div");
            uiInnerContainer.style.position = "absolute";
            uiInnerContainer.style.bottom = "0";
            uiInnerContainer.style.left = "0";
            uiInnerContainer.style.boxSizing = "border-box";
            uiInnerContainer.style.display = "flex";
            uiInnerContainer.style.flexDirection = "column";
            uiContainer.appendChild(uiInnerContainer);

            const motion1SliderDiv = ownerDocument.createElement("div");
            motion1SliderDiv.style.width = "300px";
            motion1SliderDiv.style.height = "30px";
            motion1SliderDiv.style.display = "flex";
            motion1SliderDiv.style.flexDirection = "row";
            motion1SliderDiv.style.justifyContent = "space-between";
            motion1SliderDiv.style.alignItems = "center";
            motion1SliderDiv.style.backgroundColor = "rgba(0, 0, 0, 0.5)";
            motion1SliderDiv.style.margin = "10px";
            motion1SliderDiv.style.padding = "5px";
            uiInnerContainer.appendChild(motion1SliderDiv);

            const motion1SliderLabel = ownerDocument.createElement("label");
            motion1SliderLabel.textContent = "Motion 1";
            motion1SliderLabel.style.width = "60px";
            motion1SliderLabel.style.color = "white";
            motion1SliderLabel.style.textAlign = "left";
            motion1SliderLabel.style.marginRight = "10px";
            motion1SliderLabel.style.fontSize = "16px";
            motion1SliderDiv.appendChild(motion1SliderLabel);

            const motion1Slider = ownerDocument.createElement("input");
            motion1Slider.type = "range";
            motion1Slider.min = "0";
            motion1Slider.max = "1";
            motion1Slider.step = "0.01";
            motion1Slider.value = "1";
            motion1Slider.style.flexGrow = "1";
            motion1SliderDiv.appendChild(motion1Slider);
            motion1Slider.oninput = (): void => {
                const value = Number(motion1Slider.value);
                if (audioPlayer1.volume === 0 && value !== 0 && audioPlayer1.paused) {
                    audioPlayer1.currentTime = bindedCameraAnimationGroup1.animatables[0].masterFrame / 30;
                    audioPlayer1.play();
                    setTimeout(() => {
                        audioPlayer1.currentTime = bindedCameraAnimationGroup1.animatables[0].masterFrame / 30;
                    }, 1000);
                }
                audioPlayer1.volume = value;
                bindedModelAnimationGroup1.weight = value;
                bindedCameraAnimationGroup1.weight = value;
            };

            const motion2SliderDiv = ownerDocument.createElement("div");
            motion2SliderDiv.style.width = "300px";
            motion2SliderDiv.style.height = "30px";
            motion2SliderDiv.style.display = "flex";
            motion2SliderDiv.style.flexDirection = "row";
            motion2SliderDiv.style.justifyContent = "space-between";
            motion2SliderDiv.style.alignItems = "center";
            motion2SliderDiv.style.backgroundColor = "rgba(0, 0, 0, 0.5)";
            motion2SliderDiv.style.margin = "10px";
            motion2SliderDiv.style.padding = "5px";
            uiInnerContainer.appendChild(motion2SliderDiv);

            const motion2SliderLabel = ownerDocument.createElement("label");
            motion2SliderLabel.textContent = "Motion 2";
            motion2SliderLabel.style.width = "60px";
            motion2SliderLabel.style.color = "white";
            motion2SliderLabel.style.textAlign = "left";
            motion2SliderLabel.style.marginRight = "10px";
            motion2SliderLabel.style.fontSize = "16px";
            motion2SliderDiv.appendChild(motion2SliderLabel);

            const motion2Slider = ownerDocument.createElement("input");
            motion2Slider.type = "range";
            motion2Slider.min = "0";
            motion2Slider.max = "1";
            motion2Slider.step = "0.01";
            motion2Slider.value = "0";
            motion2Slider.style.flexGrow = "1";
            motion2SliderDiv.appendChild(motion2Slider);
            motion2Slider.oninput = (): void => {
                const value = Number(motion2Slider.value);
                if (audioPlayer2.volume === 0 && value !== 0 && audioPlayer2.paused) {
                    audioPlayer2.currentTime = bindedCameraAnimationGroup2.animatables[0].masterFrame / 30;
                    audioPlayer2.play();
                    setTimeout(() => {
                        audioPlayer2.currentTime = bindedCameraAnimationGroup2.animatables[0].masterFrame / 30;
                    }, 1000);
                }
                audioPlayer2.volume = value;
                bindedModelAnimationGroup2.weight = value;
                bindedCameraAnimationGroup2.weight = value;
            };

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
            blendSlider.step = "0.01";
            blendSlider.value = "0";
            blendSlider.style.flexGrow = "1";
            blendSliderDiv.appendChild(blendSlider);
            const emptyEvent = new Event("input");
            blendSlider.oninput = (): void => {
                const value = Number(blendSlider.value);
                motion1Slider.value = String(1 - value);
                motion2Slider.value = String(value);

                motion1Slider.oninput?.(emptyEvent);
                motion2Slider.oninput?.(emptyEvent);
            };
        }

        AttachToBone(scene, mmdModel, {
            directionalLightPosition: directionalLight.position,
            cameraTargetPosition: camera.target
        });

        const viewer = new SkeletonViewer(modelMesh.metadata.skeleton!, modelMesh, scene, false, 3, {
            displayMode: SkeletonViewer.DISPLAY_SPHERE_AND_SPURS
        });
        viewer.isEnabled = false;

        for (const mesh of stageMesh.metadata.meshes) mesh.receiveShadows = true;
        stageMesh.position.y += 0.01;

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

        // Inspector.Show(scene, { });

        return scene;
    }
}
