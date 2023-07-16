import type { Camera,
    Engine} from "@babylonjs/core";
import {
    ArcRotateCamera,
    Color3,
    Color4,
    Constants,
    DefaultRenderingPipeline,
    DepthOfFieldEffectBlurLevel,
    DirectionalLight,    HavokPlugin,
    HemisphericLight,
    ImageProcessingConfiguration,
    Material,
    Matrix,
    Mesh,
    MeshBuilder,
    MotionBlurPostProcess,
    Scene,
    SceneLoader,
    ShadowGenerator,
    SkeletonViewer,
    SSRRenderingPipeline,
    StandardMaterial,
    Vector3,
    VertexData
} from "@babylonjs/core";
import HavokPhysics from "@babylonjs/havok";
import { Inspector } from "@babylonjs/inspector";

import type { MmdAnimation } from "@/loader/animation/MmdAnimation";
import type { MmdStandardMaterialBuilder } from "@/loader/MmdStandardMaterialBuilder";
import { BpmxLoader } from "@/loader/optimized/BpmxLoader";
import { BvmdLoader } from "@/loader/optimized/BvmdLoader";
import { SdefInjector } from "@/loader/SdefInjector";
import { StreamAudioPlayer } from "@/runtime/audio/StreamAudioPlayer";
import { MmdCamera } from "@/runtime/MmdCamera";
import { MmdPhysics } from "@/runtime/MmdPhysics";
import { MmdRuntime } from "@/runtime/MmdRuntime";

import type { ISceneBuilder } from "./BaseRuntime";

