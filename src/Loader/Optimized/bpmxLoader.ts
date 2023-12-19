import type { AssetContainer } from "@babylonjs/core/assetContainer";
import { type ISceneLoaderPluginAsync, type ISceneLoaderProgressEvent, SceneLoader } from "@babylonjs/core/Loading/sceneLoader";
import type { Material } from "@babylonjs/core/Materials/material";
import type { BaseTexture } from "@babylonjs/core/Materials/Textures/baseTexture";
import { Geometry } from "@babylonjs/core/Meshes/geometry";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { VertexData } from "@babylonjs/core/Meshes/mesh.vertexData";
import type { IFileRequest } from "@babylonjs/core/Misc/fileRequest";
import type { LoadFileError } from "@babylonjs/core/Misc/fileTools";
import { Tools } from "@babylonjs/core/Misc/tools";
import type { WebRequest } from "@babylonjs/core/Misc/webRequest";
import { MorphTarget } from "@babylonjs/core/Morph/morphTarget";
import { MorphTargetManager } from "@babylonjs/core/Morph/morphTargetManager";
import type { Scene } from "@babylonjs/core/scene";
import type { Nullable } from "@babylonjs/core/types";

import type { BuildMaterialResult, MmdModelBuildGeometryResult } from "../mmdModelLoader";
import { MmdModelLoader, type MmdModelLoadState } from "../mmdModelLoader";
import type { MmdModelMetadata } from "../mmdModelMetadata";
import { ObjectUniqueIdProvider } from "../objectUniqueIdProvider";
import type { ILogger } from "../Parser/ILogger";
import { PmxObject } from "../Parser/pmxObject";
import type { Progress, ProgressTask } from "../progress";
import { SdefBufferKind } from "../sdefBufferKind";
import { SdefMesh } from "../sdefMesh";
import type { BpmxObject } from "./Parser/bpmxObject";
import { BpmxReader } from "./Parser/bpmxReader";

interface BpmxLoadState extends MmdModelLoadState { }

interface BpmxBuildGeometryResult extends MmdModelBuildGeometryResult {
    readonly indices: Uint16Array | Uint32Array;
    readonly indexToSubmehIndexMaps: {
        map: Uint16Array | Uint32Array;
        isReferencedVertex: Uint8Array;
    }[];
}

/**
 * BpmxLoader is a loader that loads models in BPMX format
 *
 * BPMX is a single binary file format that contains all the data of a model
 */
export class BpmxLoader extends MmdModelLoader<BpmxLoadState, BpmxObject, BpmxBuildGeometryResult> implements ISceneLoaderPluginAsync, ILogger {
    /**
     * Create a new BpmxLoader
     */
    public constructor() {
        super(
            "bpmx",
            {
                // eslint-disable-next-line @typescript-eslint/naming-convention
                ".bpmx": { isBinary: true }
            }
        );
    }

    public loadFile(
        scene: Scene,
        fileOrUrl: string | File,
        _rootUrl: string,
        onSuccess: (data: BpmxLoadState, responseURL?: string | undefined) => void,
        onProgress?: ((ev: ISceneLoaderProgressEvent) => void) | undefined,
        useArrayBuffer?: boolean | undefined,
        onError?: ((request?: WebRequest | undefined, exception?: LoadFileError | undefined) => void) | undefined
    ): IFileRequest {
        const materialBuilder = this.materialBuilder;
        const useSdef = this.useSdef;
        const buildSkeleton = this.buildSkeleton;
        const buildMorph = this.buildMorph;
        const boundingBoxMargin = this.boundingBoxMargin;
        const preserveSerializationData = this.preserveSerializationData;

        const request = scene._loadFile(
            fileOrUrl,
            (data, responseURL) => {
                const loadState: BpmxLoadState = {
                    arrayBuffer: data as ArrayBuffer,
                    pmFileId: fileOrUrl instanceof File ? ObjectUniqueIdProvider.GetId(fileOrUrl).toString() : fileOrUrl,
                    materialBuilder,
                    useSdef,
                    buildSkeleton,
                    buildMorph,
                    boundingBoxMargin,
                    preserveSerializationData
                };
                onSuccess(loadState, responseURL);
            },
            onProgress,
            true,
            useArrayBuffer,
            onError
        );
        return request;
    }

