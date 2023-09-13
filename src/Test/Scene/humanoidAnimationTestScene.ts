import "@babylonjs/core/Animations/animatable";
import "@babylonjs/core/Loading/loadingScreen";
import "@babylonjs/core/Lights/Shadows/shadowGeneratorSceneComponent";
import "@babylonjs/core/Rendering/depthRendererSceneComponent";
import "@babylonjs/loaders/glTF/2.0/glTFLoader";
import "@/Loader/Optimized/bpmxLoader";
import "@/Runtime/Animation/mmdRuntimeCameraAnimation";
import "@/Runtime/Animation/mmdRuntimeModelAnimation";

import type { AssetContainer } from "@babylonjs/core/assetContainer";
import { ArcRotateCamera } from "@babylonjs/core/Cameras/arcRotateCamera";
// import { DirectionalLightFrustumViewer } from "@babylonjs/core/Debug/directionalLightFrustumViewer";
import { SkeletonViewer } from "@babylonjs/core/Debug/skeletonViewer";
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
import type { TransformNode } from "@babylonjs/core/Meshes/transformNode";
// import { HavokPlugin } from "@babylonjs/core/Physics/v2/Plugins/havokPlugin";
import { DefaultRenderingPipeline } from "@babylonjs/core/PostProcesses/RenderPipeline/Pipelines/defaultRenderingPipeline";
import { Scene } from "@babylonjs/core/scene";
// import HavokPhysics from "@babylonjs/havok";
import { Inspector } from "@babylonjs/inspector";

import type { MmdStandardMaterialBuilder } from "@/Loader/mmdStandardMaterialBuilder";
import type { BpmxLoader } from "@/Loader/Optimized/bpmxLoader";
import { SdefInjector } from "@/Loader/sdefInjector";
import { AnimationRetargeter } from "@/Loader/Util/animationRetargeter";
import { MixamoMmdHumanoidBoneMap, MmdHumanoidMapper } from "@/Loader/Util/mmdHumanoidMapper";
// import { MmdAnimationConverter } from "@/Loader/Util/mmdAnimationConverter";
// import { MixamoMmdHumanoidBoneMap } from "@/Loader/Util/mmdHumanoidMapper";
import { MmdPhysics } from "@/Runtime/mmdPhysics";
import { MmdRuntime } from "@/Runtime/mmdRuntime";

import type { ISceneBuilder } from "../baseRuntime";

