import "@babylonjs/core/Loading/loadingScreen";
import "@babylonjs/core/Lights/Shadows/shadowGeneratorSceneComponent";
import "@babylonjs/core/Rendering/prePassRendererSceneComponent";
import "@babylonjs/core/Rendering/depthRendererSceneComponent";
import "@babylonjs/core/Rendering/geometryBufferRendererSceneComponent";

import { ArcRotateCamera } from "@babylonjs/core/Cameras/arcRotateCamera";
import type { Camera } from "@babylonjs/core/Cameras/camera";
import { SkeletonViewer } from "@babylonjs/core/Debug/skeletonViewer";
import { Constants } from "@babylonjs/core/Engines/constants";
import type { Engine } from "@babylonjs/core/Engines/engine";
import { DirectionalLight } from "@babylonjs/core/Lights/directionalLight";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { ShadowGenerator } from "@babylonjs/core/Lights/Shadows/shadowGenerator";
import { SceneLoader } from "@babylonjs/core/Loading/sceneLoader";
import { ImageProcessingConfiguration } from "@babylonjs/core/Materials/imageProcessingConfiguration";
import { Material } from "@babylonjs/core/Materials/material";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Color3, Color4 } from "@babylonjs/core/Maths/math.color";
import { Matrix, Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { VertexData } from "@babylonjs/core/Meshes/mesh.vertexData";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
// import { HavokPlugin } from "@babylonjs/core/Physics/v2/Plugins/havokPlugin";
import { DepthOfFieldEffectBlurLevel } from "@babylonjs/core/PostProcesses/depthOfFieldEffect";
import { DefaultRenderingPipeline } from "@babylonjs/core/PostProcesses/RenderPipeline/Pipelines/defaultRenderingPipeline";
import { SSRRenderingPipeline } from "@babylonjs/core/PostProcesses/RenderPipeline/Pipelines/ssrRenderingPipeline";
import { Scene } from "@babylonjs/core/scene";

// import HavokPhysics from "@babylonjs/havok";
import type { MmdAnimation } from "@/Loader/Animation/mmdAnimation";
import type { MmdStandardMaterialBuilder } from "@/Loader/mmdStandardMaterialBuilder";
import { BpmxLoader } from "@/Loader/Optimized/bpmxLoader";
import { BvmdLoader } from "@/Loader/Optimized/bvmdLoader";
import { SdefInjector } from "@/Loader/sdefInjector";
import { StreamAudioPlayer } from "@/Runtime/Audio/streamAudioPlayer";
import { MmdCamera } from "@/Runtime/mmdCamera";
import { MmdPhysics } from "@/Runtime/mmdPhysics";
import { MmdRuntime } from "@/Runtime/mmdRuntime";
import { MmdPlayerControl } from "@/Runtime/Util/mmdPlayerControl";

import type { ISceneBuilder } from "./baseRuntime";

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
            if (material.name.toLowerCase() === "t_floor.bmp") {
                material.specularColor = new Color3(1, 1, 1);
                material.specularPower = 10;
            }
            if (material.name.toLowerCase() === "lace") {
                material.transparencyMode = Material.MATERIAL_ALPHATEST;
            }
            if (material.name.toLowerCase() === "socks") {
                material.transparencyMode = Material.MATERIAL_OPAQUE;
            }
            if (material.name === "ガラス破片") {
                material.transparencyMode = Material.MATERIAL_ALPHATESTANDBLEND;
                material.alphaCutOff = 0;
            }

            material.useLogarithmicDepth = true;
        };
        pmxLoader.boundingBoxMargin = 60;
        SceneLoader.RegisterPlugin(pmxLoader);

        const scene = new Scene(engine);
        scene.clearColor = new Color4(0.95, 0.95, 0.95, 1.0);

        const mmdCamera = new MmdCamera("mmdCamera", new Vector3(0, 10, 0), scene);
        mmdCamera.maxZ = 5000;

        const mmdRoot = new TransformNode("mmdRoot", scene);
        mmdCamera.parent = mmdRoot;
        mmdRoot.position.z -= 50;

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
        shadowGenerator.forceBackFacesOnly = false;
        shadowGenerator.bias = 0.01;
        shadowGenerator.filteringQuality = ShadowGenerator.QUALITY_MEDIUM;
        shadowGenerator.frustumEdgeFalloff = 0.1;

        const ground = MeshBuilder.CreateGround("ground1", { width: 120, height: 120, subdivisions: 2, updatable: false }, scene);
        const groundMaterial = ground.material = new StandardMaterial("groundMaterial", scene);
        groundMaterial.diffuseColor = new Color3(1.02, 1.02, 1.02);
        ground.setEnabled(true);

        const mmdRuntime = new MmdRuntime(new MmdPhysics(scene));
        mmdRuntime.loggingEnabled = true;

        const audioPlayer = new StreamAudioPlayer(scene);
        audioPlayer.preservesPitch = false;
        audioPlayer.source = "res/private_test/motion/pizzicato_drops/pizzicato_drops.mp3";
        mmdRuntime.setAudioPlayer(audioPlayer);

        mmdRuntime.register(scene);
        mmdRuntime.playAnimation();

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

        promises.push(bvmdLoader.loadAsync("motion", "res/private_test/motion/pizzicato_drops/motion_piano_physics.bvmd",
            (event) => updateLoadingText(0, `Loading motion... ${event.loaded}/${event.total} (${Math.floor(event.loaded * 100 / event.total)}%)`))
        );

        promises.push(SceneLoader.ImportMeshAsync(
            undefined,
            "res/private_test/model/YYB Piano dress Miku Collision fix FF BF.bpmx",
            undefined,
            scene,
            (event) => updateLoadingText(1, `Loading model... ${event.loaded}/${event.total} (${Math.floor(event.loaded * 100 / event.total)}%)`)
        ));

        pmxLoader.buildSkeleton = false;
        pmxLoader.buildMorph = false;
        promises.push(SceneLoader.ImportMeshAsync(
            undefined,
            "res/private_test/stage/ガラス片ドームB.bpmx",
            undefined,
            scene,
            (event) => updateLoadingText(2, `Loading stage... ${event.loaded}/${event.total} (${Math.floor(event.loaded * 100 / event.total)}%)`)
        ));

        // promises.push((async(): Promise<void> => {
        //     updateLoadingText(3, "Loading physics engine...");
        //     const havokInstance = await HavokPhysics();
        //     const havokPlugin = new HavokPlugin(true, havokInstance);
        //     scene.enablePhysics(new Vector3(0, -9.8, 0), havokPlugin);
        //     updateLoadingText(3, "Loading physics engine... Done");
        // })());

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
            modelMesh.parent = mmdRoot;

            const mmdModel = mmdRuntime.createMmdModel(modelMesh, {
                buildPhysics: false
            });
            mmdModel.addAnimation(loadResults[0] as MmdAnimation);
            mmdModel.setAnimation("motion");

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

        const useHavyPostProcess = true;
        const useBasicPostProcess = true;

        if (useHavyPostProcess) {
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
            defaultPipeline.depthOfField.focalLength = 20;

            // note: this dof distance compute will broken when camera and mesh is not in same space

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

        // Inspector.Show(scene, { });

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
