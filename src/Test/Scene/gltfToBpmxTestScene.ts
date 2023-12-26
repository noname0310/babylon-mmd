import "@babylonjs/core/Loading/loadingScreen";
import "@babylonjs/core/Rendering/depthRendererSceneComponent";
import "@babylonjs/loaders/glTF/2.0/glTFLoader";
import "@/Loader/Optimized/bpmxLoader";
import "@/Runtime/Animation/mmdRuntimeCameraAnimation";
import "@/Runtime/Animation/mmdRuntimeModelAnimation";

import type { Engine } from "@babylonjs/core/Engines/engine";
import { SceneLoader } from "@babylonjs/core/Loading/sceneLoader";
import { ImageProcessingConfiguration } from "@babylonjs/core/Materials/imageProcessingConfiguration";
import type { Material } from "@babylonjs/core/Materials/material";
import type { PBRMaterial } from "@babylonjs/core/Materials/PBR/pbrMaterial";
import { Color3, Color4 } from "@babylonjs/core/Maths/math.color";
import type { Mesh } from "@babylonjs/core/Meshes/mesh";
import type { MorphTarget } from "@babylonjs/core/Morph/morphTarget";
import { DefaultRenderingPipeline } from "@babylonjs/core/PostProcesses/RenderPipeline/Pipelines/defaultRenderingPipeline";
import { Scene } from "@babylonjs/core/scene";
import type { Nullable } from "@babylonjs/core/types";
import { Inspector } from "@babylonjs/inspector";

import type { MmdModelMetadata } from "@/Loader/mmdModelMetadata";
import type { MmdStandardMaterialBuilder } from "@/Loader/mmdStandardMaterialBuilder";
import { BpmxConverter } from "@/Loader/Optimized/bpmxConverter";
import type { BpmxLoader } from "@/Loader/Optimized/bpmxLoader";
import { PmxObject } from "@/Loader/Parser/pmxObject";

import type { ISceneBuilder } from "../baseRuntime";
import { createDefaultArcRotateCamera } from "../Util/createDefaultArcRotateCamera";
import { createDefaultGround } from "../Util/createDefaultGround";
import { createLightComponents } from "../Util/createLightComponents";

