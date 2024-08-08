import type { AssetContainer } from "@babylonjs/core/assetContainer";
import { VertexBuffer } from "@babylonjs/core/Buffers/buffer";
import type { ISceneLoaderPluginAsync, ISceneLoaderPluginExtensions, ISceneLoaderProgressEvent } from "@babylonjs/core/Loading/sceneLoader";
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

import type { TextureInfo } from "./IMmdMaterialBuilder";
import { MmdBufferKind } from "./mmdBufferKind";
import type { BuildMaterialResult, MmdModelBuildGeometryResult, MmdModelLoaderOptions, MmdModelLoadState } from "./mmdModelLoader";
import { MmdModelLoader } from "./mmdModelLoader";
import type { MmdModelMetadata } from "./mmdModelMetadata";
import { ObjectUniqueIdProvider } from "./objectUniqueIdProvider";
import type { ILogger } from "./Parser/ILogger";
import { PmxObject } from "./Parser/pmxObject";
import type { Progress, ProgressTask } from "./progress";
import { SdefMesh } from "./sdefMesh";

/**
 * Options for loading PMX / PMD model
 */
export interface PmLoaderOptions extends MmdModelLoaderOptions {
    /**
     * Reference files for load PMX / PMD from files (textures)
     *
     * This property is used to load textures from files
     *
     * pmx / pmd files typically store texture files separately in a subdirectory of url root
     *
     * Therefore, in order to load it as a file, you need to put information about these files separately
     */
    readonly referenceFiles: readonly File[];
}

interface PmLoadState extends MmdModelLoadState {
    readonly referenceFiles: readonly File[];
}

interface PmBuildGeometryResult extends MmdModelBuildGeometryResult {
    readonly indices: Uint16Array | Uint32Array;
    readonly indexToSubmehIndexMaps: {
        map: Uint8Array | Uint16Array | Int32Array;
        isReferencedVertex: Uint8Array;
    }[];
}

/**
 * @internal
 * Base class of pmx / pmd loader
 */
export abstract class PmLoader extends MmdModelLoader<PmLoadState, PmxObject, PmBuildGeometryResult> implements PmLoaderOptions, ISceneLoaderPluginAsync, ILogger {
    /**
     * Reference files for load PMX / PMD from files (textures)
     *
     * This property is used to load textures from files
     *
     * pmx / pmd files typically store texture files separately in a subdirectory of url root
     *
     * Therefore, in order to load it as a file, you need to put information about these files separately
     */
    public referenceFiles: readonly File[];

    /**
     * Create a new PmLoader
     */
    public constructor(name: string, extensions: ISceneLoaderPluginExtensions, options: Partial<PmLoaderOptions> = {}, loaderOptions?: PmLoaderOptions) {
        super(name, extensions, options, loaderOptions);

        this.referenceFiles = options.referenceFiles ?? loaderOptions?.referenceFiles ?? [];
    }

