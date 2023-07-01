import type { Camera, Engine } from "@babylonjs/core";
import {
    Color3,
    Color4,
    Constants,
    DefaultRenderingPipeline,
    DirectionalLight,
    HavokPlugin,
    HemisphericLight,
    ImageProcessingConfiguration,
    Matrix,
    Mesh,
    MeshBuilder,
    MotionBlurPostProcess,
    Scene,
    SceneLoader,
    ShadowGenerator,
    SkeletonViewer,
    Sound,
    SSAORenderingPipeline,
    SSRRenderingPipeline,
    StandardMaterial,
    UniversalCamera,
    Vector3,
    VertexData
} from "@babylonjs/core";
import HavokPhysics from "@babylonjs/havok";
import { Inspector } from "@babylonjs/inspector";
import { SkyMaterial } from "@babylonjs/materials";

import type { MmdAnimation } from "@/loader/animation/MmdAnimation";
import { BvmdLoader } from "@/loader/optimized/BvmdLoader";
import { PmxLoader } from "@/loader/PmxLoader";
import { SdefInjector } from "@/loader/SdefInjector";
import { MmdCamera } from "@/runtime/MmdCamera";
import { MmdPhysics } from "@/runtime/MmdPhysics";
import { MmdRuntime } from "@/runtime/MmdRuntime";

import type { ISceneBuilder } from "./BaseRuntime";