    protected override async _parseFileAsync(arrayBuffer: ArrayBuffer): Promise<BpmxObject> {
        return await BpmxReader.ParseAsync(arrayBuffer, this)
            .catch((e: any) => {
                return Promise.reject(e);
            });
    }

    protected override _getProgressTaskCosts(state: BpmxLoadState, modelObject: BpmxObject): ProgressTask[] {
        const tasks = super._getProgressTaskCosts(state, modelObject);
        tasks.push({ name: "Build Geometry", cost: modelObject.geometry.indices.length });
        return tasks;
    }

    protected override async _buildGeometryAsync(
        state: BpmxLoadState,
        modelObject: BpmxObject,
        rootMesh: Mesh,
        scene: Scene,
        assetContainer: Nullable<AssetContainer>,
        progress: Progress
    ): Promise<BpmxBuildGeometryResult> {
        const meshes: Mesh[] = [];
        const geometries: Geometry[] = [];
        const indices = modelObject.geometry.indices;
        const indexToSubmehIndexMaps: BpmxBuildGeometryResult["indexToSubmehIndexMaps"] = [];
        const vertexDataArray: VertexData[] = [];
        {
            const vetexCount = modelObject.geometry.positions.length / 3;

            const materials = modelObject.materials;
            let indexStartOffset = 0;
            for (let i = 0; i < materials.length; ++i) {
                const materialInfo = materials[i];

                const isReferencedVertex = new Uint8Array(vetexCount);//.fill(0);
                let subMeshVertexCount = 0;
                {
                    const indexCount = materialInfo.indexCount;
                    for (let j = 0; j < indexCount; ++j) {
                        const elementIndex = indices[indexStartOffset + j];
                        if (isReferencedVertex[elementIndex] === 0) {
                            isReferencedVertex[elementIndex] = 1;
                            subMeshVertexCount += 1;
                        }
                    }
                    isReferencedVertex.fill(0);
                }
                const vertexData = new VertexData();
                let boneSdefC: Nullable<Float32Array> = null;
                let boneSdefR0: Nullable<Float32Array> = null;
                let boneSdefR1: Nullable<Float32Array> = null;
                if (state.useSdef && modelObject.geometry.sdef !== undefined) {
                    boneSdefC = new Float32Array(subMeshVertexCount * 3);
                    boneSdefR0 = new Float32Array(subMeshVertexCount * 3);
                    boneSdefR1 = new Float32Array(subMeshVertexCount * 3);
                }
                const indexToSubMeshIndexMap = new (indices.constructor as new (length: number) => typeof indices)(vetexCount);
                {
                    const positions = new Float32Array(subMeshVertexCount * 3);
                    const normals = new Float32Array(subMeshVertexCount * 3);
                    const uvs = new Float32Array(subMeshVertexCount * 2);
                    const subMeshIndices = new (indices.constructor as new (length: number) => typeof indices)(materialInfo.indexCount);
                    const boneIndices = new Float32Array(subMeshVertexCount * 4);
                    const boneWeights = new Float32Array(subMeshVertexCount * 4);

                    let time = performance.now();
                    let vertexIndex = 0;
                    let subMeshIndex = 0;
                    const indexCount = materialInfo.indexCount;
                    const positionData = modelObject.geometry.positions;
                    const normalData = modelObject.geometry.normals;
                    const uvData = modelObject.geometry.uvs;
                    const boneIndexData = modelObject.geometry.matricesIndices;
                    const boneWeightData = modelObject.geometry.matricesWeights;
                    const sdefData = modelObject.geometry.sdef;
                    for (let j = 0; j < indexCount; ++j) {
                        const elementIndex = indices[indexStartOffset + j];
                        if (isReferencedVertex[elementIndex] === 0) {
                            isReferencedVertex[elementIndex] = 1;

                            positions[vertexIndex * 3 + 0] = positionData[elementIndex * 3 + 0];
                            positions[vertexIndex * 3 + 1] = positionData[elementIndex * 3 + 1];
                            positions[vertexIndex * 3 + 2] = positionData[elementIndex * 3 + 2];

                            normals[vertexIndex * 3 + 0] = normalData[elementIndex * 3 + 0];
                            normals[vertexIndex * 3 + 1] = normalData[elementIndex * 3 + 1];
                            normals[vertexIndex * 3 + 2] = normalData[elementIndex * 3 + 2];

                            uvs[vertexIndex * 2 + 0] = uvData[elementIndex * 2 + 0];
                            uvs[vertexIndex * 2 + 1] = uvData[elementIndex * 2 + 1];

                            boneIndices[vertexIndex * 4 + 0] = boneIndexData[elementIndex * 4 + 0];
                            boneIndices[vertexIndex * 4 + 1] = boneIndexData[elementIndex * 4 + 1];
                            boneIndices[vertexIndex * 4 + 2] = boneIndexData[elementIndex * 4 + 2];
                            boneIndices[vertexIndex * 4 + 3] = boneIndexData[elementIndex * 4 + 3];

                            boneWeights[vertexIndex * 4 + 0] = boneWeightData[elementIndex * 4 + 0];
                            boneWeights[vertexIndex * 4 + 1] = boneWeightData[elementIndex * 4 + 1];
                            boneWeights[vertexIndex * 4 + 2] = boneWeightData[elementIndex * 4 + 2];
                            boneWeights[vertexIndex * 4 + 3] = boneWeightData[elementIndex * 4 + 3];

                            if (boneSdefC !== null) {
                                const boneWeight0 = boneWeightData![elementIndex * 4 + 0];
                                const boneWeight1 = boneWeightData![elementIndex * 4 + 1];

                                const sdefC = sdefData!.c;
                                const sdefR0 = sdefData!.r0;
                                const sdefR1 = sdefData!.r1;

                                const centerX = sdefC[elementIndex * 3 + 0];
                                const centerY = sdefC[elementIndex * 3 + 1];
                                const centerZ = sdefC[elementIndex * 3 + 2];

                                // calculate rw0 and rw1
                                let r0X = sdefR0[elementIndex * 3 + 0];
                                let r0Y = sdefR0[elementIndex * 3 + 1];
                                let r0Z = sdefR0[elementIndex * 3 + 2];

                                let r1X = sdefR1[elementIndex * 3 + 0];
                                let r1Y = sdefR1[elementIndex * 3 + 1];
                                let r1Z = sdefR1[elementIndex * 3 + 2];

                                const rwX = r0X * boneWeight0 + r1X * boneWeight1;
                                const rwY = r0Y * boneWeight0 + r1Y * boneWeight1;
                                const rwZ = r0Z * boneWeight0 + r1Z * boneWeight1;

                                r0X = centerX + r0X - rwX;
                                r0Y = centerY + r0Y - rwY;
                                r0Z = centerZ + r0Z - rwZ;

                                r1X = centerX + r1X - rwX;
                                r1Y = centerY + r1Y - rwY;
                                r1Z = centerZ + r1Z - rwZ;

                                const cr0X = (centerX + r0X) * 0.5;
                                const cr0Y = (centerY + r0Y) * 0.5;
                                const cr0Z = (centerZ + r0Z) * 0.5;

                                const cr1X = (centerX + r1X) * 0.5;
                                const cr1Y = (centerY + r1Y) * 0.5;
                                const cr1Z = (centerZ + r1Z) * 0.5;

                                boneSdefC[vertexIndex * 3 + 0] = centerX;
                                boneSdefC[vertexIndex * 3 + 1] = centerY;
                                boneSdefC[vertexIndex * 3 + 2] = centerZ;

                                boneSdefR0![vertexIndex * 3 + 0] = cr0X;
                                boneSdefR0![vertexIndex * 3 + 1] = cr0Y;
                                boneSdefR0![vertexIndex * 3 + 2] = cr0Z;

                                boneSdefR1![vertexIndex * 3 + 0] = cr1X;
                                boneSdefR1![vertexIndex * 3 + 1] = cr1Y;
                                boneSdefR1![vertexIndex * 3 + 2] = cr1Z;
                            }

                            subMeshIndices[subMeshIndex] = vertexIndex;
                            indexToSubMeshIndexMap[elementIndex] = vertexIndex;
                            subMeshIndex += 1;
                            vertexIndex += 1;
                        } else {
                            subMeshIndices[subMeshIndex] = indexToSubMeshIndexMap[elementIndex];
                            subMeshIndex += 1;
                        }

                        if ((indexStartOffset + j) % 10000 === 0 && 100 < performance.now() - time) {
                            progress.setTaskProgress("Build Geometry", indexStartOffset + j);
                            progress.invokeProgressEvent();

                            await Tools.DelayAsync(0);
                            time = performance.now();
                        }
                    }

                    vertexData.positions = positions;
                    vertexData.normals = normals;
                    vertexData.uvs = uvs;
                    vertexData.indices = subMeshIndices;
                    vertexData.matricesIndices = boneIndices;
                    vertexData.matricesWeights = boneWeights;
                }

                scene._blockEntityCollection = !!assetContainer;
                const mesh = new (boneSdefC !== null ? SdefMesh : Mesh)(materialInfo.name, scene);
                mesh._parentContainer = assetContainer;
                scene._blockEntityCollection = false;
                mesh.setParent(rootMesh);
                meshes.push(mesh);

                scene._blockEntityCollection = !!assetContainer;
                const geometry = new Geometry(modelObject.header.modelName, scene, vertexData, false);
                geometry._parentContainer = assetContainer;
                scene._blockEntityCollection = false;
                if (boneSdefC !== null) {
                    geometry.setVerticesData(SdefBufferKind.MatricesSdefCKind, boneSdefC, false, 3);
                    geometry.setVerticesData(SdefBufferKind.MatricesSdefR0Kind, boneSdefR0!, false, 3);
                    geometry.setVerticesData(SdefBufferKind.MatricesSdefR1Kind, boneSdefR1!, false, 3);
                }
                geometry.applyToMesh(mesh);
                geometries.push(geometry);

                indexToSubmehIndexMaps.push({
                    map: indexToSubMeshIndexMap,
                    isReferencedVertex
                });
                vertexDataArray.push(vertexData);

                indexStartOffset += materialInfo.indexCount;
            }
        }

        progress.endTask("Build Geometry");
        progress.invokeProgressEvent();

        return {
            meshes,
            geometries,
            indices,
            indexToSubmehIndexMaps,
            vertexDataArray
        };
    }

