import type { AssetContainer } from "@babylonjs/core/assetContainer";
import type { Skeleton } from "@babylonjs/core/Bones/skeleton";
import { VertexBuffer } from "@babylonjs/core/Buffers/buffer";
import { type ISceneLoaderPluginAsync, type ISceneLoaderProgressEvent, SceneLoader } from "@babylonjs/core/Loading/sceneLoader";
import type { Material } from "@babylonjs/core/Materials/material";
import { MultiMaterial } from "@babylonjs/core/Materials/multiMaterial";
import type { BaseTexture } from "@babylonjs/core/Materials/Textures/baseTexture";
import { Geometry } from "@babylonjs/core/Meshes/geometry";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { VertexData } from "@babylonjs/core/Meshes/mesh.vertexData";
import { SubMesh } from "@babylonjs/core/Meshes/subMesh";
import type { IFileRequest } from "@babylonjs/core/Misc/fileRequest";
import type { LoadFileError } from "@babylonjs/core/Misc/fileTools";
import { Tools } from "@babylonjs/core/Misc/tools";
import type { WebRequest } from "@babylonjs/core/Misc/webRequest";
import { MorphTarget } from "@babylonjs/core/Morph/morphTarget";
import { MorphTargetManager } from "@babylonjs/core/Morph/morphTargetManager";
import type { Scene } from "@babylonjs/core/scene";
import type { Nullable } from "@babylonjs/core/types";

import type { ReferencedMesh, TextureInfo } from "../IMmdMaterialBuilder";
import { MmdBufferKind } from "../mmdBufferKind";
import type { BuildMaterialResult, MmdModelBuildGeometryResult } from "../mmdModelLoader";
import { MmdModelLoader, type MmdModelLoadState } from "../mmdModelLoader";
import type { MmdModelMetadata } from "../mmdModelMetadata";
import { ObjectUniqueIdProvider } from "../objectUniqueIdProvider";
import type { ILogger } from "../Parser/ILogger";
import { PmxObject } from "../Parser/pmxObject";
import type { Progress, ProgressTask } from "../progress";
import { SdefMesh } from "../sdefMesh";
import { BpmxObject } from "./Parser/bpmxObject";
import { BpmxReader } from "./Parser/bpmxReader";

interface BpmxLoadState extends MmdModelLoadState { }