export class SceneBuilder implements ISceneBuilder {
    public async build(canvas: HTMLCanvasElement, engine: Engine): Promise<Scene> {
        await AudioPermissionSolver.Invoke();

        SdefInjector.OverrideEngineCreateEffect(engine);
        const pmxLoader = new PmxLoader();
        pmxLoader.loggingEnabled = true;
        // materialBuilder.loadDiffuseTexture = (): void => { /* do nothing */ };
        // materialBuilder.loadSphereTexture = (): void => { /* do nothing */ };
        // materialBuilder.loadToonTexture = (): void => { /* do nothing */ };
        // materialBuilder.loadOutlineRenderingProperties = (): void => { /* do nothing */ };
        SceneLoader.RegisterPlugin(pmxLoader);

        const scene = new Scene(engine);
        scene.clearColor = new Color4(1, 1, 1, 1.0);

        const mmdCamera = new MmdCamera("mmdCamera", new Vector3(0, 10, 0), scene);
        mmdCamera.maxZ = 5000;

        const camera = new UniversalCamera("camera1", new Vector3(0, 15, -40), scene);
        camera.maxZ = 5000;
        camera.setTarget(new Vector3(0, 10, 0));
        camera.attachControl(canvas, false);
        camera.keysUp.push("W".charCodeAt(0));
        camera.keysDown.push("S".charCodeAt(0));
        camera.keysLeft.push("A".charCodeAt(0));
        camera.keysRight.push("D".charCodeAt(0));
        camera.inertia = 0;
        camera.angularSensibility = 500;
        camera.speed = 10;

        const hemisphericLight = new HemisphericLight("HemisphericLight", new Vector3(0, 1, 0), scene);
        hemisphericLight.intensity = 0.4;
        hemisphericLight.specular = new Color3(0, 0, 0);
        hemisphericLight.groundColor = new Color3(1, 1, 1);

        const directionalLight = new DirectionalLight("DirectionalLight", new Vector3(0.5, -1, 1), scene);
        directionalLight.intensity = 0.8;
        directionalLight.autoCalcShadowZBounds = false;
        directionalLight.autoUpdateExtends = false;
        directionalLight.shadowMaxZ = 20;
        directionalLight.shadowMinZ = -15;
        directionalLight.orthoTop = 18;
        directionalLight.orthoBottom = -1;
        directionalLight.orthoLeft = -10;
        directionalLight.orthoRight = 10;
        directionalLight.shadowOrthoScale = 0;

        DirectionalLightHelper;
        // const directionalLightHelper = new DirectionalLightHelper(directionalLight, mmdCamera);

        // window.setTimeout(() => {
        //     scene.onAfterRenderObservable.add(() => directionalLightHelper.buildLightHelper());
        // }, 500);

        const shadowGenerator = new ShadowGenerator(1024, directionalLight, true, mmdCamera);
        shadowGenerator.usePercentageCloserFiltering = true;
        shadowGenerator.forceBackFacesOnly = true;
        shadowGenerator.filteringQuality = ShadowGenerator.QUALITY_MEDIUM;
        shadowGenerator.frustumEdgeFalloff = 0.1;

        // MeshBuilder.CreateGround("ground1", { width: 60, height: 60, subdivisions: 2, updatable: false }, scene);
        const skyMaterial = new SkyMaterial("skyMaterial", scene);
        skyMaterial.backFaceCulling = false;
        skyMaterial.inclination = 0;

        const skybox = MeshBuilder.CreateBox("skyBox", { size: 1000.0 }, scene);
        skybox.material = skyMaterial;

        // SceneLoader.LoadAssetContainer(
        //     "res/private_test/model/YYB Hatsune Miku_10th_v1.02.glb",
        //     undefined,
        //     scene,
        //     (container) => {
        //         container;
        //         //container.addAllToScene();
        //     }
        // );

        const mmdRuntime = new MmdRuntime(new MmdPhysics(scene));
        mmdRuntime.loggingEnabled = true;

        const sound = new Sound("sound",
            "res/private_test/motion/flos/flos_YuNi.mp3",
            // "res/private_test/motion/melancholy_night/melancholy_night.mp3",
            scene, () => {
                sound.setPlaybackRate(1.0);
                sound.play();//undefined, 417 / 30);
                mmdRuntime.playAnimation();
                // mmdRuntime.seekAnimation(417);
            }, {
                loop: false,
                autoplay: false
            }
        );

        engine.displayLoadingUI();

        const loadingTexts: string[] = new Array(4).fill("");
        const updateLoadingText = (updateIndex: number, text: string): void => {
            loadingTexts[updateIndex] = text;
            engine.loadingUIText = "<br/><br/><br/><br/>" + loadingTexts.join("<br/><br/>");
        };

        const promises: Promise<any>[] = [];

        const bvmdLoader = new BvmdLoader(scene);
        bvmdLoader.loggingEnabled = true;

        promises.push(bvmdLoader.loadAsync("motion", "res/private_test/motion/flos/combined_with_camera.bvmd",
            (event) => updateLoadingText(0, `Loading motion(flos)... ${event.loaded}/${event.total} (${Math.floor(event.loaded * 100 / event.total)}%)`))
        );

        promises.push(SceneLoader.ImportMeshAsync(
            undefined,
            //"res/private_test/model/YYB Hatsune Miku_10th/YYB Hatsune Miku_10th_v1.02.pmx",
            "res/private_test/model/yyb_deep_canyons_miku/yyb_deep_canyons_miku_face_forward_bakebone.pmx",
            undefined,
            scene,
            (event) => updateLoadingText(1, `Loading model(yyb_deep_canyons_miku)... ${event.loaded}/${event.total} (${Math.floor(event.loaded * 100 / event.total)}%)`)
        ));

        promises.push(SceneLoader.ImportMeshAsync(
            undefined,
            "res/private_test/stage/water_house/water house.pmx",
            undefined,
            scene,
            (event) => updateLoadingText(2, `Loading model(water house)... ${event.loaded}/${event.total} (${Math.floor(event.loaded * 100 / event.total)}%)`)
        ));

        promises.push((async(): Promise<void> => {
            updateLoadingText(3, "Loading physics engine...");
            const havokInstance = await HavokPhysics();
            const havokPlugin = new HavokPlugin(true, havokInstance);
            scene.enablePhysics(new Vector3(0, -9.8, 0), havokPlugin);
            updateLoadingText(3, "Loading physics engine... Done");
        })());

        const loadResults = await Promise.all(promises);

        setTimeout(() => engine.hideLoadingUI(), 0);

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

            const mmdModel = mmdRuntime.createMmdModel(modelMesh);
            mmdModel.addAnimation(loadResults[0] as MmdAnimation);
            mmdModel.setAnimation("motion");

            const bodyBone = modelMesh.skeleton!.bones.find((bone) => bone.name === "センター");

            scene.onBeforeRenderObservable.add(() => {
                bodyBone!.getFinalMatrix()!.getTranslationToRef(directionalLight.position);
                directionalLight.position.y -= 10;
            });

            const viewer = new SkeletonViewer(modelMesh.skeleton!, modelMesh, scene, false, 3, {
                displayMode: SkeletonViewer.DISPLAY_SPHERE_AND_SPURS
            });
            viewer.isEnabled = false;
        }

