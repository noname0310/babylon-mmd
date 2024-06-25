import "@babylonjs/core/Loading/loadingScreen";
import "@/Loader/pmxLoader";
import "@/Runtime/Animation/mmdRuntimeCameraAnimation";
import "@/Runtime/Animation/mmdRuntimeModelAnimation";
import "@/Loader/mmdOutlineRenderer";

import type { Skeleton } from "@babylonjs/core/Bones/skeleton";
// import { PhysicsViewer } from "@babylonjs/core/Debug/physicsViewer";
import type { AbstractEngine } from "@babylonjs/core/Engines/abstractEngine";
import { SceneLoader } from "@babylonjs/core/Loading/sceneLoader";
import { ImageProcessingConfiguration } from "@babylonjs/core/Materials/imageProcessingConfiguration";
import { Color4 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
// import { CreateBox } from "@babylonjs/core/Meshes/Builders/boxBuilder";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import type { MorphTarget } from "@babylonjs/core/Morph/morphTarget";
// import { HavokPlugin } from "@babylonjs/core/Physics/v2/Plugins/havokPlugin";
// import { PhysicsImpostor } from "@babylonjs/core/Physics/v1/physicsImpostor";
import { DefaultRenderingPipeline } from "@babylonjs/core/PostProcesses/RenderPipeline/Pipelines/defaultRenderingPipeline";
import { Scene } from "@babylonjs/core/scene";

// import havok from "@babylonjs/havok";
import type { MmdAnimation } from "@/Loader/Animation/mmdAnimation";
import type { MmdModelMetadata } from "@/Loader/mmdModelMetadata";
import { MmdStandardMaterial } from "@/Loader/mmdStandardMaterial";
import { type MmdStandardMaterialBuilder, MmdStandardMaterialRenderMethod } from "@/Loader/mmdStandardMaterialBuilder";
import { PmxObject } from "@/Loader/Parser/pmxObject";
import type { PmxLoader } from "@/Loader/pmxLoader";
import { SdefInjector } from "@/Loader/sdefInjector";
import { VmdLoader } from "@/Loader/vmdLoader";
import { StreamAudioPlayer } from "@/Runtime/Audio/streamAudioPlayer";
import { MmdCamera } from "@/Runtime/mmdCamera";
import type { MmdMesh } from "@/Runtime/mmdMesh";
import { MmdRuntime } from "@/Runtime/mmdRuntime";
import ammo from "@/Runtime/Physics/External/ammo.wasm";
import { MmdAmmoJSPlugin } from "@/Runtime/Physics/mmdAmmoJSPlugin";
import { MmdAmmoPhysics } from "@/Runtime/Physics/mmdAmmoPhysics";
// import { MmdPhysics } from "@/Runtime/Physics/mmdPhysics";
import { MmdPlayerControl } from "@/Runtime/Util/mmdPlayerControl";

import type { ISceneBuilder } from "../baseRuntime";
import { createCameraSwitch } from "../Util/createCameraSwitch";
import { createDefaultArcRotateCamera } from "../Util/createDefaultArcRotateCamera";
import { createDefaultGround } from "../Util/createDefaultGround";
import { createLightComponents } from "../Util/createLightComponents";
import { optimizeScene } from "../Util/optimizeScene";
import { parallelLoadAsync } from "../Util/parallelLoadAsync";

export class SceneBuilder implements ISceneBuilder {
    public async build(canvas: HTMLCanvasElement, engine: AbstractEngine): Promise<Scene> {
        SdefInjector.OverrideEngineCreateEffect(engine);
        const pmxLoader = SceneLoader.GetPluginForExtension(".pmx") as PmxLoader;
        pmxLoader.loggingEnabled = true;
        const materialBuilder = pmxLoader.materialBuilder as MmdStandardMaterialBuilder;
        materialBuilder.renderMethod = MmdStandardMaterialRenderMethod.DepthWriteAlphaBlendingWithEvaluation;
        materialBuilder.afterBuildSingleMaterial = (material): void => {
            material.forceDepthWrite = true;
            material.useLogarithmicDepth = true;
        };
        // materialBuilder.loadOutlineRenderingProperties = (): void => { /* do nothing */ };

        const scene = new Scene(engine);
        scene.clearColor = new Color4(0.95, 0.95, 0.95, 1.0);
        const mmdRoot = new TransformNode("mmdRoot", scene);
        const mmdCamera = new MmdCamera("mmdCamera", new Vector3(0, 10, 0), scene);
        mmdCamera.maxZ = 5000;
        mmdCamera.parent = mmdRoot;
        const camera = createDefaultArcRotateCamera(scene);
        createCameraSwitch(scene, canvas, mmdCamera, camera);
        const { shadowGenerator } = createLightComponents(scene, {
            shadowMaxZOffset: 25,
            shadowMinZOffset: -20,
            orthoTopOffset: 20,
            orthoBottomOffset: -20,
            orthoLeftOffset: -20,
            orthoRightOffset: 50
        });
        shadowGenerator.transparencyShadow = true;
        shadowGenerator.enableSoftTransparentShadow = true;
        createDefaultGround(scene, { useLogarithmicDepth: true });

        const mmdRuntime = new MmdRuntime(scene, new MmdAmmoPhysics(scene));
        mmdRuntime.loggingEnabled = true;

        mmdRuntime.register(scene);

        const audioPlayer = new StreamAudioPlayer(scene);
        audioPlayer.preservesPitch = false;
        audioPlayer.source = "res/private_test/motion/new_jeans/NewJeans - New Jeans.wav";
        mmdRuntime.setAudioPlayer(audioPlayer);

        const mmdPlayerControl = new MmdPlayerControl(scene, mmdRuntime, audioPlayer);
        mmdPlayerControl.showPlayerControl();

        const [
            mmdAnimations,
            modelMesh
        ] = await parallelLoadAsync(scene, [
            ["motion", (updateProgress): Promise<MmdAnimation[]> => {
                const vmdLoader = new VmdLoader(scene);
                vmdLoader.loggingEnabled = true;
                const filePaths = [
                    "res/private_test/motion/new_jeans/Danielle part.vmd",
                    "res/private_test/motion/new_jeans/Haerin part.vmd",
                    "res/private_test/motion/new_jeans/Hanni part.vmd",
                    "res/private_test/motion/new_jeans/Hyein part.vmd",
                    "res/private_test/motion/new_jeans/Minji part.vmd",
                    "res/private_test/motion/new_jeans/Camera.vmd"
                ];
                return Promise.all(filePaths.map((filePath) => vmdLoader.loadAsync("motion", filePath, updateProgress)));
            }],
            ["model", (updateProgress): Promise<MmdMesh> => {
                pmxLoader.boundingBoxMargin = 60;

                return SceneLoader.ImportMeshAsync(
                    undefined,
                    "res/private_test/model/YYB Hatsune Miku_10th - faceforward - newjeans/",
                    "YYB Hatsune Miku_10th_v1.02 - faceforward - ng.pmx",
                    scene,
                    updateProgress
                ).then((result) => result.meshes[0] as MmdMesh);
            }],
            ["physics", async(updateProgress): Promise<void> => {
                updateProgress({ lengthComputable: true, loaded: 0, total: 1 });
                const physicsInstance = await ammo();
                const physicsPlugin = new MmdAmmoJSPlugin(true, physicsInstance);
                scene.enablePhysics(new Vector3(0, -9.8 * 10, 0), physicsPlugin);
                updateProgress({ lengthComputable: true, loaded: 1, total: 1 });
            }]
        ]);

        mmdRuntime.setCamera(mmdCamera);
        mmdCamera.addAnimation(mmdAnimations[5]);
        mmdCamera.setAnimation("motion");

        const modelMeshes = [modelMesh];

        const oldBlockMaterialDirtyMechanism = scene.blockMaterialDirtyMechanism;
        scene._forceBlockMaterialDirtyMechanism(true);

        const originalMeshes = modelMesh.metadata.meshes;
        for (let i = 1; i < mmdAnimations.length - 1; ++i) {
            const clonedRootMesh = new Mesh(modelMesh.name + `.${i}`, scene, null);

            const remappedReferences = new Map<object, unknown>();

            const clonedMeshes: Mesh[] = [];
            for (let j = 0; j < originalMeshes.length; ++j) {
                const originalMesh = originalMeshes[j];
                const mesh = new Mesh(originalMesh.name, scene);
                originalMesh.geometry?.applyToMesh(mesh);
                mesh.setParent(clonedRootMesh);
                if (mesh.subMeshes !== undefined) {
                    for (let k = 0; k < mesh.subMeshes.length; ++k) {
                        mesh.subMeshes[k].setBoundingInfo(originalMesh.getBoundingInfo());
                    }
                }
                mesh.setBoundingInfo(originalMesh.getBoundingInfo());
                mesh._updateBoundingInfo();
                clonedMeshes.push(mesh);

                mesh.alphaIndex = originalMesh.alphaIndex + materialBuilder.alphaIndexIncrementsPerModel * i;
                const originalMaterial = originalMesh.material as MmdStandardMaterial;
                const newMaterial = mesh.material = new MmdStandardMaterial(`${originalMaterial.name}.${i}`, scene);
                newMaterial.backFaceCulling = originalMaterial.backFaceCulling;
                newMaterial.diffuseColor = originalMaterial.diffuseColor.clone();
                newMaterial.specularColor = originalMaterial.specularColor.clone();
                newMaterial.ambientColor = originalMaterial.ambientColor.clone();
                newMaterial.alpha = originalMaterial.alpha;
                newMaterial.specularPower = originalMaterial.specularPower;
                newMaterial.diffuseTexture = originalMaterial.diffuseTexture;
                newMaterial.sphereTexture = originalMaterial.sphereTexture;
                newMaterial.sphereTextureBlendMode = originalMaterial.sphereTextureBlendMode;
                newMaterial.toonTexture = originalMaterial.toonTexture;
                newMaterial.transparencyMode = originalMaterial.transparencyMode;
                newMaterial.forceDepthWrite = originalMaterial.forceDepthWrite;
                newMaterial.useLogarithmicDepth = originalMaterial.useLogarithmicDepth;
                newMaterial.useAlphaFromDiffuseTexture = originalMaterial.useAlphaFromDiffuseTexture;
                newMaterial.renderOutline = originalMaterial.renderOutline;
                newMaterial.outlineWidth = originalMaterial.outlineWidth;
                newMaterial.outlineColor = originalMaterial.outlineColor.clone();
                newMaterial.outlineAlpha = originalMaterial.outlineAlpha;

                remappedReferences.set(originalMaterial, newMaterial);

                if (originalMesh.morphTargetManager !== null) {
                    const originalMorphTargetManager = originalMesh.morphTargetManager;
                    const newMorphTargetManager = mesh.morphTargetManager = originalMorphTargetManager.clone();

                    remappedReferences.set(originalMorphTargetManager, newMorphTargetManager);

                    const numTargets = originalMorphTargetManager.numTargets;
                    for (let j = 0; j < numTargets; ++j) {
                        const originalTarget = originalMorphTargetManager.getTarget(j);
                        const newTarget = newMorphTargetManager.getTarget(j);
                        remappedReferences.set(originalTarget, newTarget);
                    }
                }
            }

            clonedRootMesh.setBoundingInfo(modelMesh.getBoundingInfo());
            clonedRootMesh._updateBoundingInfo();

            if (modelMesh.metadata.skeleton !== null) {
                const clonedSkeleton = modelMesh.metadata.skeleton.clone(`c${i}`) ?? null;
                remappedReferences.set(modelMesh.metadata.skeleton, clonedSkeleton);

                for (let j = 0; j < originalMeshes.length; ++j) {
                    if (originalMeshes[j].skeleton !== null) {
                        clonedMeshes[j].skeleton = clonedSkeleton;
                    }
                }
            }

            const originalMetadata = modelMesh.metadata;
            const clonedMetadata: MmdModelMetadata = {
                isMmdModel: true,
                header: originalMetadata.header,
                bones: originalMetadata.bones,
                morphs: originalMetadata.morphs.map((morph) => {
                    if (morph.type === PmxObject.Morph.Type.VertexMorph || morph.type === PmxObject.Morph.Type.UvMorph) {
                        return {
                            ...morph,
                            morphTargets: morph.morphTargets.map((target) => {
                                return remappedReferences.get(target) as MorphTarget;
                            })
                        };
                    } else {
                        return morph;
                    }
                }),
                rigidBodies: originalMetadata.rigidBodies,
                joints: originalMetadata.joints,
                meshes: clonedMeshes,
                materials: originalMetadata.materials.map((material) => remappedReferences.get(material) as MmdStandardMaterial),
                skeleton: originalMetadata.skeleton ? remappedReferences.get(originalMetadata.skeleton) as Skeleton : null
            };
            clonedRootMesh.metadata = clonedMetadata;
            modelMeshes.push(clonedRootMesh as MmdMesh);
        }

        scene._forceBlockMaterialDirtyMechanism(oldBlockMaterialDirtyMechanism);

        for (let i = 0; i < modelMeshes.length; ++i) {
            const modelMesh = modelMeshes[i];

            for (const mesh of modelMesh.metadata.meshes) {
                mesh.receiveShadows = true;
                shadowGenerator.addShadowCaster(mesh, false);
            }
            modelMesh.parent = mmdRoot;

            const mmdModel = mmdRuntime.createMmdModel(modelMesh, {
                buildPhysics: true
            });
            mmdModel.addAnimation(mmdAnimations[i]);
            mmdModel.setAnimation("motion");
        }
        mmdRuntime.playAnimation();

        scene.onAfterRenderObservable.addOnce(() => optimizeScene(scene, { clearCachedVertexData: true, freezeMaterials: false }));

        // const viewer = new SkeletonViewer(modelMesh.metadata.skeleton, modelMesh, scene, false, 3, {
        //     displayMode: SkeletonViewer.DISPLAY_SPHERE_AND_SPURS
        // });

        // const plane = CreateBox("plane", { width: 100, height: 100 }, scene);
        // plane.rotation.x = Math.PI / 2;
        // plane.isVisible = false;
        // const planeImpostor = plane.physicsImpostor = new PhysicsImpostor(plane, PhysicsImpostor.BoxImpostor, { mass: 0 }, scene);
        // {
        //     const physicsViewer = new PhysicsViewer(scene);
        //     for (const node of modelMesh.getChildMeshes(true)) {
        //         if (node.physicsImpostor) {
        //             physicsViewer.showImpostor(node.physicsImpostor);
        //         }
        //     }
        //     physicsViewer.showImpostor(planeImpostor);
        // }

        const defaultPipeline = new DefaultRenderingPipeline("default", true, scene);
        defaultPipeline.samples = 4;
        defaultPipeline.bloomEnabled = true;
        defaultPipeline.chromaticAberrationEnabled = true;
        defaultPipeline.chromaticAberration.aberrationAmount = 1;
        defaultPipeline.depthOfFieldEnabled = false;
        defaultPipeline.fxaaEnabled = true;
        defaultPipeline.imageProcessingEnabled = true;
        defaultPipeline.imageProcessing.toneMappingEnabled = true;
        defaultPipeline.imageProcessing.toneMappingType = ImageProcessingConfiguration.TONEMAPPING_KHR_PBR_NEUTRAL;
        defaultPipeline.imageProcessing.vignetteWeight = 0.5;
        defaultPipeline.imageProcessing.vignetteStretch = 0.5;
        defaultPipeline.imageProcessing.vignetteColor = new Color4(0, 0, 0, 0);
        defaultPipeline.imageProcessing.vignetteEnabled = true;

        return scene;
    }
}