export class SceneBuilder implements ISceneBuilder {
    public async build(canvas: HTMLCanvasElement, engine: Engine): Promise<Scene> {
        SdefInjector.OverrideEngineCreateEffect(engine);
        const pmxLoader = new BpmxLoader();
        pmxLoader.loggingEnabled = true;
        const materialBuilder = pmxLoader.materialBuilder as MmdStandardMaterialBuilder;
        materialBuilder.alphaEvaluationResolution = 2048;
        // materialBuilder.loadDiffuseTexture = (): void => { /* do nothing */ };
        // materialBuilder.loadSphereTexture = (): void => { /* do nothing */ };
        // materialBuilder.loadToonTexture = (): void => { /* do nothing */ };
        materialBuilder.loadOutlineRenderingProperties = (): void => { /* do nothing */ };
        materialBuilder.afterBuildSingleMaterial = (material): void => {
            if (material.name.toLowerCase() === "body01") material.transparencyMode = Material.MATERIAL_OPAQUE;
            if (material.name.toLowerCase() === "face02") {
                material.transparencyMode = Material.MATERIAL_ALPHABLEND;
                material.useAlphaFromDiffuseTexture = true;
                material.diffuseTexture!.hasAlpha = true;
            }
            if (material.name.toLowerCase() === "hairshadow") {
                material.transparencyMode = Material.MATERIAL_ALPHABLEND;
                material.alphaMode = Constants.ALPHA_SUBTRACT;
                material.useAlphaFromDiffuseTexture = true;
                material.diffuseTexture!.hasAlpha = true;
            }
        };
        pmxLoader.boundingBoxMargin = 40;
        SceneLoader.RegisterPlugin(pmxLoader);

        const scene = new Scene(engine);
        scene.clearColor = new Color4(0.95, 0.95, 0.95, 1.0);

        const mmdCamera = new MmdCamera("mmdCamera", new Vector3(0, 10, 0), scene);
        mmdCamera.maxZ = 5000;

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

        DirectionalLightHelper;
        // const directionalLightHelper = new DirectionalLightHelper(directionalLight, mmdCamera);

        // window.setTimeout(() => {
        //     scene.onAfterRenderObservable.add(() => directionalLightHelper.buildLightHelper());
        // }, 500);

        const shadowGenerator = new ShadowGenerator(1024, directionalLight, true);
        shadowGenerator.usePercentageCloserFiltering = true;
        shadowGenerator.forceBackFacesOnly = true;
        shadowGenerator.filteringQuality = ShadowGenerator.QUALITY_MEDIUM;
        shadowGenerator.frustumEdgeFalloff = 0.1;

        const ground = MeshBuilder.CreateGround("ground1", { width: 100, height: 100, subdivisions: 2, updatable: false }, scene);
        const groundMaterial = ground.material = new StandardMaterial("groundMaterial", scene);
        groundMaterial.diffuseColor = new Color3(1.02, 1.02, 1.02);
        ground.setEnabled(false);

        const mmdRuntime = new MmdRuntime(new MmdPhysics(scene));
        mmdRuntime.loggingEnabled = true;

        const audioPlayer = new StreamAudioPlayer();
        audioPlayer.preservesPitch = false;
        audioPlayer.source = "res/private_test/motion/shinshoku/shinshoku.mp3";
        mmdRuntime.setAudioPlayer(audioPlayer);

        mmdRuntime.register(scene);
        mmdRuntime.playAnimation();

        { // build player UI
            const outerContainer = canvas.parentElement!;
            outerContainer.style.overflow = "hidden";

            const playerContainer = document.createElement("div");
            playerContainer.style.position = "absolute";
            playerContainer.style.bottom = "0";
            playerContainer.style.left = "0";
            playerContainer.style.width = "100%";
            playerContainer.style.height = "120px";
            playerContainer.style.transition = "transform 0.5s";
            playerContainer.style.overflow = "hidden";
            outerContainer.appendChild(playerContainer);
            const showPlayerContainer = (): void => {
                playerContainer.style.transform = "translateY(0)";
            };
            const hidePlayerContainer = (): void => {
                playerContainer.style.transform = "translateY(50%)";
            };
            let mouseLeaveTimeout: number | null = null;
            playerContainer.onmouseenter = (): void => {
                if (mouseLeaveTimeout !== null) {
                    window.clearTimeout(mouseLeaveTimeout);
                    mouseLeaveTimeout = null;
                }
                showPlayerContainer();
            };
            playerContainer.onmouseleave = (): void => {
                mouseLeaveTimeout = window.setTimeout(hidePlayerContainer, 3000);
            };

            const playerInnerContainer = document.createElement("div");
            playerInnerContainer.style.position = "absolute";
            playerInnerContainer.style.bottom = "0";
            playerInnerContainer.style.left = "0";
            playerInnerContainer.style.width = "100%";
            playerInnerContainer.style.height = "50%";
            playerInnerContainer.style.boxSizing = "border-box";
            playerInnerContainer.style.background = "linear-gradient(rgba(0, 0, 0, 0), rgba(0, 0, 0, 0.3))";
            playerInnerContainer.style.display = "flex";
            playerInnerContainer.style.flexDirection = "column";
            playerContainer.appendChild(playerInnerContainer);

            const playerUpperContainer = document.createElement("div");
            playerUpperContainer.style.width = "100%";
            playerUpperContainer.style.flex = "1";
            playerUpperContainer.style.boxSizing = "border-box";
            playerUpperContainer.style.display = "flex";
            playerUpperContainer.style.flexDirection = "row";
            playerUpperContainer.style.alignItems = "center";
            playerInnerContainer.appendChild(playerUpperContainer);

            const timeSlider = document.createElement("input");
            timeSlider.style.width = "100%";
            timeSlider.style.height = "4px";
            timeSlider.style.border = "none";
            timeSlider.style.opacity = "0.5";
            timeSlider.type = "range";
            timeSlider.min = "0";
            timeSlider.max = mmdRuntime.animationDuration.toString();
            engine.onBeginFrameObservable.add(() => {
                timeSlider.value = mmdRuntime.currentFrameTime.toString();
            });
            mmdRuntime.onAnimationDurationChangedObservable.add(() => {
                timeSlider.max = mmdRuntime.animationDuration.toString();
            });
            timeSlider.oninput = (e): void => {
                e.preventDefault();
                mmdRuntime.seekAnimation(Number(timeSlider.value), true);
            };
            let isPlaySeeking = false;
            timeSlider.onmousedown = (): void => {
                if (mmdRuntime.isAnimationPlaying) {
                    mmdRuntime.pauseAnimation();
                    isPlaySeeking = true;
                }
            };
            timeSlider.onmouseup = (): void => {
                if (isPlaySeeking) {
                    mmdRuntime.playAnimation();
                    isPlaySeeking = false;
                }
            };
            playerUpperContainer.appendChild(timeSlider);

            const playerLowerContainer = document.createElement("div");
            playerLowerContainer.style.width = "100%";
            playerLowerContainer.style.flex = "3";
            playerLowerContainer.style.padding = "0 5px";
            playerLowerContainer.style.boxSizing = "border-box";
            playerLowerContainer.style.display = "flex";
            playerLowerContainer.style.flexDirection = "row";
            playerLowerContainer.style.alignItems = "space-between";
            playerInnerContainer.appendChild(playerLowerContainer);

            const playerLowerLeftContainer = document.createElement("div");
            playerLowerLeftContainer.style.flex = "1";
            playerLowerLeftContainer.style.display = "flex";
            playerLowerLeftContainer.style.flexDirection = "row";
            playerLowerLeftContainer.style.alignItems = "center";
            playerLowerContainer.appendChild(playerLowerLeftContainer);

            const playButton = document.createElement("button");
            playButton.style.width = "40px";
            playButton.style.border = "none";
            playButton.style.backgroundColor = "rgba(0, 0, 0, 0)";
            playButton.style.color = "white";
            playButton.style.fontSize = "18px";
            playButton.innerText = mmdRuntime.isAnimationPlaying ? "❚❚" : "▶";
            playButton.onclick = (): void => {
                if (mmdRuntime.isAnimationPlaying) mmdRuntime.pauseAnimation();
                else mmdRuntime.playAnimation();
            };
            mmdRuntime.onPlayAnimationObservable.add(() => {
                playButton.innerText = "❚❚";
            });
            mmdRuntime.onPauseAnimationObservable.add(() => {
                playButton.innerText = "▶";
            });
            playerLowerLeftContainer.appendChild(playButton);

            const soundButton = document.createElement("button");
            soundButton.style.width = "35px";
            soundButton.style.border = "none";
            soundButton.style.backgroundColor = "rgba(0, 0, 0, 0)";
            soundButton.style.color = "white";
            soundButton.style.fontSize = "20px";
            soundButton.innerText = audioPlayer.muted ? "🔇" : "🔊";
            soundButton.onclick = (): void => {
                if (audioPlayer.muted) {
                    audioPlayer.unmute();
                } else {
                    audioPlayer.mute();
                }
            };
            audioPlayer.onMuteStateChangedObservable.add(() => {
                soundButton.innerText = audioPlayer.muted ? "🔇" : "🔊";
            });
            playerLowerLeftContainer.appendChild(soundButton);

            const volumeSlider = document.createElement("input");
            volumeSlider.style.width = "80px";
            volumeSlider.style.height = "4px";
            volumeSlider.style.border = "none";
            volumeSlider.style.opacity = "0.5";
            volumeSlider.type = "range";
            volumeSlider.min = "0";
            volumeSlider.max = "1";
            volumeSlider.step = "0.01";
            volumeSlider.value = audioPlayer.volume.toString();
            volumeSlider.oninput = (): void => {
                audioPlayer.volume = Number(volumeSlider.value);
            };
            playerLowerLeftContainer.appendChild(volumeSlider);

            const frameNumber = document.createElement("span");
            frameNumber.style.width = "60px";
            frameNumber.style.textAlign = "center";
            frameNumber.style.color = "white";
            engine.onBeginFrameObservable.add(() => {
                frameNumber.innerText = Math.floor(mmdRuntime.currentFrameTime).toString();
            });
            playerLowerLeftContainer.appendChild(frameNumber);

            const playerLowerRightContainer = document.createElement("div");
            playerLowerRightContainer.style.flex = "1";
            playerLowerRightContainer.style.display = "flex";
            playerLowerRightContainer.style.flexDirection = "row";
            playerLowerRightContainer.style.alignItems = "center";
            playerLowerRightContainer.style.justifyContent = "flex-end";
            playerLowerContainer.appendChild(playerLowerRightContainer);

            const speedLabel = document.createElement("label");
            speedLabel.style.width = "40px";
            speedLabel.style.textAlign = "center";
            speedLabel.style.color = "white";
            speedLabel.innerText = "1.00x";
            playerLowerRightContainer.appendChild(speedLabel);
            const speedSlider = document.createElement("input");
            speedSlider.style.width = "80px";
            speedSlider.style.height = "4px";
            speedSlider.style.border = "none";
            speedSlider.style.opacity = "0.5";
            speedSlider.type = "range";
            speedSlider.min = "0.07";
            speedSlider.max = "1";
            speedSlider.step = "0.01";
            speedSlider.value = mmdRuntime.timeScale.toString();
            speedSlider.oninput = (): void => {
                mmdRuntime.timeScale = Number(speedSlider.value);
                speedLabel.innerText = mmdRuntime.timeScale.toFixed(2) + "x";
            };
            playerLowerRightContainer.appendChild(speedSlider);

            const fullscreenButton = document.createElement("button");
            fullscreenButton.style.width = "40px";
            fullscreenButton.style.border = "none";
            fullscreenButton.style.color = "white";
            fullscreenButton.style.backgroundColor = "rgba(0, 0, 0, 0)";
            fullscreenButton.style.fontSize = "20px";
            fullscreenButton.innerText = "🗖";
            fullscreenButton.onclick = (): void => {
                if (document.fullscreenElement) {
                    document.exitFullscreen();
                } else {
                    outerContainer.requestFullscreen();
                }
            };
            playerLowerRightContainer.appendChild(fullscreenButton);
        }

        engine.displayLoadingUI();

        let loadingTexts: string[] = [];
        const updateLoadingText = (updateIndex: number, text: string): void => {
            loadingTexts[updateIndex] = text;
            engine.loadingUIText = "<br/><br/><br/><br/>" + loadingTexts.join("<br/><br/>");
        };

        const promises: Promise<any>[] = [];

        const bvmdLoader = new BvmdLoader(scene);
        bvmdLoader.loggingEnabled = true;

        promises.push(bvmdLoader.loadAsync("motion", "res/private_test/motion/shinshoku/motion.bvmd",
            (event) => updateLoadingText(0, `Loading motion... ${event.loaded}/${event.total} (${Math.floor(event.loaded * 100 / event.total)}%)`))
        );

        promises.push(SceneLoader.ImportMeshAsync(
            undefined,
            "res/private_test/model/YYB miku Crown Knight.bpmx",
            undefined,
            scene,
            (event) => updateLoadingText(1, `Loading model... ${event.loaded}/${event.total} (${Math.floor(event.loaded * 100 / event.total)}%)`)
        ));

        pmxLoader.buildSkeleton = false;
        pmxLoader.buildMorph = false;
        promises.push(SceneLoader.ImportMeshAsync(
            undefined,
            "res/private_test/stage/碇と桜のステージ.bpmx",
            undefined,
            scene,
            (event) => updateLoadingText(2, `Loading stage... ${event.loaded}/${event.total} (${Math.floor(event.loaded * 100 / event.total)}%)`)
        ));

        promises.push((async(): Promise<void> => {
            updateLoadingText(3, "Loading physics engine...");
            const havokInstance = await HavokPhysics();
            const havokPlugin = new HavokPlugin(true, havokInstance);
            scene.enablePhysics(new Vector3(0, -9.8, 0), havokPlugin);
            updateLoadingText(3, "Loading physics engine... Done");
        })());

        loadingTexts = new Array(promises.length).fill("");

        const loadResults = await Promise.all(promises);

        mmdRuntime.setManualAnimationDuration((loadResults[0] as MmdAnimation).endFrame);

        scene.onAfterRenderObservable.addOnce(() => engine.hideLoadingUI());

        scene.meshes.forEach((mesh) => {
            if (mesh.name === "skyBox") return;
            mesh.receiveShadows = true;
            shadowGenerator.addShadowCaster(mesh);
        });

        mmdRuntime.setCamera(mmdCamera);
        mmdCamera.addAnimation(loadResults[0] as MmdAnimation);
        mmdCamera.setAnimation("motion");

        {
            const modelMesh = loadResults[1].meshes[0] as Mesh;

            const mmdModel = mmdRuntime.createMmdModel(modelMesh, {
                buildPhysics: true
            });
            mmdModel.addAnimation(loadResults[0] as MmdAnimation);
            mmdModel.setAnimation("motion");

            const bodyBone = modelMesh.skeleton!.bones.find((bone) => bone.name === "センター");
            scene.onBeforeRenderObservable.add(() => {
                bodyBone!.getFinalMatrix().getTranslationToRef(directionalLight.position);
                directionalLight.position.y -= 10;

                camera.target.copyFrom(directionalLight.position);
                camera.target.y += 13;
            });

            const viewer = new SkeletonViewer(modelMesh.skeleton!, modelMesh, scene, false, 3, {
                displayMode: SkeletonViewer.DISPLAY_SPHERE_AND_SPURS
            });
            viewer.isEnabled = false;
        }

        const mmdStageMesh = loadResults[2].meshes[0] as Mesh;
        mmdStageMesh.position.y += 0.01;

        // const groundRigidBody = new PhysicsBody(ground, PhysicsMotionType.STATIC, true, scene);
        // groundRigidBody.shape = new PhysicsShapeBox(
        //     new Vector3(0, -1, 0),
        //     new Quaternion(),
        //     new Vector3(100, 2, 100), scene);

        // {
        //     const physicsViewer = new PhysicsViewer(scene);
        //     const modelMesh = loadResults[1].meshes[0] as Mesh;
        //     for (const node of modelMesh.getChildren()) {
        //         if ((node as any).physicsBody) {
        //             physicsViewer.showBody((node as any).physicsBody);
        //         }
        //     }
        //     physicsViewer.showBody(groundRigidBody);
        // }

        const useHavyPostProcess = false;
        const useBasicPostProcess = true;

        if (useHavyPostProcess) {
            const motionBlur = new MotionBlurPostProcess("motionBlur", scene, 1.0, camera);
            motionBlur.motionStrength = 1;

            const ssr = new SSRRenderingPipeline(
                "ssr",
                scene,
                [mmdCamera, camera],
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
        }

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
            defaultPipeline.depthOfField.focalLength = 30;

            const modelMesh = loadResults[1].meshes[0] as Mesh;
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

        Inspector.Show(scene, { });

        return scene;
    }
}


class DirectionalLightHelper {
    public readonly scene: Scene;
    public readonly light: DirectionalLight;
    public readonly camera: Camera;
    private readonly _viewMatrix: Matrix;
    private _lightHelperFrustumLines: any[];