    protected override async _buildMaterialAsync(
        state: BpmxLoadState,
        modelObject: BpmxObject,
        rootMesh: Mesh,
        meshes: Mesh[],
        textureNameMap: Nullable<Map<BaseTexture, string>>,
        scene: Scene,
        assetContainer: Nullable<AssetContainer>,
        rootUrl: string,
        progress: Progress
    ): Promise<BuildMaterialResult> {
        let buildMaterialsPromise: Material[] | Promise<Material[]> | undefined = undefined;

        const texturePathTable: string[] = new Array(modelObject.textures.length);
        for (let i = 0; i < modelObject.textures.length; ++i) {
            texturePathTable[i] = modelObject.textures[i].relativePath;
        }

        const textureLoadPromise = new Promise<void>((resolve) => {
            buildMaterialsPromise = state.materialBuilder.buildMaterials(
                rootMesh.uniqueId, // uniqueId
                modelObject.materials, // materialsInfo
                texturePathTable, // texturePathTable
                rootUrl, // rootUrl
                "file:" + state.pmFileId + "_", // fileRootId
                modelObject.textures, // referenceFiles
                scene, // scene
                assetContainer, // assetContainer
                meshes, // meshes
                textureNameMap, // textureNameMap
                this, // logger
                (event) => {
                    if (!event.lengthComputable) return;
                    progress.setTaskProgressRatio("Texture Load", event.loaded / event.total, true);
                    progress.invokeProgressEvent();
                }, // onTextureLoadProgress
                () => resolve() // onTextureLoadComplete
            );
        });
        const materials: Material[] = Array.isArray(buildMaterialsPromise)
            ? buildMaterialsPromise
            : await (buildMaterialsPromise as unknown as Promise<Material[]>);

        for (let i = 0; i < materials.length; ++i) meshes[i].material = materials[i];

        progress.endTask("Build Material");
        progress.invokeProgressEvent();

        return { materials, textureLoadPromise };
    }

