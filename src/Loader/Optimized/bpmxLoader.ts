import { AssetContainer } from "@babylonjs/core/assetContainer";
import { Bone } from "@babylonjs/core/Bones/bone";
import { Skeleton } from "@babylonjs/core/Bones/skeleton";
import { BoundingInfo } from "@babylonjs/core/Culling/boundingInfo";
import { type ISceneLoaderAsyncResult, type ISceneLoaderPluginAsync, type ISceneLoaderPluginExtensions, type ISceneLoaderProgressEvent, SceneLoader } from "@babylonjs/core/Loading/sceneLoader";
import { MultiMaterial } from "@babylonjs/core/Materials/multiMaterial";
import { Matrix, Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Geometry } from "@babylonjs/core/Meshes/geometry";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { VertexData } from "@babylonjs/core/Meshes/mesh.vertexData";
import { SubMesh } from "@babylonjs/core/Meshes/subMesh";
import type { IFileRequest } from "@babylonjs/core/Misc/fileRequest";
import type { LoadFileError } from "@babylonjs/core/Misc/fileTools";
import { Logger } from "@babylonjs/core/Misc/logger";
import { Tools } from "@babylonjs/core/Misc/tools";
import type { WebRequest } from "@babylonjs/core/Misc/webRequest";
import { MorphTarget } from "@babylonjs/core/Morph/morphTarget";
import { MorphTargetManager } from "@babylonjs/core/Morph/morphTargetManager";
import type { Scene } from "@babylonjs/core/scene";
import type { Nullable } from "@babylonjs/core/types";

import type { IMmdMaterialBuilder } from "../IMmdMaterialBuilder";
import type { MmdModelMetadata } from "../mmdModelMetadata";
import { MmdStandardMaterialBuilder } from "../mmdStandardMaterialBuilder";
import { ObjectUniqueIdProvider } from "../objectUniqueIdProvider";
import type { ILogger } from "../Parser/ILogger";
import { PmxObject } from "../Parser/pmxObject";
import { SdefBufferKind } from "../sdefBufferKind";
import { SdefMesh } from "../sdefMesh";
import { BpmxReader } from "./Parser/bpmxReader";

interface LoadState {
    readonly arrayBuffer: ArrayBuffer;
    readonly pmxFileId: string;
    readonly materialBuilder: IMmdMaterialBuilder;
    readonly useSdef: boolean;
    readonly buildSkeleton: boolean;
    readonly buildMorph: boolean;
    readonly boundingBoxMargin: number;
}

/**
 * BpmxLoader is a loader that loads models in BPMX format
 *
 * BPMX is a single binary file format that contains all the data of a model
 */
export class BpmxLoader implements ISceneLoaderPluginAsync, ILogger {
    /**
     * Name of the loader ("bpmx")
     */
    public name: string;

    /**
     * Extensions supported by this loader
     */
    public extensions: ISceneLoaderPluginExtensions;

    /**
     * Material builder used by this loader
     *
     * This property can be overwritten to customize the material of the loaded model
     */
    public materialBuilder: IMmdMaterialBuilder;

    /**
     * Whether to use SDEF (default: true)
     *
     * Spherical Deformation(SDEF) is a feature that allows you to deform the model more naturally than the traditional skinning method
     *
     * But it uses more memory and is slower than the traditional skinning method
     *
     * If you are targeting a platform with limited memory or performance, you may want to disable this feature
     */
    public useSdef: boolean;

    /**
     * Whether to build skeleton (default: true)
     *
     * If you want to load a model without a skeleton, you can disable this feature
     *
     * This feature is useful when you want to load a model that is not animated. (e.g. background object)
     */
    public buildSkeleton: boolean;

    /**
     * Whether to build morph (default: true)
     *
     * If you want to load a model without morph, you can disable this feature
     *
     * This feature is useful when you want to load a model that is not animated. (e.g. background object)
     */
    public buildMorph: boolean;

    /**
     * Margin of the bounding box of the model (default: 10)
     *
     * This property is used to calculate the bounding box of the model
     *
     * If the bounding box of the model is too small, the model may not be rendered correctly
     *
     * This value may need to be set higher, especially in motion with a large movement range
     */
    public boundingBoxMargin: number;

    private _loggingEnabled: boolean;

    /** @internal */
    public log: (message: string) => void;
    /** @internal */
    public warn: (message: string) => void;
    /** @internal */
    public error: (message: string) => void;