    private _oldPosition: Vector3;
    private _oldDirection: Vector3;
    private _oldAutoCalc: boolean;
    private _oldMinZ: number;
    private _oldMaxZ: number;

    public constructor(light: DirectionalLight, camera: Camera) {
        this.scene = light.getScene();
        this.light = light;
        this.camera = camera;
        this._viewMatrix = Matrix.Identity();
        this._lightHelperFrustumLines = [];

        this._oldPosition = new Vector3(Number.MAX_VALUE, Number.MAX_VALUE, Number.MAX_VALUE);
        this._oldDirection = new Vector3(Number.MAX_VALUE, Number.MAX_VALUE, Number.MAX_VALUE);
        this._oldAutoCalc = false;
        this._oldMinZ = Number.MAX_VALUE;
        this._oldMaxZ = Number.MAX_VALUE;
    }

    public getLightExtents(): { min: Vector3, max: Vector3 } {
        const light = this.light as any;

        return {
            "min": new Vector3(light._orthoLeft, light._orthoBottom, light.shadowMinZ !== undefined ? light.shadowMinZ : this.camera.minZ),
            "max": new Vector3(light._orthoRight, light._orthoTop, light.shadowMaxZ !== undefined ? light.shadowMaxZ : this.camera.maxZ)
        };
    }

