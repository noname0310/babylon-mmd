import "@babylonjs/core/Animations/animatable";
import "@babylonjs/core/Loading/loadingScreen";
import "@babylonjs/core/Rendering/depthRendererSceneComponent";
import "@/Loader/Optimized/bpmxLoader";
import "@/Runtime/Animation/mmdCompositeRuntimeCameraAnimation";
import "@/Runtime/Animation/mmdCompositeRuntimeModelAnimation";
import "@/Runtime/Animation/mmdRuntimeCameraAnimation";
import "@/Runtime/Animation/mmdRuntimeModelAnimation";

import { Constants } from "@babylonjs/core/Engines/constants";
import type { Engine } from "@babylonjs/core/Engines/engine";
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
import { MmdAnimationSpan, MmdCompositeAnimation } from "@/Runtime/Animation/mmdCompositeAnimation";
import { StreamAudioPlayer } from "@/Runtime/Audio/streamAudioPlayer";
import { MmdCamera } from "@/Runtime/mmdCamera";
import { MmdPhysics } from "@/Runtime/mmdPhysics";
import { MmdRuntime } from "@/Runtime/mmdRuntime";
import { MmdPlayerControl } from "@/Runtime/Util/mmdPlayerControl";

import type { ISceneBuilder } from "../baseRuntime";
import { attachToBone } from "../Util/attachToBone";
import { createCameraSwitch } from "../Util/createCameraSwitch";
import { createDefaultArcRotateCamera } from "../Util/createDefaultArcRotateCamera";
import { createDefaultGround } from "../Util/createDefaultGround";
import { createGroundCollider } from "../Util/createGroundCollider";
import { createLightComponents } from "../Util/createLightComponents";
import { MmdCameraAutoFocus } from "../Util/mmdCameraAutoFocus";
import { parallelLoadAsync } from "../Util/parallelLoadAsync";

export class SceneBuilder implements ISceneBuilder {
    public async build(canvas: HTMLCanvasElement, engine: Engine): Promise<Scene> {
        SdefInjector.OverrideEngineCreateEffect(engine);
        const pmxLoader = SceneLoader.GetPluginForExtension(".bpmx") as BpmxLoader;
        pmxLoader.loggingEnabled = true;
        const materialBuilder = pmxLoader.materialBuilder as MmdStandardMaterialBuilder;
        materialBuilder.loadOutlineRenderingProperties = (): void => { /* do nothing */ };
        materialBuilder.afterBuildSingleMaterial = (material): void => {
            if (material.name.toLowerCase() === "hairshadow") material.alphaMode = Constants.ALPHA_SUBTRACT;
        };

        const scene = new Scene(engine);
        scene.clearColor = new Color4(0.95, 0.95, 0.95, 1.0);
        const mmdRoot = new TransformNode("mmdRoot", scene);
        const mmdCamera = new MmdCamera("mmdCamera", new Vector3(0, 10, 0), scene);
        mmdCamera.maxZ = 5000;
        mmdCamera.parent = mmdRoot;
        const camera = createDefaultArcRotateCamera(scene);
        createCameraSwitch(scene, canvas, camera, mmdCamera);
        const { directionalLight, shadowGenerator } = createLightComponents(scene);
        createDefaultGround(scene);

        const mmdRuntime = new MmdRuntime(new MmdPhysics(scene));
        mmdRuntime.loggingEnabled = true;
        mmdRuntime.register(scene);

        const audioPlayer = new StreamAudioPlayer(scene);
        audioPlayer.preservesPitch = false;
        audioPlayer.source = "res/private_test/motion/kimini_totte/kimini totte.mp3";
        mmdRuntime.setAudioPlayer(audioPlayer);

        mmdRuntime.playAnimation();

        const playerControl = new MmdPlayerControl(scene, mmdRuntime, audioPlayer);
        playerControl.showPlayerControl();

        const bvmdLoader = new BvmdLoader(scene);
        bvmdLoader.loggingEnabled = true;

        const [
            mmdAnimation1,
            mmdAnimation2,
            cameraAnimation,
            modelMesh,
            stageMesh
        ] = await parallelLoadAsync(scene, [
            ["motion1", (updateProgress): Promise<MmdAnimation> => {
                return bvmdLoader.loadAsync("motion1", "res/private_test/motion/kimini_totte/motion_a.bvmd", updateProgress);
            }],
            ["motion2", (updateProgress): Promise<MmdAnimation> => {
                return bvmdLoader.loadAsync("motion2", "res/private_test/motion/kimini_totte/motion_b.bvmd", updateProgress);
            }],
            ["camera", (updateProgress): Promise<MmdAnimation> => {
                return bvmdLoader.loadAsync("camera", "res/private_test/motion/kimini_totte/camera.bvmd", updateProgress);
            }],
            ["model", (updateProgress): Promise<Mesh> => {
                pmxLoader.boundingBoxMargin = 60;
                return SceneLoader.ImportMeshAsync(
                    undefined,
                    "res/private_test/model/",
                    "YYB miku Crown Knight.bpmx",
                    scene,
                    updateProgress
                ).then(result => result.meshes[0] as Mesh);
            }],
            ["stage", (updateProgress): Promise<Mesh> => {
                pmxLoader.boundingBoxMargin = 0;
                pmxLoader.buildSkeleton = false;
                pmxLoader.buildMorph = false;
                return SceneLoader.ImportMeshAsync(
                    undefined,
                    "res/private_test/stage/",
                    "ガラス片ドームB.bpmx",
                    scene,
                    updateProgress
                ).then(result => result.meshes[0] as Mesh);
            }],
            ["physics", async(updateProgress): Promise<void> => {
                updateProgress({ lengthComputable: true, loaded: 0, total: 1 });
                const havokInstance = await havokPhysics();
                const havokPlugin = new HavokPlugin(true, havokInstance);
                scene.enablePhysics(new Vector3(0, -9.8 * 10, 0), havokPlugin);
                updateProgress({ lengthComputable: true, loaded: 1, total: 1 });
            }]
        ]);

        mmdRuntime.setCamera(mmdCamera);
        mmdCamera.addAnimation(cameraAnimation);
        mmdCamera.setAnimation("camera");

        modelMesh.receiveShadows = true;
        shadowGenerator.addShadowCaster(modelMesh);
        modelMesh.parent = mmdRoot;
        const mmdModel = mmdRuntime.createMmdModel(modelMesh, {
            buildPhysics: true
        });
        const compositeAnimation = new MmdCompositeAnimation("composite");
        const animationSpan1 = new MmdAnimationSpan(mmdAnimation1);
        animationSpan1.weight = 1;
        const animationSpan2 = new MmdAnimationSpan(mmdAnimation2);
        animationSpan2.weight = 0;
        compositeAnimation.addSpan(animationSpan1);
        compositeAnimation.addSpan(animationSpan2);
        mmdModel.addAnimation(compositeAnimation);
        mmdModel.setAnimation("composite");

        attachToBone(scene, modelMesh, {
            directionalLightPosition: directionalLight.position,
            cameraTargetPosition: camera.target
        });

        stageMesh.receiveShadows = true;
        stageMesh.position.y += 0.01;

        createGroundCollider(scene);

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
        mmdCameraAutoFocus.setTarget(modelMesh);
        mmdCameraAutoFocus.register(scene);

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
            animationSpan1.weight = 1 - value;
            animationSpan2.weight = value;
        };

        return scene;
    }
}