    /**
     * Create a new BpmxLoader
     */
    public constructor() {
        this.name = "bpmx";
        this.extensions = {
            // eslint-disable-next-line @typescript-eslint/naming-convention
            ".bpmx": { isBinary: true }
        };

        this.materialBuilder = new MmdStandardMaterialBuilder();
        this.useSdef = true;
        this.buildSkeleton = true;
        this.buildMorph = true;
        this.boundingBoxMargin = 10;

        this._loggingEnabled = false;
        this.log = this._logDisabled;
        this.warn = this._warnDisabled;
        this.error = this._errorDisabled;
    }

    public importMeshAsync(
        _meshesNames: any,
        scene: Scene,
        data: LoadState,
        rootUrl: string,
        onProgress?: (event: ISceneLoaderProgressEvent) => void,
        _fileName?: string
    ): Promise<ISceneLoaderAsyncResult> {
        return this._loadAsyncInternal(scene, null, data, rootUrl, onProgress);
    }

    public loadAsync(
        scene: Scene,
        data: LoadState,
        rootUrl: string,
        onProgress?: (event: ISceneLoaderProgressEvent) => void,
        _fileName?: string
    ): Promise<void> {
        return this._loadAsyncInternal(scene, null, data, rootUrl, onProgress).then(() => {
            return;
        });
    }

    public loadAssetContainerAsync(
        scene: Scene,
        data: LoadState,
        rootUrl: string,
        onProgress?: (event: ISceneLoaderProgressEvent) => void,
        _fileName?: string
    ): Promise<AssetContainer> {
        const assetContainer = new AssetContainer(scene);

        return this._loadAsyncInternal(scene, assetContainer, data, rootUrl, onProgress).then(() => {
            return assetContainer;
        });
    }