    public getViewMatrix(): Matrix {
        // same computation here than in the shadow generator
        Matrix.LookAtLHToRef(this.light.position, this.light.position.add(this.light.direction), Vector3.Up(), this._viewMatrix);
        return this._viewMatrix;
    }

    public buildLightHelper(): void {
        if (this._oldPosition
            && this._oldPosition.equals(this.light.position)
            && this._oldDirection.equals(this.light.direction)
            && this._oldAutoCalc === this.light.autoCalcShadowZBounds
            && this._oldMinZ === this.light.shadowMinZ
            && this._oldMaxZ === this.light.shadowMaxZ
        ) {
            return;
        }

        this._oldPosition = this.light.position;
        this._oldDirection = this.light.direction;
        this._oldAutoCalc = this.light.autoCalcShadowZBounds;
        this._oldMinZ = this.light.shadowMinZ;
        this._oldMaxZ = this.light.shadowMaxZ;

        this._lightHelperFrustumLines.forEach((mesh) => {
            mesh.dispose();
        });

        this._lightHelperFrustumLines = [];

        const lightExtents = this.getLightExtents();
        const lightView = this.getViewMatrix();

        if (!lightExtents || !lightView) {
            return;
        }

        const invLightView = Matrix.Invert(lightView);

        const n1 = new Vector3(lightExtents.max.x, lightExtents.max.y, lightExtents.min.z);
        const n2 = new Vector3(lightExtents.max.x, lightExtents.min.y, lightExtents.min.z);
        const n3 = new Vector3(lightExtents.min.x, lightExtents.min.y, lightExtents.min.z);
        const n4 = new Vector3(lightExtents.min.x, lightExtents.max.y, lightExtents.min.z);

        const near1 = Vector3.TransformCoordinates(n1, invLightView);
        const near2 = Vector3.TransformCoordinates(n2, invLightView);
        const near3 = Vector3.TransformCoordinates(n3, invLightView);
        const near4 = Vector3.TransformCoordinates(n4, invLightView);

        const f1 = new Vector3(lightExtents.max.x, lightExtents.max.y, lightExtents.max.z);
        const f2 = new Vector3(lightExtents.max.x, lightExtents.min.y, lightExtents.max.z);
        const f3 = new Vector3(lightExtents.min.x, lightExtents.min.y, lightExtents.max.z);
        const f4 = new Vector3(lightExtents.min.x, lightExtents.max.y, lightExtents.max.z);

        const far1 = Vector3.TransformCoordinates(f1, invLightView);
        const far2 = Vector3.TransformCoordinates(f2, invLightView);
        const far3 = Vector3.TransformCoordinates(f3, invLightView);
        const far4 = Vector3.TransformCoordinates(f4, invLightView);

        this._lightHelperFrustumLines.push(MeshBuilder.CreateLines("nearlines", { points: [near1, near2, near3, near4, near1] }, this.scene));
        this._lightHelperFrustumLines.push(MeshBuilder.CreateLines("farlines",  { points: [far1, far2, far3, far4, far1] }, this.scene));
        this._lightHelperFrustumLines.push(MeshBuilder.CreateLines("trlines", { points: [ near1, far1 ] }, this.scene));
        this._lightHelperFrustumLines.push(MeshBuilder.CreateLines("brlines", { points: [ near2, far2 ] }, this.scene));
        this._lightHelperFrustumLines.push(MeshBuilder.CreateLines("tllines", { points: [ near3, far3 ] }, this.scene));
        this._lightHelperFrustumLines.push(MeshBuilder.CreateLines("bllines", { points: [ near4, far4 ] }, this.scene));

        const makePlane = (name: string, color: Color3, positions: number[]): void => {
            const plane = new Mesh(name + "plane", this.scene),
                mat = new StandardMaterial(name + "PlaneMat", this.scene);

            plane.material = mat;

            mat.emissiveColor = color;
            mat.alpha = 0.3;
            mat.backFaceCulling = false;
            mat.disableLighting = true;

            const indices = [0, 1, 2, 0, 2, 3];

            const vertexData = new VertexData();

            vertexData.positions = positions;
            vertexData.indices = indices;

            vertexData.applyToMesh(plane);

            this._lightHelperFrustumLines.push(plane);
        };

        makePlane("near",   new Color3(1, 0, 0),    [near1.x, near1.y, near1.z, near2.x, near2.y, near2.z, near3.x, near3.y, near3.z, near4.x, near4.y, near4.z ]);
        makePlane("far",    new Color3(0.3, 0, 0),  [far1.x, far1.y, far1.z, far2.x, far2.y, far2.z, far3.x, far3.y, far3.z, far4.x, far4.y, far4.z ]);
        makePlane("right",  new Color3(0, 1, 0),    [near1.x, near1.y, near1.z, far1.x, far1.y, far1.z, far2.x, far2.y, far2.z, near2.x, near2.y, near2.z ]);
        makePlane("left",   new Color3(0, 0.3, 0),  [near4.x, near4.y, near4.z, far4.x, far4.y, far4.z, far3.x, far3.y, far3.z, near3.x, near3.y, near3.z ]);
        makePlane("top",    new Color3(0, 0, 1),    [near1.x, near1.y, near1.z, far1.x, far1.y, far1.z, far4.x, far4.y, far4.z, near4.x, near4.y, near4.z ]);
        makePlane("bottom", new Color3(0, 0, 0.3),  [near2.x, near2.y, near2.z, far2.x, far2.y, far2.z, far3.x, far3.y, far3.z, near3.x, near3.y, near3.z ]);
    }
}