export class SceneBuilder implements ISceneBuilder {
    public async build(canvas: HTMLCanvasElement, engine: Engine): Promise<Scene> {
        SdefInjector.OverrideEngineCreateEffect(engine);
        const pmxLoader = SceneLoader.GetPluginForExtension(".bpmx") as BpmxLoader;
        pmxLoader.loggingEnabled = true;
        const materialBuilder = pmxLoader.materialBuilder as MmdStandardMaterialBuilder;
        materialBuilder.alphaEvaluationResolution = 2048;
        // materialBuilder.loadDiffuseTexture = (): void => { /* do nothing */ };
        // materialBuilder.loadSphereTexture = (): void => { /* do nothing */ };
        // materialBuilder.loadToonTexture = (): void => { /* do nothing */ };
        materialBuilder.loadOutlineRenderingProperties = (): void => { /* do nothing */ };

        const scene = new Scene(engine);
        scene.clearColor = new Color4(0.95, 0.95, 0.95, 1.0);

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
        directionalLight.orthoTop = 18 + 10;
        directionalLight.orthoBottom = -3;
        directionalLight.orthoLeft = -10;
        directionalLight.orthoRight = 10 + 10;
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
        ground.receiveShadows = true;
        const groundMaterial = ground.material = new StandardMaterial("groundMaterial", scene);
        groundMaterial.diffuseColor = new Color3(1.02, 1.02, 1.02);

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

        promises.push(SceneLoader.LoadAssetContainerAsync(
            "res/private_test/", "Capoeira.glb", scene,
            (event) => updateLoadingText(0, `Loading motion... ${event.loaded}/${event.total} (${Math.floor(event.loaded * 100 / event.total)}%)`))
        );

        pmxLoader.boundingBoxMargin = 60;
        promises.push(SceneLoader.ImportMeshAsync(
            undefined,
            "res/private_test/model/",
            "YYB Hatsune Miku_10th.bpmx",
            scene,
            (event) => updateLoadingText(1, `Loading model... ${event.loaded}/${event.total} (${Math.floor(event.loaded * 100 / event.total)}%)`)
        ));

        // promises.push((async(): Promise<void> => {
        //     updateLoadingText(2, "Loading physics engine...");
        //     const havokInstance = await HavokPhysics();
        //     const havokPlugin = new HavokPlugin(true, havokInstance);
        //     scene.enablePhysics(new Vector3(0, -9.8 * 10, 0), havokPlugin);
        //     updateLoadingText(2, "Loading physics engine... Done");
        // })());

        loadingTexts = new Array(promises.length).fill("");

        const loadResults = await Promise.all(promises);
        scene.onAfterRenderObservable.addOnce(() => engine.hideLoadingUI());

        const motionAssetContainer = loadResults[0] as AssetContainer;
        const modelMesh = loadResults[1].meshes[0] as Mesh;

        {
            motionAssetContainer.addAllToScene();
            const rootNode = motionAssetContainer.rootNodes[0] as TransformNode;
            rootNode.rotationQuaternion!.set(0, 0, 0, 1);
            rootNode.scaling.scaleInPlace(100);
            rootNode.position.set(10, 0, 10);
            const meshes = motionAssetContainer.meshes;
            for (let i = 0; i < meshes.length; ++i) {
                const mesh = meshes[i];
                mesh.receiveShadows = true;
                shadowGenerator.addShadowCaster(mesh);
            }

            const animationRetargeter = new AnimationRetargeter();

            animationRetargeter.loggingEnabled = true;

            const animation = motionAssetContainer.animationGroups[0];
            const sourceSkeleton = motionAssetContainer.skeletons[0];

            const retargetedAnimation = animationRetargeter
                .setBoneMap(new MmdHumanoidMapper(MixamoMmdHumanoidBoneMap).boneMap)
                .setSourceSkeleton(sourceSkeleton)
                .setTargetSkeleton(modelMesh.skeleton!)
                .retargetAnimation(animation)!;

            retargetedAnimation.isAdditive = true;
            retargetedAnimation.weight = 1;
            retargetedAnimation.play(true);

            animation.stop();
            retargetedAnimation.stop();
            {
                const bones = sourceSkeleton.bones;
                for (let i = 0; i < bones.length; ++i) {
                    const bone = bones[i];
                    bone.linkTransformNode(null);
                }
            }

            animation.dispose();
            retargetedAnimation.dispose();

            const sourceLeftShoulder = sourceSkeleton.bones.find((bone) => bone.name === "mixamorig:LeftShoulder")!;
            const targetLeftShoulder = modelMesh.skeleton!.bones.find((bone) => bone.name === "左肩")!;

            // rotate x -90
            const quaternionXM90 = Quaternion.FromEulerAngles(Math.PI / 2, 0, 0);

            sourceSkeleton.prepare();

            const sourceLeftSpineWorldRotation = Quaternion.FromRotationMatrix(sourceLeftShoulder.parent!.getFinalMatrix());
            const sourceLeftSpineLocalRotation = Quaternion.FromRotationMatrix(sourceLeftShoulder.parent._matrix);

            const sourceLeftShoulderWorldRotation = Quaternion.FromRotationMatrix(sourceLeftShoulder.getFinalMatrix());
            const sourceLeftShoulderLocalRotation = Quaternion.FromRotationMatrix(sourceLeftShoulder._matrix);

            sourceLeftShoulder;
            targetLeftShoulder;
            quaternionXM90;
            sourceLeftSpineWorldRotation;
            sourceLeftSpineLocalRotation;
            sourceLeftShoulderWorldRotation;
            sourceLeftShoulderLocalRotation;

            // // apply same rotation from mmd skeleton to mixamo skeleton
            // targetLeftShoulder.rotationQuaternion = targetLeftShoulder.rotationQuaternion.multiply(quaternionXM90);
            // sourceLeftShoulder.rotationQuaternion = sourceLeftSpineWorldRotation.invert()
            //     .multiply(quaternionXM90.invert())
            //     .multiply(sourceLeftShoulderWorldRotation);


            // // apply same rotation from mixamo skeleton to mmd skeleton
            // sourceLeftShoulder.rotationQuaternion = sourceLeftShoulderLocalRotation.multiply(quaternionXM90);
            // targetLeftShoulder.rotationQuaternion = sourceLeftShoulderLocalRotation
            //     .multiply(quaternionXM90)
            //     .multiply(sourceLeftShoulderLocalRotation.invert())
            // ;

            const sourceLeftHand = sourceSkeleton.bones.find((bone) => bone.name === "mixamorig:LeftHand")!;
            const targetLeftHand = modelMesh.skeleton!.bones.find((bone) => bone.name === "左手首")!;

            // position y 5
            const positionY5 = new Vector3(0, 300, 0);

            const sourceLeftForeArmWorldRotation = Quaternion.FromRotationMatrix(sourceLeftHand.parent!.getFinalMatrix());
            const sourceLeftForeArmLocalRotation = Quaternion.FromRotationMatrix(sourceLeftHand.parent._matrix);

            const sourceLeftHandWorldRotation = Quaternion.FromRotationMatrix(sourceLeftHand.getFinalMatrix());
            const sourceLeftHandLocalRotation = Quaternion.FromRotationMatrix(sourceLeftHand._matrix);

            sourceLeftHand;
            targetLeftHand;
            positionY5;
            sourceLeftForeArmWorldRotation;
            sourceLeftForeArmLocalRotation;
            sourceLeftHandWorldRotation;
            sourceLeftHandLocalRotation;

            // apply same position from mmd skeleton to mixamo skeleton
            // targetLeftHand.position = targetLeftHand.position.add(positionY5);
            // sourceLeftHand.position = sourceLeftHand.position.add(
            //     positionY5.applyRotationQuaternion(
            //         sourceLeftForeArmWorldRotation.invert()
            //             .multiply(Quaternion.FromEulerAngles(-Math.PI / 2, 0, 0))
            //     )
            // );

            // apply same position from mixamo skeleton to mmd skeleton
            // sourceLeftHand.position = sourceLeftHand.position.add(positionY5);
            // targetLeftHand.position = targetLeftHand.position.add(
            //     positionY5.applyRotationQuaternion(
            //         Quaternion.FromEulerAngles(Math.PI / 2, 0, 0).multiply(sourceLeftHandWorldRotation)
            //     )
            // );
        }

        {
            shadowGenerator.addShadowCaster(modelMesh);
            modelMesh.receiveShadows = true;

            const mmdModel = mmdRuntime.createMmdModel(modelMesh, {
                buildPhysics: false
            });

            const runtimeBones = mmdModel.sortedRuntimeBones;
            for (let i = 0; i < runtimeBones.length; ++i) {
                const ikSolver = runtimeBones[i].ikSolver;
                if (ikSolver !== null) ikSolver.enabled = false;
            }

            const bodyBone = modelMesh.skeleton!.bones.find((bone) => bone.name === "センター");
            const meshWorldMatrix = modelMesh.getWorldMatrix();
            const boneWorldMatrix = new Matrix();
            scene.onBeforeRenderObservable.add(() => {
                boneWorldMatrix.copyFrom(bodyBone!.getFinalMatrix()).multiplyToRef(meshWorldMatrix, boneWorldMatrix);
                boneWorldMatrix.getTranslationToRef(directionalLight.position);
                directionalLight.position.y -= 10;

                // camera.target.copyFrom(directionalLight.position);
                // camera.target.y += 13;
            });

            const viewer = new SkeletonViewer(modelMesh.skeleton!, modelMesh, scene, false, 3, {
                displayMode: SkeletonViewer.DISPLAY_SPHERE_AND_SPURS
            });
            viewer.isEnabled = false;
        }

        const defaultPipeline = new DefaultRenderingPipeline("default", true, scene, [camera]);
        defaultPipeline.samples = 4;
        defaultPipeline.bloomEnabled = true;
        defaultPipeline.fxaaEnabled = true;
        defaultPipeline.imageProcessingEnabled = true;
        defaultPipeline.imageProcessing.toneMappingEnabled = true;
        defaultPipeline.imageProcessing.toneMappingType = ImageProcessingConfiguration.TONEMAPPING_ACES;
        defaultPipeline.imageProcessing.vignetteWeight = 0.5;
        defaultPipeline.imageProcessing.vignetteStretch = 0.5;
        defaultPipeline.imageProcessing.vignetteColor = new Color4(0, 0, 0, 0);
        defaultPipeline.imageProcessing.vignetteEnabled = true;

        Inspector.Show;//(scene, { });

        return scene;
    }
}