    protected override async _buildMorphAsync(
        state: BpmxLoadState,
        modelObject: BpmxObject,
        buildGeometryResult: BpmxBuildGeometryResult,
        scene: Scene,
        assetContainer: Nullable<AssetContainer>,
        morphsMetadata: MmdModelMetadata.Morph[],
        progress: Progress
    ): Promise<MorphTargetManager[]> {
        const preserveSerializationData = state.preserveSerializationData;

        const vertexToSubMeshMap = new Int32Array(modelObject.geometry.positions.length / 3).fill(-1);
        // if vertexToSubMeshMap[i] === -2, vertex i has multiple submeshes references
        // if vertexToSubMeshMap[i] === -1, vertex i has no submeshes references
        const vertexToSubMeshSlowMap = new Map<number, number[]>();

        const indices = buildGeometryResult.indices;
        {
            const materials = modelObject.materials;
            let indexOffset = 0;
            for (let subMeshIndex = 0; subMeshIndex < materials.length; ++subMeshIndex) {
                const indexCount = materials[subMeshIndex].indexCount;
                for (let j = 0; j < indexCount; ++j) {
                    const elementIndex = indices[indexOffset + j];
                    if (vertexToSubMeshMap[elementIndex] === -1) {
                        vertexToSubMeshMap[elementIndex] = subMeshIndex;
                    } else if (vertexToSubMeshMap[elementIndex] === -2) {
                        const subMeshIndices = vertexToSubMeshSlowMap.get(elementIndex)!;
                        if (!subMeshIndices.includes(subMeshIndex)) {
                            subMeshIndices.push(subMeshIndex);
                        }
                    } else if (vertexToSubMeshMap[elementIndex] !== subMeshIndex) {
                        vertexToSubMeshSlowMap.set(elementIndex, [vertexToSubMeshMap[elementIndex], subMeshIndex]);
                        vertexToSubMeshMap[elementIndex] = -2;
                    }
                }

                indexOffset += indexCount;
            }
        }

        const indexToSubmeshIndexMaps = buildGeometryResult.indexToSubmehIndexMaps;
        const morphsInfo = modelObject.morphs;
        const vertexDataArray = buildGeometryResult.vertexDataArray;
        const subMeshesMorphTargets: MorphTarget[][] = new Array(vertexDataArray.length); // morphTargets[subMeshIndex][morphIndex]
        for (let i = 0; i < subMeshesMorphTargets.length; ++i) {
            subMeshesMorphTargets[i] = [];
        }

        let buildMorphProgress = 0;
        for (let morphIndex = 0; morphIndex < morphsInfo.length; ++morphIndex) {
            const morphInfo = morphsInfo[morphIndex];

            const morphTargets: MorphTarget[] = [];
            const elements: (MmdModelMetadata.SerializationVertexMorphElement | MmdModelMetadata.SerializationUvMorphElement)[] = [];

            // create morph metadata
            switch (morphInfo.type) {
            case PmxObject.Morph.Type.GroupMorph:
            case PmxObject.Morph.Type.BoneMorph:
            case PmxObject.Morph.Type.MaterialMorph:
                morphsMetadata.push(morphInfo);
                break;

            case PmxObject.Morph.Type.VertexMorph:
            case PmxObject.Morph.Type.UvMorph:
            case PmxObject.Morph.Type.AdditionalUvMorph1:
            case PmxObject.Morph.Type.AdditionalUvMorph2:
            case PmxObject.Morph.Type.AdditionalUvMorph3:
            case PmxObject.Morph.Type.AdditionalUvMorph4:
                morphsMetadata.push(<MmdModelMetadata.VertexMorph | MmdModelMetadata.UvMorph> {
                    name: morphInfo.name,
                    englishName: morphInfo.englishName,

                    category: morphInfo.category,
                    type: morphInfo.type,

                    morphTargets,

                    ...preserveSerializationData ? {
                        elements
                    } : undefined
                });
                break;
            }

            if (
                morphInfo.type !== PmxObject.Morph.Type.VertexMorph &&
                morphInfo.type !== PmxObject.Morph.Type.UvMorph &&
                morphInfo.type !== PmxObject.Morph.Type.AdditionalUvMorph1 &&
                morphInfo.type !== PmxObject.Morph.Type.AdditionalUvMorph2 &&
                morphInfo.type !== PmxObject.Morph.Type.AdditionalUvMorph3 &&
                morphInfo.type !== PmxObject.Morph.Type.AdditionalUvMorph4
            ) {
                // group morph, bone morph, material morph will be handled by cpu bound custom runtime
                continue;
            }

            const referencedSubMeshes: number[] = [];
            const morphIndices = morphInfo.indices;
            for (let i = 0; i < morphIndices.length; ++i) {
                const elementIndex = morphIndices[i];
                const subMeshIndex = vertexToSubMeshMap[elementIndex];
                if (subMeshIndex === -1) continue;

                if (subMeshIndex === -2) {
                    const subMeshIndices = vertexToSubMeshSlowMap.get(elementIndex)!;
                    for (let j = 0; j < subMeshIndices.length; ++j) {
                        const subMeshIndex = subMeshIndices[j];
                        if (!referencedSubMeshes.includes(subMeshIndex)) {
                            referencedSubMeshes.push(subMeshIndex);
                        }
                    }
                } else if (!referencedSubMeshes.includes(subMeshIndex)) {
                    referencedSubMeshes.push(subMeshIndex);
                }
            }
            for (let i = 0; i < referencedSubMeshes.length; ++i) {
                const morphTarget = new MorphTarget(morphInfo.name, 0, scene);
                morphTargets.push(morphTarget);
                subMeshesMorphTargets[referencedSubMeshes[i]].push(morphTarget);
            }

            if (morphInfo.type === PmxObject.Morph.Type.VertexMorph) {
                for (let i = 0; i < referencedSubMeshes.length; ++i) {
                    const subMeshIndex = referencedSubMeshes[i];

                    const vertexData = vertexDataArray[subMeshIndex];
                    const positions = new Float32Array(vertexData.positions!);
                    positions.set(vertexData.positions!);

                    const morphIndices = morphInfo.indices;
                    const positionOffsets = morphInfo.positions;

                    const indexToSubMeshIndexMap = indexToSubmeshIndexMaps[subMeshIndex].map;
                    const isReferencedVertex = indexToSubmeshIndexMaps[subMeshIndex].isReferencedVertex;
                    if (preserveSerializationData) {
                        let indexCount = 0;
                        for (let j = 0; j < morphIndices.length; ++j) {
                            if (isReferencedVertex[morphIndices[j]] === 0) continue;

                            const elementIndex = indexToSubMeshIndexMap[morphIndices[j]];
                            positions[elementIndex * 3 + 0] += positionOffsets[j * 3 + 0];
                            positions[elementIndex * 3 + 1] += positionOffsets[j * 3 + 1];
                            positions[elementIndex * 3 + 2] += positionOffsets[j * 3 + 2];
                            indexCount += 1;
                        }

                        const indices = new Int32Array(indexCount);
                        const offsets = new Float32Array(indexCount * 3);
                        for (let j = 0, k = 0; j < morphIndices.length; ++j) {
                            if (isReferencedVertex[morphIndices[j]] === 0) continue;

                            const elementIndex = indexToSubMeshIndexMap[morphIndices[j]];
                            indices[k] = elementIndex;
                            offsets[k * 3 + 0] = positionOffsets[j * 3 + 0];
                            offsets[k * 3 + 1] = positionOffsets[j * 3 + 1];
                            offsets[k * 3 + 2] = positionOffsets[j * 3 + 2];
                            k += 1;
                        }
                        elements.push({
                            meshIndex: subMeshIndex,
                            indices,
                            offsets
                        });
                    } else {
                        for (let j = 0; j < morphIndices.length; ++j) {
                            if (isReferencedVertex[morphIndices[j]] === 0) continue;

                            const elementIndex = indexToSubMeshIndexMap[morphIndices[j]];
                            positions[elementIndex * 3 + 0] += positionOffsets[j * 3 + 0];
                            positions[elementIndex * 3 + 1] += positionOffsets[j * 3 + 1];
                            positions[elementIndex * 3 + 2] += positionOffsets[j * 3 + 2];
                        }
                    }

                    morphTargets[i].setPositions(positions);
                }
            } else /*if (morphInfo.type === PmxObject.Morph.Type.uvMorph)*/ {
                for (let i = 0; i < referencedSubMeshes.length; ++i) {
                    const subMeshIndex = referencedSubMeshes[i];

                    const vertexData = vertexDataArray[subMeshIndex];
                    const uvs = new Float32Array(vertexData.uvs!);
                    uvs.set(vertexData.uvs!);

                    const morphIndices = morphInfo.indices;
                    const uvOffsets = morphInfo.offsets;

                    const indexToSubMeshIndexMap = indexToSubmeshIndexMaps[subMeshIndex].map;
                    const isReferencedVertex = indexToSubmeshIndexMaps[subMeshIndex].isReferencedVertex;
                    if (preserveSerializationData) {
                        let indexCount = 0;
                        for (let j = 0; j < morphIndices.length; ++j) {
                            if (isReferencedVertex[morphIndices[j]] === 0) continue;

                            const elementIndex = indexToSubMeshIndexMap[morphIndices[j]];
                            uvs[elementIndex * 2 + 0] += uvOffsets[j * 4 + 0];
                            uvs[elementIndex * 2 + 1] += uvOffsets[j * 4 + 1];
                            indexCount += 1;
                        }

                        const indices = new Int32Array(indexCount);
                        const offsets = new Float32Array(indexCount * 4);
                        for (let j = 0, k = 0; j < morphIndices.length; ++j) {
                            if (isReferencedVertex[morphIndices[j]] === 0) continue;

                            const elementIndex = indexToSubMeshIndexMap[morphIndices[j]];
                            indices[k] = elementIndex;
                            offsets[k * 4 + 0] = uvOffsets[j * 4 + 0];
                            offsets[k * 4 + 1] = uvOffsets[j * 4 + 1];
                            offsets[k * 4 + 2] = uvOffsets[j * 4 + 2];
                            offsets[k * 4 + 3] = uvOffsets[j * 4 + 3];
                            k += 1;
                        }
                        elements.push({
                            meshIndex: subMeshIndex,
                            indices,
                            offsets
                        });
                    } else {
                        for (let j = 0; j < morphIndices.length; ++j) {
                            if (isReferencedVertex[morphIndices[j]] === 0) continue;

                            const elementIndex = indexToSubMeshIndexMap[morphIndices[j]];
                            uvs[elementIndex * 2 + 0] += uvOffsets[j * 4 + 0];
                            uvs[elementIndex * 2 + 1] += uvOffsets[j * 4 + 1];
                        }
                    }

                    const morphTarget = morphTargets[i];
                    morphTarget.setPositions(vertexData.positions);
                    morphTarget.setUVs(uvs);
                }
            }
            progress.setTaskProgress("Build Morph", buildMorphProgress + morphIndices.length);
            buildMorphProgress += morphIndices.length;
        }
        progress.endTask("Build Morph");

        const morphTargetManagers: MorphTargetManager[] = [];
        const meshes = buildGeometryResult.meshes;
        for (let subMeshIndex = 0; subMeshIndex < subMeshesMorphTargets.length; ++subMeshIndex) {
            const subMeshMorphTargets = subMeshesMorphTargets[subMeshIndex];
            if (subMeshMorphTargets.length === 0) continue;

            scene._blockEntityCollection = !!assetContainer;
            const morphTargetManager = new MorphTargetManager(scene);
            morphTargetManager._parentContainer = assetContainer;
            scene._blockEntityCollection = false;

            morphTargetManager.areUpdatesFrozen = true;
            for (let i = 0; i < subMeshMorphTargets.length; ++i) {
                morphTargetManager.addTarget(subMeshMorphTargets[i]);
            }
            morphTargetManager.areUpdatesFrozen = false;

            morphTargetManagers.push(morphTargetManager);
            meshes[subMeshIndex].morphTargetManager = morphTargetManager;
        }
        return morphTargetManagers;
    }
}

if (SceneLoader) {
    SceneLoader.RegisterPlugin(new BpmxLoader());
}