    public loadFile(
        scene: Scene,
        fileOrUrl: string | File,
        _rootUrl: string,
        onSuccess: (data: PmLoadState, responseURL?: string | undefined) => void,
        onProgress?: ((ev: ISceneLoaderProgressEvent) => void) | undefined,
        useArrayBuffer?: boolean | undefined,
        onError?: ((request?: WebRequest | undefined, exception?: LoadFileError | undefined) => void) | undefined
    ): IFileRequest {
        const materialBuilder = this.materialBuilder;
        const useSdef = this.useSdef;
        const buildSkeleton = this.buildSkeleton;
        const buildMorph = this.buildMorph;
        const boundingBoxMargin = this.boundingBoxMargin;
        const referenceFiles = this.referenceFiles;
        const preserveSerializationData = this.preserveSerializationData;

        const request = scene._loadFile(
            fileOrUrl,
            (data, responseURL) => {
                const loadState: PmLoadState = {
                    arrayBuffer: data as ArrayBuffer,
                    pmFileId: fileOrUrl instanceof File ? ObjectUniqueIdProvider.GetId(fileOrUrl).toString() : fileOrUrl,
                    materialBuilder,
                    useSdef,
                    buildSkeleton,
                    buildMorph,
                    boundingBoxMargin,
                    referenceFiles,
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

    protected override _getProgressTaskCosts(state: PmLoadState, modelObject: PmxObject): ProgressTask[] {
        const tasks = super._getProgressTaskCosts(state, modelObject);

        tasks.push({ name: "Build Geometry", cost: modelObject.indices.length });

        if (state.buildMorph) {
            let buildMorphCost = 0;
            const morphsInfo = modelObject.morphs;
            for (let i = 0; i < morphsInfo.length; ++i) {
                const morphInfo = morphsInfo[i];
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

                buildMorphCost += morphInfo.indices.length;
            }
            tasks.push({ name: "Build Morph", cost: buildMorphCost });
        }

        return tasks;
    }

    protected override async _buildGeometryAsync(
        state: PmLoadState,
        modelObject: PmxObject,
        rootMesh: Mesh,
        scene: Scene,
        assetContainer: Nullable<AssetContainer>,
        progress: Progress
    ): Promise<PmBuildGeometryResult> {
        const meshes: Mesh[] = [];
        const geometries: Geometry[] = [];
        let indices: Uint16Array | Uint32Array;
        const indexToSubmehIndexMaps: PmBuildGeometryResult["indexToSubmehIndexMaps"] = [];
        {
            if (modelObject.indices instanceof Uint8Array || modelObject.indices instanceof Uint16Array) {
                indices = new Uint16Array(modelObject.indices.length);
            } else {
                indices = new Uint32Array(modelObject.indices.length);
            }
            {
                const indiceInfo = modelObject.indices;
                for (let i = 0; i < indices.length; i += 3) { // reverse winding order
                    indices[i + 0] = indiceInfo[i + 0];
                    indices[i + 1] = indiceInfo[i + 2];
                    indices[i + 2] = indiceInfo[i + 1];
                }
            }

            const materials = modelObject.materials;
            let indexStartOffset = 0;
            for (let i = 0; i < materials.length; ++i) {
                const materialInfo = materials[i];

                const isReferencedVertex = new Uint8Array(modelObject.vertices.length);//.fill(0);
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
                const additionalUvs: Float32Array[] = [];
                if (state.preserveSerializationData) {
                    for (let j = 0; j < modelObject.header.additionalVec4Count; ++j) {
                        additionalUvs.push(new Float32Array(subMeshVertexCount * 4));
                    }
                }
                let boneSdefC: Nullable<Float32Array> = null;
                let boneSdefR0: Nullable<Float32Array> = null;
                let boneSdefR1: Nullable<Float32Array> = null;
                let boneSdefRW0: Nullable<Float32Array> = null;
                let boneSdefRW1: Nullable<Float32Array> = null;
                if (state.buildSkeleton && state.useSdef) {
                    boneSdefC = new Float32Array(subMeshVertexCount * 3);
                    boneSdefR0 = new Float32Array(subMeshVertexCount * 3);
                    boneSdefR1 = new Float32Array(subMeshVertexCount * 3);
                    boneSdefRW0 = new Float32Array(subMeshVertexCount * 3);
                    boneSdefRW1 = new Float32Array(subMeshVertexCount * 3);
                }
                let hasSdef = false;
                let edgeScale: Nullable<Float32Array> = null;
                if (state.preserveSerializationData) {
                    edgeScale = new Float32Array(subMeshVertexCount);
                }
                const indexToSubMeshIndexMap = new (modelObject.indices.constructor as new (length: number) => typeof modelObject.indices)(modelObject.vertices.length);
                {
                    const positions = new Float32Array(subMeshVertexCount * 3);
                    const normals = new Float32Array(subMeshVertexCount * 3);
                    const uvs = new Float32Array(subMeshVertexCount * 2);
                    const subMeshIndices = new (indices.constructor as new (length: number) => typeof indices)(materialInfo.indexCount);
                    let boneIndices: Nullable<Float32Array> = null;
                    let boneWeights: Nullable<Float32Array> = null;
                    if (state.buildSkeleton) {
                        boneIndices = new Float32Array(subMeshVertexCount * 4);
                        boneWeights = new Float32Array(subMeshVertexCount * 4);
                    }

                    let time = performance.now();
                    let vertexIndex = 0;
                    let subMeshIndex = 0;
                    const indexCount = materialInfo.indexCount;
                    for (let j = 0; j < indexCount; ++j) {
                        const elementIndex = indices[indexStartOffset + j];
                        if (isReferencedVertex[elementIndex] === 0) {
                            isReferencedVertex[elementIndex] = 1;

                            const vertex = modelObject.vertices[elementIndex];

                            positions[vertexIndex * 3 + 0] = vertex.position[0];
                            positions[vertexIndex * 3 + 1] = vertex.position[1];
                            positions[vertexIndex * 3 + 2] = vertex.position[2];

                            normals[vertexIndex * 3 + 0] = vertex.normal[0];
                            normals[vertexIndex * 3 + 1] = vertex.normal[1];
                            normals[vertexIndex * 3 + 2] = vertex.normal[2];

                            uvs[vertexIndex * 2 + 0] = vertex.uv[0];
                            uvs[vertexIndex * 2 + 1] = 1 - vertex.uv[1]; // flip y axis

                            const additionalVec4 = vertex.additionalVec4;
                            for (let k = 0; k < additionalUvs.length; ++k) {
                                additionalUvs[k][vertexIndex * 4 + 0] = additionalVec4[k][0];
                                additionalUvs[k][vertexIndex * 4 + 1] = additionalVec4[k][1];
                                additionalUvs[k][vertexIndex * 4 + 2] = additionalVec4[k][2];
                                additionalUvs[k][vertexIndex * 4 + 3] = additionalVec4[k][3];
                            }

                            if (state.buildSkeleton) {
                                switch (vertex.weightType) {
                                case PmxObject.Vertex.BoneWeightType.Bdef1:
                                    {
                                        const boneWeight = vertex.boneWeight as PmxObject.Vertex.BoneWeight<PmxObject.Vertex.BoneWeightType.Bdef1>;

                                        boneIndices![vertexIndex * 4 + 0] = boneWeight.boneIndices;
                                        boneIndices![vertexIndex * 4 + 1] = 0;
                                        boneIndices![vertexIndex * 4 + 2] = 0;
                                        boneIndices![vertexIndex * 4 + 3] = 0;

                                        boneWeights![vertexIndex * 4 + 0] = 1;
                                        boneWeights![vertexIndex * 4 + 1] = 0;
                                        boneWeights![vertexIndex * 4 + 2] = 0;
                                        boneWeights![vertexIndex * 4 + 3] = 0;
                                    }
                                    break;

                                case PmxObject.Vertex.BoneWeightType.Bdef2:
                                    {
                                        const boneWeight = vertex.boneWeight as PmxObject.Vertex.BoneWeight<PmxObject.Vertex.BoneWeightType.Bdef2>;

                                        boneIndices![vertexIndex * 4 + 0] = boneWeight.boneIndices[0];
                                        boneIndices![vertexIndex * 4 + 1] = boneWeight.boneIndices[1];
                                        boneIndices![vertexIndex * 4 + 2] = 0;
                                        boneIndices![vertexIndex * 4 + 3] = 0;

                                        boneWeights![vertexIndex * 4 + 0] = boneWeight.boneWeights;
                                        boneWeights![vertexIndex * 4 + 1] = 1 - boneWeight.boneWeights;
                                        boneWeights![vertexIndex * 4 + 2] = 0;
                                        boneWeights![vertexIndex * 4 + 3] = 0;
                                    }
                                    break;

                                case PmxObject.Vertex.BoneWeightType.Bdef4:
                                case PmxObject.Vertex.BoneWeightType.Qdef: // pmx 2.1 not support fallback to bdef4
                                    {
                                        const boneWeight = vertex.boneWeight as PmxObject.Vertex.BoneWeight<PmxObject.Vertex.BoneWeightType.Bdef4>;

                                        boneIndices![vertexIndex * 4 + 0] = boneWeight.boneIndices[0];
                                        boneIndices![vertexIndex * 4 + 1] = boneWeight.boneIndices[1];
                                        boneIndices![vertexIndex * 4 + 2] = boneWeight.boneIndices[2];
                                        boneIndices![vertexIndex * 4 + 3] = boneWeight.boneIndices[3];

                                        boneWeights![vertexIndex * 4 + 0] = boneWeight.boneWeights[0];
                                        boneWeights![vertexIndex * 4 + 1] = boneWeight.boneWeights[1];
                                        boneWeights![vertexIndex * 4 + 2] = boneWeight.boneWeights[2];
                                        boneWeights![vertexIndex * 4 + 3] = boneWeight.boneWeights[3];
                                    }
                                    break;

                                case PmxObject.Vertex.BoneWeightType.Sdef:
                                    {
                                        const boneWeight = vertex.boneWeight as PmxObject.Vertex.BoneWeight<PmxObject.Vertex.BoneWeightType.Sdef>;

                                        boneIndices![vertexIndex * 4 + 0] = boneWeight.boneIndices[0];
                                        boneIndices![vertexIndex * 4 + 1] = boneWeight.boneIndices[1];
                                        boneIndices![vertexIndex * 4 + 2] = 0;
                                        boneIndices![vertexIndex * 4 + 3] = 0;

                                        const sdefWeights = boneWeight.boneWeights;
                                        const boneWeight0 = sdefWeights.boneWeight0;
                                        const boneWeight1 = 1 - boneWeight0;

                                        boneWeights![vertexIndex * 4 + 0] = boneWeight0;
                                        boneWeights![vertexIndex * 4 + 1] = boneWeight1;
                                        boneWeights![vertexIndex * 4 + 2] = 0;
                                        boneWeights![vertexIndex * 4 + 3] = 0;

                                        if (state.useSdef) {
                                            const centerX = sdefWeights.c[0];
                                            const centerY = sdefWeights.c[1];
                                            const centerZ = sdefWeights.c[2];

                                            // calculate rw0 and rw1
                                            let r0X = sdefWeights.r0[0];
                                            let r0Y = sdefWeights.r0[1];
                                            let r0Z = sdefWeights.r0[2];

                                            let r1X = sdefWeights.r1[0];
                                            let r1Y = sdefWeights.r1[1];
                                            let r1Z = sdefWeights.r1[2];

                                            boneSdefR0![vertexIndex * 3 + 0] = r0X;
                                            boneSdefR0![vertexIndex * 3 + 1] = r0Y;
                                            boneSdefR0![vertexIndex * 3 + 2] = r0Z;

                                            boneSdefR1![vertexIndex * 3 + 0] = r1X;
                                            boneSdefR1![vertexIndex * 3 + 1] = r1Y;
                                            boneSdefR1![vertexIndex * 3 + 2] = r1Z;

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

                                            boneSdefC![vertexIndex * 3 + 0] = centerX;
                                            boneSdefC![vertexIndex * 3 + 1] = centerY;
                                            boneSdefC![vertexIndex * 3 + 2] = centerZ;

                                            boneSdefRW0![vertexIndex * 3 + 0] = cr0X;
                                            boneSdefRW0![vertexIndex * 3 + 1] = cr0Y;
                                            boneSdefRW0![vertexIndex * 3 + 2] = cr0Z;

                                            boneSdefRW1![vertexIndex * 3 + 0] = cr1X;
                                            boneSdefRW1![vertexIndex * 3 + 1] = cr1Y;
                                            boneSdefRW1![vertexIndex * 3 + 2] = cr1Z;

                                            hasSdef = true;
                                        }
                                    }
                                    break;
                                }
                            }

                            if (state.preserveSerializationData) {
                                edgeScale![vertexIndex] = vertex.edgeScale;
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
                const mesh = new (state.useSdef && hasSdef ? SdefMesh : Mesh)(materialInfo.name, scene);
                mesh._parentContainer = assetContainer;
                scene._blockEntityCollection = false;
                mesh.setParent(rootMesh);
                meshes.push(mesh);

                scene._blockEntityCollection = !!assetContainer;
                const geometry = new Geometry(modelObject.header.modelName, scene, vertexData, false);
                geometry._parentContainer = assetContainer;
                scene._blockEntityCollection = false;
                if (state.preserveSerializationData) {
                    if (1 <= additionalUvs.length) geometry.setVerticesData(MmdBufferKind.AdditionalUV1Kind, additionalUvs[0], false, 4);
                    if (2 <= additionalUvs.length) geometry.setVerticesData(MmdBufferKind.AdditionalUV2Kind, additionalUvs[1], false, 4);
                    if (3 <= additionalUvs.length) geometry.setVerticesData(MmdBufferKind.AdditionalUV3Kind, additionalUvs[2], false, 4);
                    if (4 <= additionalUvs.length) geometry.setVerticesData(MmdBufferKind.AdditionalUV4Kind, additionalUvs[3], false, 4);
                }
                if (state.useSdef && hasSdef) {
                    geometry.setVerticesData(MmdBufferKind.MatricesSdefCKind, boneSdefC!, false, 3);
                    geometry.setVerticesData(MmdBufferKind.MatricesSdefR0Kind, boneSdefR0!, false, 3);
                    geometry.setVerticesData(MmdBufferKind.MatricesSdefR1Kind, boneSdefR1!, false, 3);
                    geometry.setVerticesData(MmdBufferKind.MatricesSdefRW0Kind, boneSdefRW0!, false, 3);
                    geometry.setVerticesData(MmdBufferKind.MatricesSdefRW1Kind, boneSdefRW1!, false, 3);
                }
                if (state.preserveSerializationData) {
                    geometry.setVerticesData(MmdBufferKind.EdgeScaleKind, edgeScale!, false, 1);
                }
                geometry.applyToMesh(mesh);
                geometries.push(geometry);

                indexToSubmehIndexMaps.push({
                    map: indexToSubMeshIndexMap,
                    isReferencedVertex
                });

                indexStartOffset += materialInfo.indexCount;
            }
        }

        progress.endTask("Build Geometry");
        progress.invokeProgressEvent();

        return {
            meshes,
            geometries,
            indices,
            indexToSubmehIndexMaps
        };
    }

    protected override async _buildMaterialAsync(
        state: PmLoadState,
        modelObject: PmxObject,
        rootMesh: Mesh,
        meshes: Mesh[],
        textureNameMap: Nullable<Map<BaseTexture, string>>,
        scene: Scene,
        assetContainer: Nullable<AssetContainer>,
        rootUrl: string,
        progress: Progress
    ): Promise<BuildMaterialResult> {
        let buildMaterialsPromise: Material[] | Promise<Material[]> | undefined = undefined;

        const texturesInfo: TextureInfo[] = new Array(modelObject.textures.length);
        for (let i = 0; i < texturesInfo.length; ++i) {
            texturesInfo[i] = {
                noMipmap: false,
                invertY: true,
                samplingMode: undefined,
                imagePathIndex: i
            };
        }

        const referencedMeshList: (readonly Mesh[])[] = [];
        for (let i = 0; i < meshes.length; ++i) {
            referencedMeshList.push([meshes[i]]);
        }

        const textureLoadPromise = new Promise<void>((resolve) => {
            buildMaterialsPromise = state.materialBuilder.buildMaterials(
                rootMesh.uniqueId, // uniqueId

                modelObject.materials, // materialsInfo

                texturesInfo, // texturesInfo
                modelObject.textures, // imagePathTable

                rootUrl, // rootUrl
                "file:" + state.pmFileId + "_", // fileRootId
                state.referenceFiles, // referenceFiles

                referencedMeshList, // referencedMeshes

                meshes, // meshes

                scene, // scene
                assetContainer, // assetContainer

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

        return { materials, multiMaterials: [], textureLoadPromise };
    }

    protected override async _buildMorphAsync(
        state: PmLoadState,
        modelObject: PmxObject,
        buildGeometryResult: PmBuildGeometryResult,
        scene: Scene,
        assetContainer: Nullable<AssetContainer>,
        morphsMetadata: MmdModelMetadata.Morph[],
        progress: Progress
    ): Promise<MorphTargetManager[]> {
        const preserveSerializationData = state.preserveSerializationData;

        const vertexToSubMeshMap = new Int32Array(modelObject.vertices.length).fill(-1);
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
        const geometries = buildGeometryResult.geometries;
        const subMeshesMorphTargets: MorphTarget[][] = new Array(geometries.length); // morphTargets[subMeshIndex][morphIndex]
        for (let i = 0; i < subMeshesMorphTargets.length; ++i) {
            subMeshesMorphTargets[i] = [];
        }

        let buildMorphProgress = 0;
        let time = performance.now();
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

            default:
                this.warn(`Unsupported morph type: ${morphInfo.type}`);
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
            {
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
                if (morphInfo.type !== PmxObject.Morph.Type.AdditionalUvMorph1 &&
                    morphInfo.type !== PmxObject.Morph.Type.AdditionalUvMorph2 &&
                    morphInfo.type !== PmxObject.Morph.Type.AdditionalUvMorph3 &&
                    morphInfo.type !== PmxObject.Morph.Type.AdditionalUvMorph4) {
                    for (let i = 0; i < referencedSubMeshes.length; ++i) {
                        const morphTarget = new MorphTarget(morphInfo.name, 0, scene);
                        morphTargets.push(morphTarget);
                        subMeshesMorphTargets[referencedSubMeshes[i]].push(morphTarget);
                    }
                }
            }

            if (morphInfo.type === PmxObject.Morph.Type.VertexMorph) {
                for (let i = 0; i < referencedSubMeshes.length; ++i) {
                    const subMeshIndex = referencedSubMeshes[i];

                    const geometry = geometries[subMeshIndex];
                    const positions = new Float32Array(geometry.getVerticesData(VertexBuffer.PositionKind)!);

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
            } else if (morphInfo.type === PmxObject.Morph.Type.UvMorph) {
                for (let i = 0; i < referencedSubMeshes.length; ++i) {
                    const subMeshIndex = referencedSubMeshes[i];

                    const geometry = geometries[subMeshIndex];
                    const uvs = new Float32Array(geometry.getVerticesData(VertexBuffer.UVKind)!);

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
                            uvs[elementIndex * 2 + 1] -= uvOffsets[j * 4 + 1]; // flip y axis
                            indexCount += 1;
                        }

                        const indices = new Int32Array(indexCount);
                        const offsets = new Float32Array(indexCount * 4);
                        for (let j = 0, k = 0; j < morphIndices.length; ++j) {
                            if (isReferencedVertex[morphIndices[j]] === 0) continue;

                            const elementIndex = indexToSubMeshIndexMap[morphIndices[j]];
                            indices[k] = elementIndex;
                            offsets[k * 4 + 0] = uvOffsets[j * 4 + 0];
                            offsets[k * 4 + 1] = -uvOffsets[j * 4 + 1]; // flip y axis
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
                            uvs[elementIndex * 2 + 1] -= uvOffsets[j * 4 + 1]; // flip y axis
                        }
                    }

                    const morphTarget = morphTargets[i];
                    morphTarget.setPositions(geometry.getVerticesData(VertexBuffer.PositionKind)!);
                    morphTarget.setUVs(uvs);
                }
            } else {
                if (preserveSerializationData) {
                    for (let i = 0; i < referencedSubMeshes.length; ++i) {
                        const subMeshIndex = referencedSubMeshes[i];
                        const indexToSubMeshIndexMap = indexToSubmeshIndexMaps[subMeshIndex].map;
                        const isReferencedVertex = indexToSubmeshIndexMaps[subMeshIndex].isReferencedVertex;

                        const morphIndices = morphInfo.indices;
                        const uvOffsets = morphInfo.offsets;

                        let indexCount = 0;
                        for (let j = 0; j < morphIndices.length; ++j) {
                            if (isReferencedVertex[morphIndices[j]] === 0) continue;
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
                    }
                }
            }
            buildMorphProgress += morphInfo.indices.length;
            if (100 < performance.now() - time) {
                progress.setTaskProgress("Build Morph", buildMorphProgress);
                progress.invokeProgressEvent();

                await Tools.DelayAsync(0);
                time = performance.now();
            }
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

            morphTargetManager.enableNormalMorphing = false;
            morphTargetManager.enableTangentMorphing = false;
            morphTargetManager.enableUVMorphing = false;

            morphTargetManager.areUpdatesFrozen = true;
            for (let i = 0; i < subMeshMorphTargets.length; ++i) {
                const subMeshMorphTarget = subMeshMorphTargets[i];
                morphTargetManager.addTarget(subMeshMorphTarget);
                if (subMeshMorphTarget.hasUVs) morphTargetManager.enableUVMorphing = true;
            }
            if (morphTargetManager.enableUVMorphing) {
                const uvs = geometries[subMeshIndex].getVerticesData(VertexBuffer.UVKind)!;

                for (let i = 0; i < subMeshMorphTargets.length; ++i) {
                    const subMeshMorphTarget = subMeshMorphTargets[i];
                    if (!subMeshMorphTarget.hasUVs) {
                        subMeshMorphTarget.setUVs(uvs);
                    }
                }
            }
            morphTargetManager.areUpdatesFrozen = false;

            morphTargetManagers.push(morphTargetManager);
            meshes[subMeshIndex].morphTargetManager = morphTargetManager;
        }
        return morphTargetManagers;
    }
}
