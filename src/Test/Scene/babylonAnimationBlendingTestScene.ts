import "@babylonjs/core/Animations/animatable";
import "@babylonjs/core/Loading/loadingScreen";
import "@babylonjs/core/Lights/Shadows/shadowGeneratorSceneComponent";
import "@babylonjs/core/Rendering/depthRendererSceneComponent";
import "@/Loader/Optimized/bpmxLoader";
import "@/Runtime/Animation/mmdRuntimeCameraAnimationGroup";
import "@/Runtime/Animation/mmdRuntimeModelAnimationGroup";

import { ArcRotateCamera } from "@babylonjs/core/Cameras/arcRotateCamera";
import { SkeletonViewer } from "@babylonjs/core/Debug/skeletonViewer";
import { Constants } from "@babylonjs/core/Engines/constants";
import type { Engine } from "@babylonjs/core/Engines/engine";
import { DirectionalLight } from "@babylonjs/core/Lights/directionalLight";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { ShadowGenerator } from "@babylonjs/core/Lights/Shadows/shadowGenerator";
import { SceneLoader } from "@babylonjs/core/Loading/sceneLoader";
import { ImageProcessingConfiguration } from "@babylonjs/core/Materials/imageProcessingConfiguration";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Color3, Color4 } from "@babylonjs/core/Maths/math.color";
import { Matrix, Quaternion, Vector3 } from "@babylonjs/core/Maths/math.vector";
import { CreateGround } from "@babylonjs/core/Meshes/Builders/groundBuilder";
import type { Mesh } from "@babylonjs/core/Meshes/mesh";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { PhysicsMotionType } from "@babylonjs/core/Physics/v2/IPhysicsEnginePlugin";
import { PhysicsBody } from "@babylonjs/core/Physics/v2/physicsBody";
import { PhysicsShapeBox } from "@babylonjs/core/Physics/v2/physicsShape";
import { HavokPlugin } from "@babylonjs/core/Physics/v2/Plugins/havokPlugin";
import { DepthOfFieldEffectBlurLevel } from "@babylonjs/core/PostProcesses/depthOfFieldEffect";
import { DefaultRenderingPipeline } from "@babylonjs/core/PostProcesses/RenderPipeline/Pipelines/defaultRenderingPipeline";
import { Scene } from "@babylonjs/core/scene";
import HavokPhysics from "@babylonjs/havok";

import type { MmdAnimation } from "@/Loader/Animation/mmdAnimation";
import { MmdCameraAnimationGroup, MmdCameraAnimationGroupBezierBuilder } from "@/Loader/Animation/mmdCameraAnimationGroup";
import { MmdModelAnimationGroup, MmdModelAnimationGroupBezierBuilder } from "@/Loader/Animation/mmdModelAnimationGroup";
import type { MmdStandardMaterialBuilder } from "@/Loader/mmdStandardMaterialBuilder";
import type { BpmxLoader } from "@/Loader/Optimized/bpmxLoader";
import { BvmdLoader } from "@/Loader/Optimized/bvmdLoader";
import { SdefInjector } from "@/Loader/sdefInjector";
import { StreamAudioPlayer } from "@/Runtime/Audio/streamAudioPlayer";
import { MmdCamera } from "@/Runtime/mmdCamera";
import { MmdPhysics } from "@/Runtime/mmdPhysics";
import { MmdRuntime } from "@/Runtime/mmdRuntime";

