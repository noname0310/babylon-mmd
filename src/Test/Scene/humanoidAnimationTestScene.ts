import "@babylonjs/core/Animations/animatable";
import "@babylonjs/core/Loading/loadingScreen";
import "@babylonjs/core/Rendering/depthRendererSceneComponent";
import "@babylonjs/loaders/glTF/2.0/glTFLoader";
import "@/Loader/Optimized/bpmxLoader";
import "@/Runtime/Animation/mmdRuntimeCameraAnimation";
import "@/Runtime/Animation/mmdRuntimeModelAnimation";

import type { AssetContainer } from "@babylonjs/core/assetContainer";
import { SkeletonViewer } from "@babylonjs/core/Debug/skeletonViewer";
import type { Engine } from "@babylonjs/core/Engines/engine";
import { SceneLoader } from "@babylonjs/core/Loading/sceneLoader";
import { ImageProcessingConfiguration } from "@babylonjs/core/Materials/imageProcessingConfiguration";
import { Color3, Color4 } from "@babylonjs/core/Maths/math.color";
import { Quaternion, Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { Mesh } from "@babylonjs/core/Meshes/mesh";
import type { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { HavokPlugin } from "@babylonjs/core/Physics/v2/Plugins/havokPlugin";
import { DefaultRenderingPipeline } from "@babylonjs/core/PostProcesses/RenderPipeline/Pipelines/defaultRenderingPipeline";
import { Scene } from "@babylonjs/core/scene";
import havokPhysics from "@babylonjs/havok";

// import { Inspector } from "@babylonjs/inspector";
import type { MmdStandardMaterialBuilder } from "@/Loader/mmdStandardMaterialBuilder";
import type { BpmxLoader } from "@/Loader/Optimized/bpmxLoader";
import { SdefInjector } from "@/Loader/sdefInjector";
import { AnimationRetargeter } from "@/Loader/Util/animationRetargeter";
import { MixamoMmdHumanoidBoneMap, MmdHumanoidMapper } from "@/Loader/Util/mmdHumanoidMapper";
import type { MmdMesh } from "@/Runtime/mmdMesh";
// import { MmdAnimationConverter } from "@/Loader/Util/mmdAnimationConverter";
// import { MixamoMmdHumanoidBoneMap } from "@/Loader/Util/mmdHumanoidMapper";
import { MmdPhysics } from "@/Runtime/mmdPhysics";
import { MmdRuntime } from "@/Runtime/mmdRuntime";

import type { ISceneBuilder } from "../baseRuntime";
import { attachToBone } from "../Util/attachToBone";
import { createDefaultArcRotateCamera } from "../Util/createDefaultArcRotateCamera";
import { createDefaultGround } from "../Util/createDefaultGround";
import { createLightComponents } from "../Util/createLightComponents";
import { downloadObject } from "../Util/downloadObject";
import { parallelLoadAsync } from "../Util/parallelLoadAsync";

export class SceneBuilder implements ISceneBuilder {
    public async build(_canvas: HTMLCanvasElement, engine: Engine): Promise<Scene> {
        SdefInjector.OverrideEngineCreateEffect(engine);
        const pmxLoader = SceneLoader.GetPluginForExtension(".bpmx") as BpmxLoader;
        pmxLoader.loggingEnabled = true;
        const materialBuilder = pmxLoader.materialBuilder as MmdStandardMaterialBuilder;
        materialBuilder.alphaEvaluationResolution = 2048;
        materialBuilder.loadOutlineRenderingProperties = (): void => { /* do nothing */ };
        // materialBuilder.afterBuildSingleMaterial = (material): void => {
        //     material.ignoreDiffuseWhenToonTextureIsNull = false;
        // };

        const scene = new Scene(engine);
        scene.ambientColor = new Color3(1, 1, 1);
        scene.clearColor = new Color4(0.95, 0.95, 0.95, 1.0);
        createDefaultArcRotateCamera(scene);

        const { directionalLight, shadowGenerator } = createLightComponents(scene, {
            shadowMaxZOffset: 10,
            orthoTopOffset: 11,
            orthoRightOffset: 1
        });
        createDefaultGround(scene);

        const mmdRuntime = new MmdRuntime(new MmdPhysics(scene));
        mmdRuntime.loggingEnabled = true;
        mmdRuntime.register(scene);

        const [
            motionAssetContainer,
            modelMesh
        ] = await parallelLoadAsync(scene, [
            ["source", (updateProgress): Promise<AssetContainer> => {
                return SceneLoader.LoadAssetContainerAsync("res/private_test/mixamo/", "Walk In Circle.glb", scene, updateProgress);
            }],
            ["target", (updateProgress): Promise<MmdMesh> => {
                pmxLoader.boundingBoxMargin = 60;
                return SceneLoader.ImportMeshAsync(
                    undefined,
                    "res/private_test/model/",
                    "YYB Hatsune Miku_10th.bpmx",
                    scene,
                    updateProgress
                ).then(result => result.meshes[0] as MmdMesh);
            }],
            ["physics", async(updateProgress): Promise<void> => {
                updateProgress({ lengthComputable: true, loaded: 0, total: 1 });
                const havokInstance = await havokPhysics();
                const havokPlugin = new HavokPlugin(true, havokInstance);
                scene.enablePhysics(new Vector3(0, -9.8 * 10, 0), havokPlugin);
                updateProgress({ lengthComputable: true, loaded: 1, total: 1 });
            }]
        ]);

        {
            motionAssetContainer.addAllToScene();
            const rootNode = motionAssetContainer.rootNodes[0] as TransformNode;
            rootNode.rotationQuaternion = Quaternion.Identity();
            // rootNode.scaling.setAll(1);
            rootNode.position.set(10, 0, 10);
            rootNode.getChildTransformNodes()[0].scaling.setAll(1);
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
            const sourceModelMesh = motionAssetContainer.meshes[1] as Mesh;

            sourceModelMesh.computeWorldMatrix(true);
            const skeletonTransform = sourceModelMesh.getWorldMatrix().clone();

            const degToRad = Math.PI / 180;

            const retargetedAnimation = animationRetargeter
                .setBoneMap(new MmdHumanoidMapper(MixamoMmdHumanoidBoneMap).boneMap)
                .setSourceSkeleton(sourceSkeleton, sourceModelMesh)
                .setTargetSkeleton(modelMesh.metadata.skeleton)
                .retargetAnimation(animation, {
                    cloneAnimation: true,
                    removeBoneRotationOffset: true,
                    rotationOffsets: {
                        [MixamoMmdHumanoidBoneMap.leftUpperArm]: new Vector3(-10 * degToRad, 0, 0),
                        [MixamoMmdHumanoidBoneMap.rightUpperArm]: new Vector3(-10 * degToRad, 0, 0)
                    }
                })!;
            retargetedAnimation.play(true);

            downloadObject("catwalk_walking.babylonanim", retargetedAnimation.serialize());

            // animation.stop();
            // retargetedAnimation.stop();
            // {
            //     const bones = sourceSkeleton.bones;
            //     for (let i = 0; i < bones.length; ++i) {
            //         const bone = bones[i];
            //         bone.linkTransformNode(null);
            //     }
            // }

            // animation.dispose();
            // retargetedAnimation.dispose();

            // const sourceLeftShoulder = sourceSkeleton.bones.find((bone) => bone.name === "mixamorig:Neck")!;
            // const targetLeftShoulder = modelMesh.metadata.skeleton.bones.find((bone) => bone.name === "首")!;
            // const sourceLeftShoulder = sourceSkeleton.bones.find((bone) => bone.name === "mixamorig:LeftHand")!;
            // const targetLeftShoulder = modelMesh.metadata.skeleton.bones.find((bone) => bone.name === "左手首")!;
            // const sourceLeftShoulder = sourceSkeleton.bones.find((bone) => bone.name === "mixamorig:LeftForeArm")!;
            // const targetLeftShoulder = modelMesh.metadata.skeleton.bones.find((bone) => bone.name === "左ひじ")!;
            const sourceLeftShoulder = sourceSkeleton.bones.find((bone) => bone.name === "mixamorig:LeftShoulder")!;
            const targetLeftShoulder = modelMesh.metadata.skeleton.bones.find((bone) => bone.name === "左肩")!;
            // const sourceLeftShoulder = sourceSkeleton.bones.find((bone) => bone.name === "mixamorig:LeftUpLeg")!;
            // const targetLeftShoulder = modelMesh.metadata.skeleton.bones.find((bone) => bone.name === "左足")!;


            // rotate x -90
            const quaternionXM90 = Quaternion.FromEulerAngles(-Math.PI / 2, 0, 0);

            sourceSkeleton.returnToRest();
            sourceSkeleton.sortBones();
            sourceSkeleton.prepare();
            sourceSkeleton.computeAbsoluteMatrices();

            const sourceLeftSpineWorldMatrix = sourceLeftShoulder.parent!.getFinalMatrix().multiply(skeletonTransform);
            const sourceLeftSpineLocalMatrix = sourceLeftShoulder.parent._matrix.clone();

            const sourceLeftShoulderWorldMatrix = sourceLeftShoulder.getFinalMatrix().multiply(skeletonTransform);
            const sourceLeftShoulderLocalMatrix = sourceLeftShoulder._matrix.clone();

            sourceLeftShoulder;
            targetLeftShoulder;
            quaternionXM90;
            sourceLeftSpineWorldMatrix;
            sourceLeftSpineLocalMatrix;
            sourceLeftShoulderWorldMatrix;
            sourceLeftShoulderLocalMatrix;

            // apply same rotation from mmd skeleton to mixamo skeleton
            // const quaternionXM9 = Quaternion.FromEulerAngles(-Math.PI / 2 / 100, 0, 0);
            // let frame = 0;
            // const animatedRotation = (): void => {
            //     const aq = Quaternion.Identity();
            //     for (let i = 0; i < frame; ++i) aq.multiplyToRef(quaternionXM9, aq);

            //     targetLeftShoulder.rotationQuaternion = aq;

            //     const sourceLeftShoulderAnimatedWorldRotation = sourceLeftShoulderWorldRotation.multiply(aq);

            //     // world rotation to local rotation
            //     sourceLeftShoulder.rotationQuaternion = Quaternion.Identity()
            //         .multiply(sourceLeftShoulderAnimatedWorldRotation)
            //         .multiply(sourceLeftSpineWorldRotation.invert())
            //     ;

            //     const translation = sourceLeftShoulder.getFinalMatrix().getTranslation();
            //     Matrix.FromQuaternionToRef(sourceLeftShoulderWorldRotation.multiply(aq), sourceLeftShoulder.getFinalMatrix()).setTranslation(translation);

            //     frame += 1;
            //     if (frame === 100) scene.onAfterRenderObservable.removeCallback(animatedRotation);
            // };
            // animatedRotation();
            // setTimeout(() => {
            //     scene.onAfterRenderObservable.add(animatedRotation);
            // }, 3000);

            // const sourceLeftHand = sourceSkeleton.bones.find((bone) => bone.name === "mixamorig:Head")!;
            // const targetLeftHand = modelMesh.metadata.skeleton.bones.find((bone) => bone.name === "頭")!;
            const sourceLeftHand = sourceSkeleton.bones.find((bone) => bone.name === "mixamorig:LeftShoulder")!;
            const targetLeftHand = modelMesh.metadata.skeleton.bones.find((bone) => bone.name === "左肩")!;
            // const sourceLeftHand = sourceSkeleton.bones.find((bone) => bone.name === "mixamorig:LeftHand")!;
            // const targetLeftHand = modelMesh.metadata.skeleton.bones.find((bone) => bone.name === "左手首")!;

            // position y 5
            const positionY5 = new Vector3(100, 300, 200);

            const sourceParentWorldMatrix = sourceLeftHand.parent!.getFinalMatrix().multiply(skeletonTransform);
            const sourceParentLocalMatrix = sourceLeftHand.parent._matrix.clone();

            const sourceWorldMatrix = sourceLeftHand.getFinalMatrix().multiply(skeletonTransform);
            const sourceLocalMatrix = sourceLeftHand._matrix.clone();

            sourceLeftHand;
            targetLeftHand;
            positionY5;
            sourceParentWorldMatrix;
            sourceParentLocalMatrix;
            sourceWorldMatrix;
            sourceLocalMatrix;

            // apply same position from mmd skeleton to mixamo skeleton
            // targetLeftHand.position = targetLeftHand.position.add(positionY5);
            // sourceLeftHand.position = sourceLeftHand.position.add(
            //     Vector3.TransformNormal(positionY5, sourceParentWorldMatrix.invert())
            // );
        }

        {
            shadowGenerator.addShadowCaster(modelMesh);
            for (const mesh of modelMesh.metadata.meshes) mesh.receiveShadows = true;

            const mmdModel = mmdRuntime.createMmdModel(modelMesh, {
                buildPhysics: true
            });
            mmdModel.ikSolverStates.fill(0); // disable ik

            attachToBone(scene, mmdModel, {
                directionalLightPosition: directionalLight.position
            });

            const viewer = new SkeletonViewer(modelMesh.metadata.skeleton, modelMesh, scene, false, 3, {
                displayMode: SkeletonViewer.DISPLAY_SPHERE_AND_SPURS
            });
            viewer.isEnabled = false;
        }

        const defaultPipeline = new DefaultRenderingPipeline("default", true, scene);
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

        // Inspector.Show(scene, { });

        return scene;
    }
}