        mmdRuntime.register(scene);

        Inspector.Show(scene, { });

        const useHavyPostProcess = false;
        const useBasicPostProcess = true;

        if (useHavyPostProcess) {
            const motionBlur = new MotionBlurPostProcess("motionBlur", scene, 1.0, mmdCamera);
            motionBlur.motionStrength = 1;

            const ssaoRatio = {
                ssaoRatio: 0.5, // Ratio of the SSAO post-process, in a lower resolution
                combineRatio: 1.0 // Ratio of the combine post-process (combines the SSAO and the scene)
            };
            const ssao = new SSAORenderingPipeline("ssao", scene, ssaoRatio);
            ssao.fallOff = 0.000001;
            ssao.area = 1;
            ssao.radius = 0.0001;
            ssao.totalStrength = 0.5;
            ssao.base = 0.5;
            scene.postProcessRenderPipelineManager.attachCamerasToRenderPipeline("ssao", mmdCamera);

            const ssr = new SSRRenderingPipeline(
                "ssr",
                scene,
                [mmdCamera],
                false,
                Constants.TEXTURETYPE_UNSIGNED_BYTE
            );
            ssr.thickness = 0.1;
            ssr.selfCollisionNumSkip = 2;
            ssr.enableAutomaticThicknessComputation = true;
            ssr.blurDispersionStrength = 0.03;
            ssr.roughnessFactor = 0.1;
            ssr.samples = 4;
        }

        if (useBasicPostProcess) {
            const defaultPipeline = new DefaultRenderingPipeline("default", true, scene, [mmdCamera]);
            defaultPipeline.samples = 4;
            defaultPipeline.bloomEnabled = true;
            defaultPipeline.chromaticAberrationEnabled = true;
            defaultPipeline.chromaticAberration.aberrationAmount = 1;
            defaultPipeline.depthOfFieldEnabled = false;
            defaultPipeline.fxaaEnabled = true;
            defaultPipeline.imageProcessingEnabled = true;
            defaultPipeline.imageProcessing.toneMappingEnabled = true;
            defaultPipeline.imageProcessing.toneMappingType = ImageProcessingConfiguration.TONEMAPPING_ACES;
            defaultPipeline.imageProcessing.vignetteWeight = 0.5;
            defaultPipeline.imageProcessing.vignetteStretch = 0.5;
            defaultPipeline.imageProcessing.vignetteColor = new Color4(0, 0, 0, 0);
            defaultPipeline.imageProcessing.vignetteEnabled = true;
        }

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

class AudioPermissionSolver {
    public static async Invoke(): Promise<void> {
        let audioTest: HTMLAudioElement|null = new Audio("res/audioTest.mp3");

        try {
            await audioTest.play();
        } catch (error: unknown) {
            if (error instanceof DOMException && error.name === "NotAllowedError") {
                const button = document.createElement("button");
                button.style.position = "absolute";
                button.style.left = "0";
                button.style.top = "0";
                button.style.width = "100%";
                button.style.height = "100%";
                button.style.border = "none";
                button.style.fontSize = "32px";
                button.innerText = "Play";
                document.body.appendChild(button);
                await new Promise<void>((resolve): void => {
                    button.onclick = (): void => {
                        audioTest!.play();
                        audioTest!.remove();
                        audioTest = null;
                        button.remove();
                        resolve();
                    };
                });
            } else {
                throw error;
            }
        }
    }
}
