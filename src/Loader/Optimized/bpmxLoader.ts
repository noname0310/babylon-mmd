import type { AssetContainer } from "@babylonjs/core/assetContainer";
import { type ISceneLoaderPluginAsync, type ISceneLoaderProgressEvent, SceneLoader } from "@babylonjs/core/Loading/sceneLoader";
import type { Material } from "@babylonjs/core/Materials/material";
import type { Texture } from "@babylonjs/core/Materials/Textures/texture";
import { Geometry } from "@babylonjs/core/Meshes/geometry";
import type { Mesh } from "@babylonjs/core/Meshes/mesh";
import { VertexData } from "@babylonjs/core/Meshes/mesh.vertexData";
import type { TransformNode } from "@babylonjs/core/Meshes/transformNode";
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
import type { IndexedUvGeometry } from "../textureAlphaChecker";
import type { BpmxObject } from "./Parser/bpmxObject";
import { BpmxReader } from "./Parser/bpmxReader";

interface BpmxLoadState extends MmdModelLoadState { }

interface IndexToSubMeshIndexMap {
    readonly map: Uint16Array | Uint32Array;
    readonly isReferencedVertex: Uint8Array;
}

interface BpmxBuildGeometryResult extends MmdModelBuildGeometryResult {
    readonly indices: Uint16Array | Uint32Array;
    readonly indexMaps: IndexToSubMeshIndexMap[];
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
                    boundingBoxMargin
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
        scene: Scene,
        assetContainer: Nullable<AssetContainer>,
        progress: Progress
    ): Promise<BpmxBuildGeometryResult> {
        const vertexData = new VertexData();
        vertexData.positions = modelObject.geometry.positions;
        vertexData.normals = modelObject.geometry.normals;
        vertexData.uvs = modelObject.geometry.uvs;
        vertexData.indices = modelObject.geometry.indices;
        vertexData.matricesIndices = modelObject.geometry.matricesIndices;
        vertexData.matricesWeights = modelObject.geometry.matricesWeights;

        scene._blockEntityCollection = !!assetContainer;
        const geometry = new Geometry(modelObject.header.modelName, scene, vertexData, false);
        geometry._parentContainer = assetContainer;
        scene._blockEntityCollection = false;

        if (state.useSdef && modelObject.geometry.sdef !== undefined) {
            const sdefData = modelObject.geometry.sdef;

            const vetexCount = vertexData.positions!.length / 3;
            for (let i = 0; i < vetexCount; ++i) {
                const boneWeight0 = vertexData.matricesWeights![i * 4 + 0];
                const boneWeight1 = vertexData.matricesWeights![i * 4 + 1];

                const sdefC = sdefData.c;
                const sdefR0 = sdefData.r0;
                const sdefR1 = sdefData.r1;

                const centerX = sdefC[i * 3 + 0];
                const centerY = sdefC[i * 3 + 1];
                const centerZ = sdefC[i * 3 + 2];

                // calculate rw0 and rw1
                let r0X = sdefR0[i * 3 + 0];
                let r0Y = sdefR0[i * 3 + 1];
                let r0Z = sdefR0[i * 3 + 2];

                let r1X = sdefR1[i * 3 + 0];
                let r1Y = sdefR1[i * 3 + 1];
                let r1Z = sdefR1[i * 3 + 2];

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

                sdefR0[i * 3 + 0] = cr0X;
                sdefR0[i * 3 + 1] = cr0Y;
                sdefR0[i * 3 + 2] = cr0Z;

                sdefR1[i * 3 + 0] = cr1X;
                sdefR1[i * 3 + 1] = cr1Y;
                sdefR1[i * 3 + 2] = cr1Z;
            }

            geometry.setVerticesData(SdefBufferKind.MatricesSdefCKind, sdefData.c, false, 3);
            geometry.setVerticesData(SdefBufferKind.MatricesSdefR0Kind, sdefData.r0, false, 3);
            geometry.setVerticesData(SdefBufferKind.MatricesSdefR1Kind, sdefData.r1, false, 3);
        }
        geometry.applyToMesh(mesh);

        progress.endTask("Build Geometry");
        progress.invokeProgressEvent();

        return { vertexData, geometry };
    }

    protected override async _buildMaterialAsync(
        state: BpmxLoadState,
        modelObject: BpmxObject,
        rootNode: TransformNode,
        meshes: Mesh[],
        scene: Scene,
        assetContainer: Nullable<AssetContainer>,
        indexedUvGeometries: IndexedUvGeometry[],
        rootUrl: string,
        progress: Progress
    ): Promise<BuildMaterialResult> {
        let buildMaterialsPromise: Material[] | Promise<Material[]> | undefined = undefined;

        const texturePathTable: string[] = new Array(modelObject.textures.length);
        for (let i = 0; i < modelObject.textures.length; ++i) {
            texturePathTable[i] = modelObject.textures[i].relativePath;
        }

        const textureLoadPromise = new Promise<Texture[]>((resolve) => {
            buildMaterialsPromise = state.materialBuilder.buildMaterials(
                rootNode.uniqueId, // uniqueId
                modelObject.materials, // materialsInfo
                texturePathTable, // texturePathTable
                rootUrl, // rootUrl
                "file:" + state.pmFileId + "_", // fileRootId
                modelObject.textures, // referenceFiles
                scene, // scene
                assetContainer, // assetContainer
                indexedUvGeometries, // indexedUvGeometries
                this, // logger
                (event) => {
                    if (!event.lengthComputable) return;
                    progress.setTaskProgressRatio("Texture Load", event.loaded / event.total, true);
                    progress.invokeProgressEvent();
                }, // onTextureLoadProgress
                loadedTextures => resolve(loadedTextures) // onTextureLoadComplete
            );
        });
        const materials: Material[] = Array.isArray(buildMaterialsPromise)
            ? buildMaterialsPromise
            : await (buildMaterialsPromise as unknown as Promise<Material[]>);

        for (let i = 0; i < meshes.length; ++i) meshes[i].material = materials[i];

        progress.endTask("Build Material");
        progress.invokeProgressEvent();

        return { materials, textureLoadPromise };
    }

    protected override async _buildMorphAsync(
        modelObject: BpmxObject,
        buildGeometryResult: BpmxBuildGeometryResult,
        scene: Scene,
        assetContainer: Nullable<AssetContainer>,
        morphsMetadata: MmdModelMetadata.Morph[],
        progress: Progress
    ): Promise<MorphTargetManager[]> {
        scene._blockEntityCollection = !!assetContainer;
        const morphTargetManager = new MorphTargetManager(scene);
        morphTargetManager._parentContainer = assetContainer;
        scene._blockEntityCollection = false;
        {
            const morphsInfo = modelObject.morphs;
            const morphTargets: MorphTarget[] = [];

            let buildMorphProgress = 0;

            for (let i = 0; i < morphsInfo.length; ++i) {
                const morphInfo = morphsInfo[i];

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

                        index: morphTargets.length
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

                const morphTarget = new MorphTarget(morphInfo.name, 0, scene);
                morphTargets.push(morphTarget);

                if (morphInfo.type === PmxObject.Morph.Type.VertexMorph) {
                    const positions = new Float32Array(modelObject.geometry.positions);
                    positions.set(vertexData.positions!);

                    const morphIndices = morphInfo.indices;
                    const positionOffsets = morphInfo.positions;

                    let time = performance.now();
                    for (let j = 0; j < morphIndices.length; ++j) {
                        const elementIndex = morphIndices[j];
                        positions[elementIndex * 3 + 0] += positionOffsets[j * 3 + 0];
                        positions[elementIndex * 3 + 1] += positionOffsets[j * 3 + 1];
                        positions[elementIndex * 3 + 2] += positionOffsets[j * 3 + 2];

                        if (j % 10000 === 0 && 100 < performance.now() - time) {
                            progress.setTaskProgress("Build Morph", buildMorphProgress + j);
                            progress.invokeProgressEvent();

                            await Tools.DelayAsync(0);
                            time = performance.now();
                        }
                    }
                    progress.setTaskProgress("Build Morph", buildMorphProgress + morphIndices.length);
                    buildMorphProgress += morphIndices.length;

                    morphTarget.setPositions(positions);
                } else /*if (morphInfo.type === PmxObject.Morph.Type.uvMorph)*/ {
                    const uvs = new Float32Array(modelObject.geometry.uvs);
                    uvs.set(vertexData.uvs!);

                    const morphIndices = morphInfo.indices;
                    const uvOffsets = morphInfo.offsets;

                    let time = performance.now();
                    for (let j = 0; j < morphIndices.length; ++j) {
                        const elementIndex = morphIndices[j];
                        uvs[elementIndex * 2 + 0] += uvOffsets[j * 4 + 0];
                        uvs[elementIndex * 2 + 1] += uvOffsets[j * 4 + 1];

                        if (j % 10000 === 0 && 100 < performance.now() - time) {
                            progress.setTaskProgress("Build Morph", buildMorphProgress + j);
                            progress.invokeProgressEvent();

                            await Tools.DelayAsync(0);
                            time = performance.now();
                        }
                    }
                    progress.setTaskProgress("Build Morph", buildMorphProgress + morphIndices.length);
                    buildMorphProgress += morphIndices.length;

                    morphTarget.setPositions(vertexData.positions);
                    morphTarget.setUVs(uvs);
                }
            }

            morphTargetManager.areUpdatesFrozen = true;
            for (let i = 0; i < morphTargets.length; ++i) {
                morphTargetManager.addTarget(morphTargets[i]);
            }
            morphTargetManager.areUpdatesFrozen = false;

            progress.endTask("Build Morph");
        }
        return mesh.morphTargetManager = morphTargetManager;
    }
}

if (SceneLoader) {
    SceneLoader.RegisterPlugin(new BpmxLoader());
}