export class SceneBuilder implements ISceneBuilder {
    public async build(_canvas: HTMLCanvasElement, engine: Engine): Promise<Scene> {
        const pmxLoader = SceneLoader.GetPluginForExtension(".bpmx") as BpmxLoader;
        pmxLoader.loggingEnabled = true;

        const materialBuilder = pmxLoader.materialBuilder as MmdStandardMaterialBuilder;
        materialBuilder.loadOutlineRenderingProperties = (): void => { /* do nothing */ };

        const scene = new Scene(engine);
        scene.clearColor = new Color4(0.95, 0.95, 0.95, 1.0);
        scene.autoClear = false;

        createDefaultArcRotateCamera(scene);
        const { hemisphericLight, directionalLight, shadowGenerator } = createLightComponents(scene);
        hemisphericLight.intensity = 0.3;
        directionalLight.intensity = 0.7;
        createDefaultGround(scene);

        const modelLoadResult = await SceneLoader.ImportMeshAsync(
            undefined,
            "res/private_test/model/",
            "Moe.glb",
            scene
        );

        const modelRoot = modelLoadResult.meshes[0] as Mesh;
        modelRoot.rotationQuaternion!.set(0, 0, 0, 1);
        modelRoot.scaling.scaleInPlace(14.3);
        for (const mesh of modelLoadResult.meshes as Mesh[]) {
            const boundingInfo = mesh.getBoundingInfo();
            const subMeshes = mesh.subMeshes;
            if (subMeshes !== undefined) {
                for (let i = 0; i < subMeshes.length; i++) {
                    const subMesh = subMeshes[i];
                    subMesh.setBoundingInfo(boundingInfo);
                }
            }

            if (mesh.material === null) continue;
            shadowGenerator.addShadowCaster(mesh);
            mesh.receiveShadows = true;
            mesh.alwaysSelectAsActiveMesh = true;
            const material = mesh.material as PBRMaterial;
            material.albedoColor = new Color3(1, 1, 1);
            material.reflectivityColor.set(0, 0, 0);
            material.emissiveColor.set(0, 0, 0);
            material.albedoTexture = material.emissiveTexture;
            material.metallic = 0;
        }

        const rootMesh = modelLoadResult.meshes[0];
        {
            const meshes = modelLoadResult.meshes.slice(1) as Mesh[];
            const materials = meshes.map(mesh => mesh.material as Material);

            const skeleton = modelLoadResult.skeletons[0];
            const bones: MmdModelMetadata.Bone[] = [];
            {
                const defaultBoneFlag = PmxObject.Bone.Flag.UseBoneIndexAsTailPosition |
                    PmxObject.Bone.Flag.IsRotatable |
                    PmxObject.Bone.Flag.IsVisible |
                    PmxObject.Bone.Flag.IsControllable;

                const skeletonBones = [...skeleton.bones].sort((a, b) => a.getIndex() - b.getIndex());
                for (let i = 0; i < skeletonBones.length; i++) {
                    const bone = skeletonBones[i];
                    const metadata: MmdModelMetadata.Bone = {
                        name: bone.name,
                        englishName: bone.name,
                        parentBoneIndex: bone.getParent()?.getIndex() ?? -1,
                        transformOrder: 0,
                        flag: defaultBoneFlag,
                        appendTransform: undefined,
                        ik: undefined
                    };
                    bones.push(metadata);
                }
            }

            const morphs: (MmdModelMetadata.VertexMorph | MmdModelMetadata.UvMorph)[] = [];
            {
                const morphTargetManagers = meshes.map(mesh => mesh.morphTargetManager);

                const vertexMorphNameMap = new Map<string, MorphTarget[]>();
                const uvMorphNameMap = new Map<string, MorphTarget[]>();
                for (let i = 0; i < morphTargetManagers.length; i++) {
                    const manager = morphTargetManagers[i];
                    if (manager === null) continue;
                    const numTargets = manager.numTargets;
                    for (let j = 0; j < numTargets; j++) {
                        const morph = manager.getTarget(j);
                        const name = morph.name;

                        let nameMap: Nullable<Map<string, MorphTarget[]>> = null;
                        if (morph.hasUVs) {
                            nameMap = uvMorphNameMap;
                        } else {
                            nameMap = vertexMorphNameMap;
                        }

                        if (nameMap.has(name)) {
                            nameMap.get(name)!.push(morph);
                        } else {
                            nameMap.set(name, [morph]);
                        }
                    }
                }

                for (const [name, morphTargets] of vertexMorphNameMap) {
                    const metadata: MmdModelMetadata.VertexMorph = {
                        name: name,
                        englishName: name,
                        category: PmxObject.Morph.Category.Other,
                        type: PmxObject.Morph.Type.VertexMorph,
                        morphTargets: morphTargets
                    };
                    morphs.push(metadata);
                }

                for (const [name, morphTargets] of uvMorphNameMap) {
                    const metadata: MmdModelMetadata.UvMorph = {
                        name: name,
                        englishName: name,
                        category: PmxObject.Morph.Category.Other,
                        type: PmxObject.Morph.Type.UvMorph,
                        morphTargets: morphTargets
                    };
                    morphs.push(metadata);
                }
            }

            const metadata: MmdModelMetadata = {
                isMmdModel: true,
                header: {
                    modelName: "Moe",
                    englishModelName: "Moe",
                    comment: "Moe",
                    englishComment: "Moe"
                },
                bones: bones,
                morphs: [],
                rigidBodies: [],
                joints: [],
                meshes: meshes,
                materials: materials,
                skeleton: skeleton
            };
            rootMesh.metadata = metadata;
        }

        const bpmxConverter = new BpmxConverter();
        bpmxConverter.loggingEnabled = true;
        const arrayBuffer = bpmxConverter.convert(modelLoadResult.meshes[0] as Mesh);
        const blob = new Blob([arrayBuffer], { type: "application/octet-stream" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "Moe.bpmx";
        a.click();
        URL.revokeObjectURL(url);
        a.remove();

        Inspector.Show(scene, { embedMode: true });

        const defaultPipeline = new DefaultRenderingPipeline("default", true, scene);
        defaultPipeline.samples = 4;
        defaultPipeline.bloomEnabled = true;
        defaultPipeline.chromaticAberrationEnabled = false;
        defaultPipeline.fxaaEnabled = true;
        defaultPipeline.imageProcessingEnabled = true;
        defaultPipeline.imageProcessing.toneMappingEnabled = true;
        defaultPipeline.imageProcessing.toneMappingType = ImageProcessingConfiguration.TONEMAPPING_ACES;
        defaultPipeline.imageProcessing.vignetteWeight = 0.5;
        defaultPipeline.imageProcessing.vignetteStretch = 0.5;
        defaultPipeline.imageProcessing.vignetteColor = new Color4(0, 0, 0, 0);
        defaultPipeline.imageProcessing.vignetteEnabled = true;

        return scene;
    }
}
