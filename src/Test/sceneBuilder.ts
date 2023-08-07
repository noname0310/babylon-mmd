import "@babylonjs/core/Loading/loadingScreen";
import "@babylonjs/core/Lights/Shadows/shadowGeneratorSceneComponent";
import "@babylonjs/core/Rendering/prePassRendererSceneComponent";
import "@babylonjs/core/Rendering/depthRendererSceneComponent";
import "@babylonjs/core/Rendering/geometryBufferRendererSceneComponent";
import "@/Loader/Optimized/bpmxLoader";

import { ArcRotateCamera } from "@babylonjs/core/Cameras/arcRotateCamera";
// import { DirectionalLightFrustumViewer } from "@babylonjs/core/Debug/directionalLightFrustumViewer";
import { SkeletonViewer } from "@babylonjs/core/Debug/skeletonViewer";
import { Constants } from "@babylonjs/core/Engines/constants";
import type { Engine } from "@babylonjs/core/Engines/engine";
import { DirectionalLight } from "@babylonjs/core/Lights/directionalLight";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { ShadowGenerator } from "@babylonjs/core/Lights/Shadows/shadowGenerator";
import { SceneLoader } from "@babylonjs/core/Loading/sceneLoader";
import { Material } from "@babylonjs/core/Materials/material";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Color3, Color4 } from "@babylonjs/core/Maths/math.color";
import { Matrix, Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { Mesh } from "@babylonjs/core/Meshes/mesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { HavokPlugin } from "@babylonjs/core/Physics/v2/Plugins/havokPlugin";
import { Scene } from "@babylonjs/core/scene";
import HavokPhysics from "@babylonjs/havok";
import { Inspector } from "@babylonjs/inspector";

import type { MmdAnimation } from "@/Loader/Animation/mmdAnimation";
import type { MmdStandardMaterialBuilder } from "@/Loader/mmdStandardMaterialBuilder";
import type { BpmxLoader } from "@/Loader/Optimized/bpmxLoader";
import { BvmdLoader } from "@/Loader/Optimized/bvmdLoader";
import { SdefInjector } from "@/Loader/sdefInjector";
import { StreamAudioPlayer } from "@/Runtime/Audio/streamAudioPlayer";
import { MmdCamera } from "@/Runtime/mmdCamera";
import { MmdPhysics } from "@/Runtime/mmdPhysics";
import { MmdRuntime } from "@/Runtime/mmdRuntime";

import type { ISceneBuilder } from "./baseRuntime";

export class SceneBuilder implements ISceneBuilder {
    public async build(canvas: HTMLCanvasElement, engine: Engine): Promise<Scene> {
        SdefInjector.OverrideEngineCreateEffect(engine);
        const pmxLoader = SceneLoader.GetPluginForExtension(".bpmx") as BpmxLoader;
        pmxLoader.useSdef = true;
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

        const scene = new Scene(engine);
        scene.clearColor = new Color4(0.95, 0.95, 0.95, 1.0);

        const camera = new ArcRotateCamera("arcRotateCamera", 0, 0, 45, new Vector3(0, 10, 0), scene);
        camera.maxZ = 5000;
        camera.setPosition(new Vector3(0, 10, -35));
        camera.attachControl(canvas, false);
        camera.inertia = 0.8;
        camera.speed = 10;

        const mmdCamera = new MmdCamera("mmdCamera", new Vector3(0, 10, 0), scene);
        mmdCamera.maxZ = 5000;

        const mmdRoot = new TransformNode("mmdRoot", scene);
        mmdCamera.parent = mmdRoot;
        mmdRoot.position.z -= 50;

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

        const ground = MeshBuilder.CreateGround("ground1", { width: 120, height: 120, subdivisions: 2, updatable: false }, scene);
        const groundMaterial = ground.material = new StandardMaterial("groundMaterial", scene);
        groundMaterial.diffuseColor = new Color3(1.02, 1.02, 1.02);
        ground.setEnabled(true);

        const mmdRuntime = new MmdRuntime(new MmdPhysics(scene));
        mmdRuntime.loggingEnabled = true;

        mmdRuntime.register(scene);

        const audioPlayer = new StreamAudioPlayer(scene);
        audioPlayer.preservesPitch = false;
        audioPlayer.source = "res/private_test/motion/pizzicato_drops/pizzicato_drops.mp3";
        mmdRuntime.setAudioPlayer(audioPlayer);

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
            "res/private_test/model/YYB Hatsune Miku_10th.bpmx",
            undefined,
            scene,
            (event) => updateLoadingText(1, `Loading model... ${event.loaded}/${event.total} (${Math.floor(event.loaded * 100 / event.total)}%)`)
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
            modelMesh.parent = mmdRoot;

            // const mmdModel = mmdRuntime.createMmdModel(modelMesh, {
            //     buildPhysics: true
            // });
            // mmdModel.addAnimation(loadResults[0] as MmdAnimation);
            // mmdModel.setAnimation("motion");

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

            const leftKneeBone = modelMesh.skeleton!.bones.find((bone) => bone.name === "左ひざD");
            let leftKneeBoneRotationTime = 0;
            scene.onBeforeRenderObservable.add(() => {
                leftKneeBoneRotationTime += scene.getEngine().getDeltaTime();
                const rightKneeBoneRotation = Math.sin(leftKneeBoneRotationTime / 1000) * Math.PI;
                leftKneeBone!.setRotation(new Vector3(0, rightKneeBoneRotation, 0));
            });

            const viewer = new SkeletonViewer(modelMesh.skeleton!, modelMesh, scene, false, 3, {
                displayMode: SkeletonViewer.DISPLAY_SPHERE_AND_SPURS
            });
            viewer.isEnabled = false;
        }

        Inspector.Show(scene, { });

        return scene;
    }
}