import type { ISceneBuilder } from "../baseRuntime";

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
        materialBuilder.afterBuildSingleMaterial = (material): void => {
            if (material.name.toLowerCase() === "hairshadow") {
                material.alphaMode = Constants.ALPHA_SUBTRACT;
            }
            material.useLogarithmicDepth = true;
        };

        const scene = new Scene(engine);
        scene.clearColor = new Color4(0.95, 0.95, 0.95, 1.0);

        const mmdCamera = new MmdCamera("mmdCamera", new Vector3(0, 10, 0), scene);
        mmdCamera.maxZ = 5000;

        const mmdRoot = new TransformNode("mmdRoot", scene);
        mmdCamera.parent = mmdRoot;
        mmdRoot.position.z -= 0;

        const camera = new ArcRotateCamera("arcRotateCamera", 0, 0, 45, new Vector3(0, 10, 0), scene);
        camera.maxZ = 5000;
        camera.setPosition(new Vector3(0, 10, -45));
        camera.attachControl(canvas, false);
        camera.inertia = 0.8;
        camera.speed = 10;

        const hemisphericLight = new HemisphericLight("hemisphericLight", new Vector3(0, 1, 0), scene);
        hemisphericLight.intensity = 0.4;
        hemisphericLight.specular = new Color3(0, 0, 0);
        hemisphericLight.groundColor = new Color3(1, 1, 1);

        const directionalLight = new DirectionalLight("directionalLight", new Vector3(0.5, -1, 1), scene);
        directionalLight.intensity = 0.8;
        directionalLight.autoCalcShadowZBounds = false;
        directionalLight.autoUpdateExtends = false;
        directionalLight.shadowMaxZ = 20;
        directionalLight.shadowMinZ = -20;
        directionalLight.orthoTop = 18;
        directionalLight.orthoBottom = -3;
        directionalLight.orthoLeft = -10;
        directionalLight.orthoRight = 10;
        directionalLight.shadowOrthoScale = 0;

        // const directionalLightFrustumViewer = new DirectionalLightFrustumViewer(directionalLight, mmdCamera);
        // scene.onBeforeRenderObservable.add(() => directionalLightFrustumViewer.update());

        const shadowGenerator = new ShadowGenerator(1024, directionalLight, true);
        shadowGenerator.usePercentageCloserFiltering = true;
        shadowGenerator.forceBackFacesOnly = false;
        shadowGenerator.bias = 0.01;
        shadowGenerator.filteringQuality = ShadowGenerator.QUALITY_MEDIUM;
        shadowGenerator.frustumEdgeFalloff = 0.1;

        const ground = CreateGround("ground1", { width: 120, height: 120, subdivisions: 2, updatable: false }, scene);
        const groundMaterial = ground.material = new StandardMaterial("groundMaterial", scene);
        groundMaterial.diffuseColor = new Color3(1.02, 1.02, 1.02);
        groundMaterial.useLogarithmicDepth = true;

        const mmdRuntime = new MmdRuntime(new MmdPhysics(scene));
        mmdRuntime.loggingEnabled = true;

        mmdRuntime.register(scene);

        engine.displayLoadingUI();

        let loadingTexts: string[] = [];
        const updateLoadingText = (updateIndex: number, text: string): void => {
            loadingTexts[updateIndex] = text;
            engine.loadingUIText = "<br/><br/><br/><br/>" + loadingTexts.join("<br/><br/>");
        };

        const promises: Promise<any>[] = [];

        const bvmdLoader = new BvmdLoader(scene);
        bvmdLoader.loggingEnabled = true;

        promises.push(bvmdLoader.loadAsync("motion1", "res/private_test/motion/intergalactia/intergalactia.bvmd",
            (event) => updateLoadingText(0, `Loading motion1... ${event.loaded}/${event.total} (${Math.floor(event.loaded * 100 / event.total)}%)`))
        );

        promises.push(bvmdLoader.loadAsync("motion2", "res/private_test/motion/conqueror/motion_light.bvmd",
            (event) => updateLoadingText(1, `Loading motion2... ${event.loaded}/${event.total} (${Math.floor(event.loaded * 100 / event.total)}%)`))
        );

        pmxLoader.boundingBoxMargin = 60;
        promises.push(SceneLoader.ImportMeshAsync(
            undefined,
            "res/private_test/model/",
            "YYB miku Crown Knight.bpmx",
            scene,
            (event) => updateLoadingText(2, `Loading model... ${event.loaded}/${event.total} (${Math.floor(event.loaded * 100 / event.total)}%)`)
        ));

        pmxLoader.boundingBoxMargin = 0;
        pmxLoader.buildSkeleton = false;
        pmxLoader.buildMorph = false;
        promises.push(SceneLoader.ImportMeshAsync(
            undefined,
            "res/private_test/stage/",
            "ガラス片ドームB.bpmx",
            scene,
            (event) => updateLoadingText(3, `Loading stage... ${event.loaded}/${event.total} (${Math.floor(event.loaded * 100 / event.total)}%)`)
        ));

        promises.push((async(): Promise<void> => {
            updateLoadingText(4, "Loading physics engine...");
            const havokInstance = await HavokPhysics();
            const havokPlugin = new HavokPlugin(true, havokInstance);
            scene.enablePhysics(new Vector3(0, -9.8 * 10, 0), havokPlugin);
            updateLoadingText(4, "Loading physics engine... Done");
        })());

        loadingTexts = new Array(promises.length).fill("");

        const loadResults = await Promise.all(promises);

        scene.onAfterRenderObservable.addOnce(() => engine.hideLoadingUI());

        scene.meshes.forEach((mesh) => {
            if (mesh.name === "skyBox") return;
            mesh.receiveShadows = true;
            shadowGenerator.addShadowCaster(mesh);
        });

        const modelMesh = loadResults[2].meshes[0] as Mesh;
        modelMesh.parent = mmdRoot;

        const mmdModel = mmdRuntime.createMmdModel(modelMesh, {
            buildPhysics: true
        });

        // disable ik solver for motion captured assets
        const disableIkBones = [ "右足ＩＫ", "右つま先ＩＫ", "左足ＩＫ", "左つま先ＩＫ", "右ひじＩＫ", "左ひじＩＫ" ];
        const runtimeBones = mmdModel.sortedRuntimeBones;
        for (let i = 0; i < runtimeBones.length; ++i) {
            const runtimeBone = runtimeBones[i];
            if (disableIkBones.includes(runtimeBone.name)) {
                if (runtimeBone.ikSolver) runtimeBone.ikSolver.enabled = false;
            }
        }

        const audioPlayer1 = new StreamAudioPlayer(scene);
        audioPlayer1.source = "res/private_test/motion/intergalactia/INTERGALACTIA.mp3";

        const audioPlayer2 = new StreamAudioPlayer(scene);
        audioPlayer2.source = "res/private_test/motion/conqueror/MMDConquerorIA.mp3";

        const mmdAnimation1 = loadResults[0] as MmdAnimation;
        const mmdAnimation2 = loadResults[1] as MmdAnimation;

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

        {

            const bodyBone = modelMesh.skeleton!.bones.find((bone) => bone.name === "センター");
            const meshWorldMatrix = modelMesh.getWorldMatrix();
            const boneWorldMatrix = new Matrix();
            scene.onBeforeRenderObservable.add(() => {
                boneWorldMatrix.copyFrom(bodyBone!.getFinalMatrix()).multiplyToRef(meshWorldMatrix, boneWorldMatrix);
                boneWorldMatrix.getTranslationToRef(directionalLight.position);
                directionalLight.position.y -= 10;

                camera.target.copyFrom(directionalLight.position);
                camera.target.y += 13;
            });

            const viewer = new SkeletonViewer(modelMesh.skeleton!, modelMesh, scene, false, 3, {
                displayMode: SkeletonViewer.DISPLAY_SPHERE_AND_SPURS
            });
            viewer.isEnabled = false;
        }

        const mmdStageMesh = loadResults[3].meshes[0] as Mesh;
        mmdStageMesh.receiveShadows = true;
        mmdStageMesh.position.y += 0.01;

        const groundRigidBody = new PhysicsBody(ground, PhysicsMotionType.STATIC, true, scene);
        groundRigidBody.shape = new PhysicsShapeBox(
            new Vector3(0, -1, 0),
            new Quaternion(),
            new Vector3(100, 2, 100), scene);

        const useBasicPostProcess = true;

        if (useBasicPostProcess) {
            const defaultPipeline = new DefaultRenderingPipeline("default", true, scene, [mmdCamera, camera]);
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

            defaultPipeline.depthOfField.fStop = 0.05;
            defaultPipeline.depthOfField.focalLength = 20;

            // note: this dof distance compute will broken when camera and mesh is not in same space

            const modelMesh = loadResults[2].meshes[0] as Mesh;
            const headBone = modelMesh.skeleton!.bones.find((bone) => bone.name === "頭");

            const rotationMatrix = new Matrix();
            const cameraNormal = new Vector3();
            const cameraEyePosition = new Vector3();
            const headRelativePosition = new Vector3();

            scene.onBeforeRenderObservable.add(() => {
                const cameraRotation = mmdCamera.rotation;
                Matrix.RotationYawPitchRollToRef(-cameraRotation.y, -cameraRotation.x, -cameraRotation.z, rotationMatrix);

                Vector3.TransformNormalFromFloatsToRef(0, 0, 1, rotationMatrix, cameraNormal);

                mmdCamera.position.addToRef(
                    Vector3.TransformCoordinatesFromFloatsToRef(0, 0, mmdCamera.distance, rotationMatrix, cameraEyePosition),
                    cameraEyePosition
                );

                headBone!.getFinalMatrix().getTranslationToRef(headRelativePosition)
                    .subtractToRef(cameraEyePosition, headRelativePosition);

                defaultPipeline.depthOfField.focusDistance = (Vector3.Dot(headRelativePosition, cameraNormal) / Vector3.Dot(cameraNormal, cameraNormal)) * 1000;
            });

            let lastClickTime = -Infinity;
            canvas.onclick = (): void => {
                const currentTime = performance.now();
                if (500 < currentTime - lastClickTime) {
                    lastClickTime = currentTime;
                    return;
                }

                lastClickTime = -Infinity;

                if (scene.activeCamera === mmdCamera) {
                    defaultPipeline.depthOfFieldEnabled = false;
                    scene.activeCamera = camera;
                } else {
                    defaultPipeline.depthOfFieldEnabled = true;
                    scene.activeCamera = mmdCamera;
                }
            };
        }

        // Inspector.Show(scene, { });

        return scene;
    }
}