    public loadFile(
        scene: Scene,
        fileOrUrl: string | File,
        _rootUrl: string,
        onSuccess: (data: LoadState, responseURL?: string | undefined) => void,
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
                const loadState: LoadState = {
                    arrayBuffer: data as ArrayBuffer,
                    pmxFileId: fileOrUrl instanceof File ? ObjectUniqueIdProvider.GetId(fileOrUrl).toString() : fileOrUrl,
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

    private async _loadAsyncInternal(
        scene: Scene,
        assetContainer: Nullable<AssetContainer>,
        state: LoadState,
        rootUrl: string,
        onProgress?: (event: ISceneLoaderProgressEvent) => void
    ): Promise<ISceneLoaderAsyncResult> {
        // duplicate with pmx loader is intentional
        // Duplicate code exists to separate the two loaders completely independently.
        // Assuming that only Bpmxloader or PmxLoader is bundled in general,
        // they provide the best code size and execution speed.
        const bpmxObject = await BpmxReader.ParseAsync(state.arrayBuffer, this)
            .catch((e: any) => {
                return Promise.reject(e);
            });

        const parseCost = Math.floor(state.arrayBuffer.byteLength / 100);
        const buildGeometryCost = bpmxObject.geometry.indices.length;
        const buildMaterialCost = 100 * bpmxObject.materials.length;
        const buildSkeletonCost = state.buildSkeleton ? 100 * bpmxObject.bones.length : 0;
        let buildMorphCost = 0;
        if (state.buildMorph) {
            const morphsInfo = bpmxObject.morphs;
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
        }
        const textureLoadCost = 30000 * bpmxObject.textures.length;

        let applyTextureLoading = false;

        const progressEvent = {
            lengthComputable: true,
            loaded: parseCost,
            total: parseCost + buildGeometryCost + buildMaterialCost + buildSkeletonCost + buildMorphCost + textureLoadCost
        };

        onProgress?.({...progressEvent});

        let lastStageLoaded = parseCost;

        scene._blockEntityCollection = !!assetContainer;
        const mesh = new (state.useSdef ? SdefMesh : Mesh)(bpmxObject.header.modelName, scene);
        mesh._parentContainer = assetContainer;
        scene._blockEntityCollection = false;

        const vertexData = new VertexData();
        vertexData.positions = bpmxObject.geometry.positions;
        vertexData.normals = bpmxObject.geometry.normals;
        vertexData.uvs = bpmxObject.geometry.uvs;
        vertexData.indices = bpmxObject.geometry.indices;
        vertexData.matricesIndices = bpmxObject.geometry.matricesIndices;
        vertexData.matricesWeights = bpmxObject.geometry.matricesWeights;

        scene._blockEntityCollection = !!assetContainer;
        const geometry = new Geometry(bpmxObject.header.modelName, scene, vertexData, false);
        geometry._parentContainer = assetContainer;
        scene._blockEntityCollection = false;

        if (state.useSdef && bpmxObject.geometry.sdef !== undefined) {
            const sdefData = bpmxObject.geometry.sdef;

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

        progressEvent.loaded = lastStageLoaded + buildGeometryCost;
        onProgress?.({...progressEvent});
        lastStageLoaded += buildGeometryCost;

        scene._blockEntityCollection = !!assetContainer;
        const multiMaterial = new MultiMaterial(bpmxObject.header.modelName + "_multi", scene);
        multiMaterial._parentContainer = assetContainer;
        scene._blockEntityCollection = false;

        let buildMaterialsPromise: void | Promise<void> = undefined;

        const texturePathTable: string[] = new Array(bpmxObject.textures.length);
        for (let i = 0; i < bpmxObject.textures.length; ++i) {
            texturePathTable[i] = bpmxObject.textures[i].relativePath;
        }

        const textureLoadPromise = new Promise<void>((resolve) => {
            buildMaterialsPromise = state.materialBuilder.buildMaterials(
                mesh.uniqueId, // uniqueId
                bpmxObject.materials, // materialsInfo
                texturePathTable, // texturePathTable
                rootUrl, // rootUrl
                "file:" + state.pmxFileId + "_", // fileRootId
                bpmxObject.textures, // referenceFiles
                scene, // scene
                assetContainer, // assetContainer
                vertexData.indices as Uint16Array | Uint32Array, // indices
                vertexData.uvs as Float32Array, // uvs
                multiMaterial, // multiMaterial
                this, // logger
                (event) => {
                    if (!applyTextureLoading) return;
                    const loadedRatio = event.loaded / event.total;
                    progressEvent.loaded = lastStageLoaded + Math.floor(textureLoadCost * loadedRatio);
                    onProgress?.({...progressEvent});
                }, // onTextureLoadProgress
                () => resolve() // onTextureLoadComplete
            );
        });
        if (buildMaterialsPromise !== undefined) {
            await buildMaterialsPromise;
        }
        mesh.material = multiMaterial;

        mesh.subMeshes.length = 0;
        {
            const materials = bpmxObject.materials;
            let offset = 0;
            for (let i = 0; i < materials.length; ++i) {
                const materialInfo = materials[i];

                new SubMesh(
                    i, // materialIndex
                    0, // verticesStart
                    Math.floor(bpmxObject.geometry.positions.length / 3), // verticesCount
                    offset, // indexStart
                    materialInfo.surfaceCount, // indexCount
                    mesh
                );

                offset += materialInfo.surfaceCount;
            }
        }

        progressEvent.loaded = lastStageLoaded + buildMaterialCost;
        onProgress?.({...progressEvent});
        lastStageLoaded += buildMaterialCost;

        const bonesMetadata: MmdModelMetadata.Bone[] = [];
        let skeleton: Nullable<Skeleton> = null;
        if (state.buildSkeleton) {
            scene._blockEntityCollection = !!assetContainer;
            skeleton = new Skeleton(bpmxObject.header.modelName, bpmxObject.header.modelName + "_skeleton", scene);
            skeleton._parentContainer = assetContainer;
            scene._blockEntityCollection = false;
            {
                const bonesInfo = bpmxObject.bones;
                const bones: Bone[] = [];
                const looped: boolean[] = [];

                for (let i = 0; i < bonesInfo.length; ++i) {
                    const boneInfo = bonesInfo[i];

                    let isLooped = false;
                    if (0 <= boneInfo.parentBoneIndex && boneInfo.parentBoneIndex < bonesInfo.length) {
                        let parentBoneIndex = boneInfo.parentBoneIndex;
                        while (parentBoneIndex !== -1) {
                            if (parentBoneIndex === i) {
                                isLooped = true;
                                this.warn(`Bone loop detected. Ignore Parenting. Bone index: ${i}`);
                                break;
                            }
                            parentBoneIndex = bonesInfo[parentBoneIndex].parentBoneIndex;
                        }

                        if (i <= boneInfo.parentBoneIndex) {
                            this.warn(`Parent bone index is greater equal than child bone index. Bone index: ${i} Parent bone index: ${boneInfo.parentBoneIndex}`);
                        }
                    } else {
                        if (boneInfo.parentBoneIndex !== -1) {
                            this.error(`Parent bone index is out of range. Bone index: ${i} Parent bone index: ${boneInfo.parentBoneIndex}`);
                        }
                    }

                    const boneWorldPosition = boneInfo.position;

                    const bonePosition = new Vector3(boneWorldPosition[0], boneWorldPosition[1], boneWorldPosition[2]);
                    if ((0 <= boneInfo.parentBoneIndex && boneInfo.parentBoneIndex < bones.length) && !isLooped) {
                        const parentBoneInfo = bonesInfo[boneInfo.parentBoneIndex];
                        bonePosition.x -= parentBoneInfo.position[0];
                        bonePosition.y -= parentBoneInfo.position[1];
                        bonePosition.z -= parentBoneInfo.position[2];
                    }
                    const boneMatrix = Matrix.Identity()
                        .setTranslation(bonePosition);

                    const bone = new Bone(
                        boneInfo.name,
                        skeleton,
                        undefined,
                        boneMatrix,
                        undefined,
                        undefined,
                        i // bone index
                    );

                    bones.push(bone);
                    looped.push(isLooped);

                    const boneMetadata = <MmdModelMetadata.Bone>{
                        name: boneInfo.name,
                        parentBoneIndex: boneInfo.parentBoneIndex,
                        transformOrder: boneInfo.transformOrder,
                        flag: boneInfo.flag,
                        appendTransform: boneInfo.appendTransform,
                        // axisLimit: boneInfo.axisLimit,
                        // localVector: boneInfo.localVector,
                        transformAfterPhysics: boneInfo.transformAfterPhysics,
                        // externalParentTransform: boneInfo.externalParentTransform,
                        ik: boneInfo.ik
                    };
                    bonesMetadata.push(boneMetadata);
                }

                for (let i = 0; i < bones.length; ++i) {
                    const boneInfo = bonesInfo[i];
                    const bone = bones[i];

                    if ((0 <= boneInfo.parentBoneIndex && boneInfo.parentBoneIndex < bones.length) && !looped[i]) {
                        bone.setParent(bones[boneInfo.parentBoneIndex], false);
                    }
                }

                for (let i = 0; i < bones.length; ++i) {
                    const bone = bones[i];
                    if (bone.getParent() === null) {
                        bone._updateAbsoluteBindMatrices();
                    }
                }
            }
            mesh.skeleton = skeleton;

            progressEvent.loaded = lastStageLoaded + buildSkeletonCost;
            onProgress?.({...progressEvent});
            lastStageLoaded += buildSkeletonCost;
        }

        const morphsMetadata: MmdModelMetadata.Morph[] = [];
        let morphTargetManager: Nullable<MorphTargetManager> = null;
        if (state.buildMorph) {
            scene._blockEntityCollection = !!assetContainer;
            morphTargetManager = new MorphTargetManager(scene);
            morphTargetManager._parentContainer = assetContainer;
            scene._blockEntityCollection = false;
            {
                const morphsInfo = bpmxObject.morphs;

                const morphTargets: MorphTarget[] = [];

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
                        const positions = new Float32Array(bpmxObject.geometry.positions);
                        positions.set(vertexData.positions);

                        const morphIndices = morphInfo.indices;
                        const positionOffsets = morphInfo.positions;

                        let time = performance.now();
                        for (let j = 0; j < morphIndices.length; ++j) {
                            const elementIndex = morphIndices[j];
                            positions[elementIndex * 3 + 0] += positionOffsets[j * 3 + 0];
                            positions[elementIndex * 3 + 1] += positionOffsets[j * 3 + 1];
                            positions[elementIndex * 3 + 2] += positionOffsets[j * 3 + 2];

                            if (j % 10000 === 0 && 100 < performance.now() - time) {
                                progressEvent.loaded = lastStageLoaded + j;
                                onProgress?.({...progressEvent});

                                await Tools.DelayAsync(0);
                                time = performance.now();
                            }
                        }
                        lastStageLoaded += morphIndices.length;

                        morphTarget.setPositions(positions);
                    } else /*if (morphInfo.type === PmxObject.Morph.Type.uvMorph)*/ {
                        const uvs = new Float32Array(bpmxObject.geometry.uvs);
                        uvs.set(vertexData.uvs);

                        const morphIndices = morphInfo.indices;
                        const uvOffsets = morphInfo.offsets;

                        let time = performance.now();
                        for (let j = 0; j < morphIndices.length; ++j) {
                            const elementIndex = morphIndices[j];
                            uvs[elementIndex * 2 + 0] += uvOffsets[j * 4 + 0];
                            uvs[elementIndex * 2 + 1] += uvOffsets[j * 4 + 1];

                            if (j % 10000 === 0 && 100 < performance.now() - time) {
                                progressEvent.loaded = lastStageLoaded + j;
                                onProgress?.({...progressEvent});

                                await Tools.DelayAsync(0);
                                time = performance.now();
                            }
                        }
                        lastStageLoaded += morphIndices.length;

                        morphTarget.setPositions(vertexData.positions);
                        morphTarget.setUVs(uvs);
                    }
                }

                morphTargetManager.areUpdatesFrozen = true;
                for (let i = 0; i < morphTargets.length; ++i) {
                    morphTargetManager.addTarget(morphTargets[i]);
                }
                morphTargetManager.areUpdatesFrozen = false;
            }
            mesh.morphTargetManager = morphTargetManager;
        }

        const boundingBoxMargin = state.boundingBoxMargin;
        if (boundingBoxMargin !== 0) {
            const subMeshes = mesh.subMeshes;
            for (let i = 0; i < subMeshes.length; ++i) {
                const subMesh = subMeshes[i];
                const subMeshBoundingInfo = subMesh.getBoundingInfo();
                subMesh.setBoundingInfo(
                    new BoundingInfo(
                        new Vector3().setAll(-boundingBoxMargin).addInPlace(subMeshBoundingInfo.minimum),
                        new Vector3().setAll(boundingBoxMargin).addInPlace(subMeshBoundingInfo.maximum)
                    )
                );
            }

            const boundingInfo = mesh.getBoundingInfo();
            mesh.setBoundingInfo(
                new BoundingInfo(
                    new Vector3().setAll(-boundingBoxMargin).addInPlace(boundingInfo.minimum),
                    new Vector3().setAll(boundingBoxMargin).addInPlace(boundingInfo.maximum)
                )
            );

            mesh._updateBoundingInfo();
        }

        mesh.metadata = <MmdModelMetadata>{
            isMmdModel: true,
            header: {
                modelName: bpmxObject.header.modelName,
                englishModelName: bpmxObject.header.englishModelName,
                comment: bpmxObject.header.comment,
                englishComment: bpmxObject.header.englishComment
            },
            bones: bonesMetadata,
            morphs: morphsMetadata,
            rigidBodies: bpmxObject.rigidBodies,
            joints: bpmxObject.joints
        };

        progressEvent.loaded = lastStageLoaded;
        onProgress?.({...progressEvent});

        applyTextureLoading = true;
        await textureLoadPromise;

        if (assetContainer !== null) {
            assetContainer.meshes.push(mesh);
            assetContainer.geometries.push(geometry);
            assetContainer.multiMaterials.push(multiMaterial);
            if (skeleton !== null) assetContainer.skeletons.push(skeleton);
            if (morphTargetManager !== null) assetContainer.morphTargetManagers.push(morphTargetManager);
        }

        return {
            meshes: [mesh],
            particleSystems: [],
            skeletons: skeleton !== null ? [skeleton] : [],
            animationGroups: [],
            transformNodes: [],
            geometries: [geometry],
            lights: []
        };
    }

    /**
     * Enable or disable debug logging (default: false)
     */
    public get loggingEnabled(): boolean {
        return this._loggingEnabled;
    }

    public set loggingEnabled(value: boolean) {
        this._loggingEnabled = value;

        if (value) {
            this.log = this._logEnabled;
            this.warn = this._warnEnabled;
            this.error = this._errorEnabled;
        } else {
            this.log = this._logDisabled;
            this.warn = this._warnDisabled;
            this.error = this._errorDisabled;
        }
    }

    private _logEnabled(message: string): void {
        Logger.Log(message);
    }

    private _logDisabled(): void {
        // do nothing
    }

    private _warnEnabled(message: string): void {
        Logger.Warn(message);
    }

    private _warnDisabled(): void {
        // do nothing
    }

    private _errorEnabled(message: string): void {
        Logger.Error(message);
    }

    private _errorDisabled(): void {
        // do nothing
    }
}

if (SceneLoader) {
    SceneLoader.RegisterPlugin(new BpmxLoader());
}
