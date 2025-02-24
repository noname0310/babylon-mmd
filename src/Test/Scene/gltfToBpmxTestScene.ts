import "@babylonjs/core/Loading/loadingScreen";
import "@babylonjs/core/Rendering/depthRendererSceneComponent";
import "@babylonjs/loaders/glTF/2.0/glTFLoader";
import "@/Loader/Optimized/bpmxLoader";
import "@/Runtime/Animation/mmdRuntimeCameraAnimation";
import "@/Runtime/Animation/mmdRuntimeModelAnimation";

import type { AbstractEngine } from "@babylonjs/core/Engines/abstractEngine";
import { LoadAssetContainerAsync } from "@babylonjs/core/Loading/sceneLoader";
import { ImageProcessingConfiguration } from "@babylonjs/core/Materials/imageProcessingConfiguration";
import { Material } from "@babylonjs/core/Materials/material";
import type { PBRMaterial } from "@babylonjs/core/Materials/PBR/pbrMaterial";
import { Texture } from "@babylonjs/core/Materials/Textures/texture";
import { Color3, Color4 } from "@babylonjs/core/Maths/math.color";
import type { Mesh } from "@babylonjs/core/Meshes/mesh";
import type { MorphTarget } from "@babylonjs/core/Morph/morphTarget";
import { DefaultRenderingPipeline } from "@babylonjs/core/PostProcesses/RenderPipeline/Pipelines/defaultRenderingPipeline";
import { Scene } from "@babylonjs/core/scene";
import type { Nullable } from "@babylonjs/core/types";
import { Inspector } from "@babylonjs/inspector";

import type { MmdModelMetadata } from "@/Loader/mmdModelMetadata";
import { BpmxConverter } from "@/Loader/Optimized/bpmxConverter";
import { PmxObject } from "@/Loader/Parser/pmxObject";

import type { ISceneBuilder } from "../baseRuntime";
import { createDefaultArcRotateCamera } from "../Util/createDefaultArcRotateCamera";
import { createDefaultGround } from "../Util/createDefaultGround";
import { createLightComponents } from "../Util/createLightComponents";

export class SceneBuilder implements ISceneBuilder {
    public async build(_canvas: HTMLCanvasElement, engine: AbstractEngine): Promise<Scene> {
        const scene = new Scene(engine);
        scene.clearColor = new Color4(0.95, 0.95, 0.95, 1.0);
        scene.autoClear = false;

        createDefaultArcRotateCamera(scene);
        const { hemisphericLight, directionalLight, shadowGenerator } = createLightComponents(scene);
        hemisphericLight.intensity = 0.3;
        directionalLight.intensity = 0.7;
        createDefaultGround(scene);

        const modelLoadResult = await LoadAssetContainerAsync(
            "res/private_test/model/Moe.glb",
            scene
        );
        modelLoadResult.addAllToScene();

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
            mesh.receiveShadows = true;
            shadowGenerator.addShadowCaster(mesh);
        }

        const materials = [...new Set(modelLoadResult.meshes.map(mesh => mesh.material).filter(material => material !== null))] as PBRMaterial[];
        for (const material of materials) {
            if (material.name === "Effect") {
                const finalTexture = new Uint8Array((await material.emissiveTexture!.readPixels())!.buffer);
                const alphaTexture = new Uint8Array((await material.albedoTexture!.readPixels())!.buffer);

                for (let i = 3; i < finalTexture.length; i += 4) {
                    finalTexture[i] = alphaTexture[i];
                }
                const canvas = document.createElement("canvas");
                const size = material.emissiveTexture!.getSize();
                canvas.width = size.width;
                canvas.height = size.height;

                const ctx = canvas.getContext("2d")!;
                const idata = ctx.createImageData(size.width, size.height);
                idata.data.set(finalTexture);
                ctx.putImageData(idata, 0, 0);

                const blob = await new Promise<Blob>(resolve => canvas.toBlob(blob => resolve(blob!), "image/png"));
                const arrayBuffer = await blob.arrayBuffer();

                let texture: Nullable<Texture> = null;
                await new Promise<void>(resolve => {
                    texture = material.emissiveTexture = new Texture("data:Effect", scene, {
                        invertY: false,
                        onLoad: resolve,
                        buffer: arrayBuffer
                    });
                });
                texture!.name = "Effect";
            }
            material.albedoColor = new Color3(1, 1, 1);
            material.reflectivityColor.set(0, 0, 0);
            material.emissiveColor.set(0, 0, 0);
            material.albedoTexture = material.emissiveTexture;
            material.metallic = 0;
        }

        const rootMesh = modelLoadResult.meshes[0];
        {
            const meshes = modelLoadResult.meshes.slice(1) as Mesh[];
            const materials = [...new Set(meshes.map(mesh => mesh.material as Material))];

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
                        axisLimit: undefined,
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
                morphs: morphs,
                rigidBodies: [],
                joints: [],
                meshes: meshes,
                materials: materials,
                skeleton: skeleton
            };
            rootMesh.metadata = metadata;
        }

        const translucentMaterials = materials.map(material => material.transparencyMode === Material.MATERIAL_ALPHABLEND || material.transparencyMode === Material.MATERIAL_ALPHATEST);
        const alphaEvaluateResults = materials.map(material => material.transparencyMode ?? 0xF);

        const bpmxConverter = new BpmxConverter();
        bpmxConverter.loggingEnabled = true;
        const arrayBuffer = bpmxConverter.convert(modelLoadResult.meshes[0] as Mesh, {
            translucentMaterials,
            alphaEvaluateResults
        });
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