interface BpmxBuildGeometryResult extends MmdModelBuildGeometryResult { }

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

        let geometriesPositionCount = 0;
        for (let i = 0; i < modelObject.geometries.length; ++i) geometriesPositionCount += modelObject.geometries[i].positions.length;
        tasks.push({ name: "Build Geometry", cost: geometriesPositionCount });

        if (state.buildMorph) {
            let buildMorphCost = 0;
            const morphsInfo = modelObject.morphs;
            for (let i = 0; i < morphsInfo.length; ++i) {
                const morphInfo = morphsInfo[i];
                if (
                    morphInfo.type !== PmxObject.Morph.Type.VertexMorph &&
                    morphInfo.type !== PmxObject.Morph.Type.UvMorph
                    // morphInfo.type !== PmxObject.Morph.Type.AdditionalUvMorph1 &&
                    // morphInfo.type !== PmxObject.Morph.Type.AdditionalUvMorph2 &&
                    // morphInfo.type !== PmxObject.Morph.Type.AdditionalUvMorph3 &&
                    // morphInfo.type !== PmxObject.Morph.Type.AdditionalUvMorph4
                ) {
                    // group morph, bone morph, material morph will be handled by cpu bound custom runtime
                    continue;
                }

                const elements = morphInfo.elements;
                for (let j = 0; j < elements.length; ++j) buildMorphCost += elements[j].indices.length;
            }
            tasks.push({ name: "Build Morph", cost: buildMorphCost });
        }

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

        let time = performance.now();
        let processedPositionCount = 0;

        const geometriesInfo = modelObject.geometries;
        for (let i = 0; i < geometriesInfo.length; ++i) {
            const geometryInfo = geometriesInfo[i];
            const skinning = geometryInfo.skinning;

            const vertexData = new VertexData();
            vertexData.positions = geometryInfo.positions;
            vertexData.normals = geometryInfo.normals;
            vertexData.uvs = geometryInfo.uvs;
            if (geometryInfo.indices !== undefined) vertexData.indices = geometryInfo.indices;
            if (state.buildSkeleton && skinning !== undefined) {
                vertexData.matricesIndices = skinning.matricesIndices;
                vertexData.matricesWeights = skinning.matricesWeights;
            }
            let boneSdefC: Nullable<Float32Array> = null;
            let boneSdefRW0: Nullable<Float32Array> = null;
            let boneSdefRW1: Nullable<Float32Array> = null;
            if (state.buildSkeleton && state.useSdef && skinning?.sdef !== undefined) {
                const elementCount = geometryInfo.positions.length / 3;
                const matriciesWeights = skinning.matricesWeights;
                boneSdefC = skinning.sdef.c;
                boneSdefRW0 = skinning.sdef.r0;
                boneSdefRW1 = skinning.sdef.r1;

                for (let elementIndex = 0; elementIndex < elementCount; ++elementIndex) {
                    const boneWeight0 = matriciesWeights![elementIndex * 4 + 0];
                    const boneWeight1 = matriciesWeights![elementIndex * 4 + 1];

                    const centerX = boneSdefC[elementIndex * 3 + 0];
                    const centerY = boneSdefC[elementIndex * 3 + 1];
                    const centerZ = boneSdefC[elementIndex * 3 + 2];

                    // calculate rw0 and rw1
                    let r0X = boneSdefRW0[elementIndex * 3 + 0];
                    let r0Y = boneSdefRW0[elementIndex * 3 + 1];
                    let r0Z = boneSdefRW0[elementIndex * 3 + 2];

                    let r1X = boneSdefRW1[elementIndex * 3 + 0];
                    let r1Y = boneSdefRW1[elementIndex * 3 + 1];
                    let r1Z = boneSdefRW1[elementIndex * 3 + 2];

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

                    boneSdefC[elementIndex * 3 + 0] = centerX;
                    boneSdefC[elementIndex * 3 + 1] = centerY;
                    boneSdefC[elementIndex * 3 + 2] = centerZ;

                    boneSdefRW0![elementIndex * 3 + 0] = cr0X;
                    boneSdefRW0![elementIndex * 3 + 1] = cr0Y;
                    boneSdefRW0![elementIndex * 3 + 2] = cr0Z;

                    boneSdefRW1![elementIndex * 3 + 0] = cr1X;
                    boneSdefRW1![elementIndex * 3 + 1] = cr1Y;
                    boneSdefRW1![elementIndex * 3 + 2] = cr1Z;
                }
            }

            scene._blockEntityCollection = !!assetContainer;
            const mesh = new (boneSdefC !== null ? SdefMesh : Mesh)(geometryInfo.name, scene);
            mesh._parentContainer = assetContainer;
            scene._blockEntityCollection = false;
            if (geometryInfo.indices === undefined) mesh.isUnIndexed = true;
            mesh.setParent(rootMesh);
            meshes.push(mesh);

            scene._blockEntityCollection = !!assetContainer;
            const geometry = new Geometry(modelObject.header.modelName, scene, vertexData, false);
            geometry._parentContainer = assetContainer;
            scene._blockEntityCollection = false;
            if (state.preserveSerializationData && geometryInfo.additionalUvs !== undefined) {
                const uvKinds = [MmdBufferKind.AdditionalUV1Kind, MmdBufferKind.AdditionalUV2Kind, MmdBufferKind.AdditionalUV3Kind, MmdBufferKind.AdditionalUV4Kind];
                for (let j = 0; j < geometryInfo.additionalUvs.length; ++j) {
                    geometry.setVerticesData(uvKinds[j], geometryInfo.additionalUvs[j], false, 4);
                }
            }
            if (boneSdefC !== null) {
                geometry.setVerticesData(MmdBufferKind.MatricesSdefCKind, boneSdefC, false, 3);
                geometry.setVerticesData(MmdBufferKind.MatricesSdefRW0Kind, boneSdefRW0!, false, 3);
                geometry.setVerticesData(MmdBufferKind.MatricesSdefRW1Kind, boneSdefRW1!, false, 3);
            }
            if (state.preserveSerializationData && geometryInfo.edgeScale !== undefined) {
                geometry.setVerticesData(MmdBufferKind.EdgeScaleKind, geometryInfo.edgeScale, false, 1);
            }
            geometry.applyToMesh(mesh);
            geometries.push(geometry);

            processedPositionCount += geometryInfo.positions.length;
            if (processedPositionCount % 10000 === 0 && 100 < performance.now() - time) {
                progress.setTaskProgress("Build Geometry", processedPositionCount);
                progress.invokeProgressEvent();

                await Tools.DelayAsync(0);
                time = performance.now();
            }
        }

        progress.endTask("Build Geometry");
        progress.invokeProgressEvent();

        return {
            meshes,
            geometries
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

        const imagePathTable: string[] = new Array(modelObject.images.length);
        for (let i = 0; i < modelObject.images.length; ++i) {
            imagePathTable[i] = modelObject.images[i].relativePath;
        }

        const texturesInfo: TextureInfo[] = new Array(modelObject.textures.length);
        for (let i = 0; i < modelObject.textures.length; ++i) {
            const textureInfo = modelObject.textures[i];
            texturesInfo[i] = {
                noMipmap: (textureInfo.flag & BpmxObject.Texture.Flag.NoMipmap) !== 0,
                invertY: (textureInfo.flag & BpmxObject.Texture.Flag.InvertY) !== 0,
                samplingMode: textureInfo.samplingMode,
                imagePathIndex: textureInfo.imageIndex
            };
        }

        const referencedMeshList: ReferencedMesh[][] = new Array(modelObject.materials.length);
        for (let i = 0; i < referencedMeshList.length; ++i) {
            referencedMeshList[i] = [];
        }
        const geometriesInfo = modelObject.geometries;
        for (let i = 0; i < meshes.length; ++i) {
            const materialIndex = geometriesInfo[i].materialIndex;
            if (materialIndex === -1) continue;

            if (typeof materialIndex === "object") {
                const subGeometries = materialIndex;
                for (let subGeometryIndex = 0; subGeometryIndex < subGeometries.length; ++subGeometryIndex) {
                    referencedMeshList[subGeometries[subGeometryIndex].materialIndex].push({
                        mesh: meshes[i],
                        subMeshIndex: subGeometryIndex
                    });
                }
            } else {
                referencedMeshList[materialIndex].push(meshes[i]);
            }
        }

        const textureLoadPromise = new Promise<void>((resolve) => {
            buildMaterialsPromise = state.materialBuilder.buildMaterials(
                rootMesh.uniqueId, // uniqueId

                modelObject.materials, // materialsInfo

                texturesInfo, // texturesInfo
                imagePathTable, // imagePathTable

                rootUrl, // rootUrl
                "file:" + state.pmFileId + "_", // fileRootId
                modelObject.images, // referenceFiles

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

        const multiMaterials: MultiMaterial[] = [];
        for (let i = 0; i < meshes.length; ++i) {
            const mesh = meshes[i];
            const materialIndex = geometriesInfo[i].materialIndex;
            if (materialIndex === -1) continue;

            if (typeof materialIndex === "object") {
                const subGeometries = materialIndex;

                mesh.subMeshes.length = 0;

                if (subGeometries.length === 0) {
                    mesh.material = null;
                } else if (subGeometries.length === 1) {
                    const subGeometry = subGeometries[0];
                    new SubMesh(0, subGeometry.verticesStart, subGeometry.verticesCount, subGeometry.indexStart, subGeometry.indexCount, mesh);
                    mesh.material = materials[subGeometries[0].materialIndex];
                } else {
                    scene._blockEntityCollection = !!assetContainer;
                    const multiMaterial = new MultiMaterial(mesh.name, scene);
                    multiMaterial._parentContainer = assetContainer;
                    scene._blockEntityCollection = false;
                    const subMaterials = multiMaterial.subMaterials;
                    multiMaterials.push(multiMaterial);

                    for (let geometryIndex = 0; geometryIndex < subGeometries.length; ++geometryIndex) {
                        const subGeometry = subGeometries[geometryIndex];
                        new SubMesh(geometryIndex, subGeometry.verticesStart, subGeometry.verticesCount, subGeometry.indexStart, subGeometry.indexCount, mesh);
                        subMaterials.push(materials[subGeometry.materialIndex]);
                    }

                    mesh.material = multiMaterial;
                }
            } else {
                const material = materials[materialIndex];
                mesh.material = material;
            }
        }

        progress.endTask("Build Material");
        progress.invokeProgressEvent();

        return { materials, multiMaterials, textureLoadPromise };
    }

    protected override _buildSkeletonAsync(
        state: BpmxLoadState,
        modelObject: BpmxObject,
        meshes: Mesh[],
        scene: Scene,
        assetContainer: Nullable<AssetContainer>,
        bonesMetadata: MmdModelMetadata.Bone[] | MmdModelMetadata.SerializationBone[],
        progress: Progress
    ): Promise<Nullable<Skeleton>> {
        if (modelObject.bones.length === 0) {
            progress.endTask("Build Skeleton");
            return Promise.resolve(null);
        }
        return super._buildSkeletonAsync(state, modelObject, meshes, scene, assetContainer, bonesMetadata, progress);
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
        const morphsInfo = modelObject.morphs;

        const subMeshesMorphTargets: MorphTarget[][] = new Array(modelObject.geometries.length); // morphTargets[subMeshIndex][morphIndex]
        for (let i = 0; i < subMeshesMorphTargets.length; ++i) {
            subMeshesMorphTargets[i] = [];
        }

        let buildMorphProgress = 0;
        let time = performance.now();
        for (let morphIndex = 0; morphIndex < morphsInfo.length; ++morphIndex) {
            const morphInfo = morphsInfo[morphIndex];

            const morphTargets: MorphTarget[] = [];

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
                        elements: morphInfo.elements
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

            if (morphInfo.type !== PmxObject.Morph.Type.AdditionalUvMorph1 &&
                morphInfo.type !== PmxObject.Morph.Type.AdditionalUvMorph2 &&
                morphInfo.type !== PmxObject.Morph.Type.AdditionalUvMorph3 &&
                morphInfo.type !== PmxObject.Morph.Type.AdditionalUvMorph4 // additional uv morphs are not implemented yet
            ) {
                const elements = morphInfo.elements;
                for (let i = 0; i < elements.length; ++i) {
                    const morphTarget = new MorphTarget(morphInfo.name, 0, scene);
                    morphTargets.push(morphTarget);
                    subMeshesMorphTargets[elements[i].meshIndex].push(morphTarget);
                    buildMorphProgress += elements[i].indices.length;
                }

                const geometriesInfo = modelObject.geometries;

                if (morphInfo.type === PmxObject.Morph.Type.VertexMorph) {
                    for (let i = 0; i < elements.length; ++i) {
                        const element = elements[i];
                        const geometryInfo = geometriesInfo[element.meshIndex];

                        const positions = new Float32Array(geometryInfo.positions.length);
                        positions.set(geometryInfo.positions);

                        const morphIndices = element.indices;
                        const positionOffsets = element.offsets;

                        for (let j = 0; j < morphIndices.length; ++j) {
                            const index = morphIndices[j];
                            positions[index * 3 + 0] += positionOffsets[j * 3 + 0];
                            positions[index * 3 + 1] += positionOffsets[j * 3 + 1];
                            positions[index * 3 + 2] += positionOffsets[j * 3 + 2];
                        }
                        morphTargets[i].setPositions(positions);
                    }
                } else /*if (morphInfo.type === PmxObject.Morph.Type.uvMorph)*/ {
                    for (let i = 0; i < elements.length; ++i) {
                        const element = elements[i];
                        const geometryInfo = geometriesInfo[element.meshIndex];

                        const uvs = new Float32Array(geometryInfo.uvs.length);
                        uvs.set(geometryInfo.uvs);

                        const morphIndices = element.indices;
                        const uvOffsets = element.offsets;

                        for (let j = 0; j < morphIndices.length; ++j) {
                            const index = morphIndices[j];
                            uvs[index * 2 + 0] += uvOffsets[j * 4 + 0];
                            uvs[index * 2 + 1] += uvOffsets[j * 4 + 1];
                        }

                        const morphTarget = morphTargets[i];
                        morphTarget.setPositions(geometryInfo.positions);
                        morphTarget.setUVs(uvs);
                    }
                }
            }
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
                const geometries = buildGeometryResult.geometries;
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

if (SceneLoader) {
    SceneLoader.RegisterPlugin(new BpmxLoader());
}
