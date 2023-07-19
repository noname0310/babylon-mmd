import { AssetContainer } from "@babylonjs/core/assetContainer";
import { Bone } from "@babylonjs/core/Bones/bone";
import { Skeleton } from "@babylonjs/core/Bones/skeleton";
import { BoundingInfo } from "@babylonjs/core/Culling/boundingInfo";
import type { ISceneLoaderAsyncResult, ISceneLoaderPluginAsync, ISceneLoaderPluginExtensions, ISceneLoaderProgressEvent } from "@babylonjs/core/Loading/sceneLoader";
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

import type { IMmdMaterialBuilder } from "./IMmdMaterialBuilder";
import type { MmdModelMetadata } from "./mmdModelMetadata";
import { MmdStandardMaterialBuilder } from "./mmdStandardMaterialBuilder";
import { ObjectUniqueIdProvider } from "./objectUniqueIdProvider";
import type { ILogger } from "./Parser/ILogger";
import { PmxObject } from "./Parser/pmxObject";
import { PmxReader } from "./Parser/pmxReader";
import { SdefBufferKind } from "./sdefBufferKind";
import { SdefMesh } from "./sdefMesh";

interface LoadState {
    readonly arrayBuffer: ArrayBuffer;
    readonly pmxFileId: string;
    readonly materialBuilder: IMmdMaterialBuilder;
    readonly useSdef: boolean;
    readonly buildSkeleton: boolean;
    readonly buildMorph: boolean;
    readonly boundingBoxMargin: number;
    readonly referenceFiles: readonly File[];
}

export class PmxLoader implements ISceneLoaderPluginAsync, ILogger {
    /**
     * Name of the loader ("pmx")
     */
    public name: string;
    public extensions: ISceneLoaderPluginExtensions;

    public materialBuilder: IMmdMaterialBuilder;
    public useSdef: boolean;
    public buildSkeleton: boolean;
    public buildMorph: boolean;
    public boundingBoxMargin: number;
    public referenceFiles: readonly File[];

    private _loggingEnabled: boolean;

    /** @internal */
    public log: (message: string) => void;
    /** @internal */
    public warn: (message: string) => void;
    /** @internal */
    public error: (message: string) => void;

    public constructor() {
        this.name = "pmx";
        this.extensions = {
            // eslint-disable-next-line @typescript-eslint/naming-convention
            ".pmx": { isBinary: true }
        };

        this.materialBuilder = new MmdStandardMaterialBuilder();
        this.useSdef = true;
        this.buildSkeleton = true;
        this.buildMorph = true;
        this.boundingBoxMargin = 10;
        this.referenceFiles = [];

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
        const referenceFiles = this.referenceFiles;

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
                    boundingBoxMargin,
                    referenceFiles
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
        const pmxObject = await PmxReader.ParseAsync(state.arrayBuffer, this)
            .catch((e: any) => {
                return Promise.reject(e);
            });

        const parseCost = Math.floor(state.arrayBuffer.byteLength / 100);
        const buildMaterialCost = 100 * pmxObject.materials.length;
        const buildSkeletonCost = state.buildSkeleton ? 100 * pmxObject.bones.length : 0;
        let buildMorphCost = 0;
        if (state.buildMorph) {
            const morphsInfo = pmxObject.morphs;
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
        const textureLoadCost = 30000 * pmxObject.textures.length;

        let applyTextureLoading = false;

        const progressEvent = {
            lengthComputable: true,
            loaded: parseCost,
            total: parseCost + pmxObject.faces.length + pmxObject.vertices.length + buildMaterialCost + buildSkeletonCost + buildMorphCost + textureLoadCost
        };

        onProgress?.({...progressEvent});

        let lastStageLoaded = parseCost;

        scene._blockEntityCollection = !!assetContainer;
        const mesh = new (state.useSdef ? SdefMesh : Mesh)(pmxObject.header.modelName, scene);
        mesh._parentContainer = assetContainer;
        scene._blockEntityCollection = false;

        const vertexData = new VertexData();
        const boneSdefC = state.useSdef ? new Float32Array(pmxObject.vertices.length * 3) : undefined;
        const boneSdefR0 = state.useSdef ? new Float32Array(pmxObject.vertices.length * 3) : undefined;
        const boneSdefR1 = state.useSdef ? new Float32Array(pmxObject.vertices.length * 3) : undefined;
        let hasSdef = false;
        {
            const vertices = pmxObject.vertices;
            const positions = new Float32Array(vertices.length * 3);
            const normals = new Float32Array(vertices.length * 3);
            const uvs = new Float32Array(vertices.length * 2);
            const boneIndices = new Float32Array(vertices.length * 4);
            const boneWeights = new Float32Array(vertices.length * 4);

            let indices;
            if (pmxObject.faces instanceof Uint8Array || pmxObject.faces instanceof Uint16Array) {
                indices = new Uint16Array(pmxObject.faces.length);
            } else {
                indices = new Uint32Array(pmxObject.faces.length);
            }
            {
                let time = performance.now();
                const faces = pmxObject.faces;
                for (let i = 0; i < indices.length; i += 3) { // reverse winding order
                    indices[i + 0] = faces[i + 0];
                    indices[i + 1] = faces[i + 2];
                    indices[i + 2] = faces[i + 1];

                    if (i % 10000 === 0 && 100 < performance.now() - time) {
                        progressEvent.loaded = lastStageLoaded + i;
                        onProgress?.({...progressEvent});

                        await Tools.DelayAsync(0);
                        time = performance.now();
                    }
                }

                progressEvent.loaded = lastStageLoaded + indices.length;
                onProgress?.({...progressEvent});
                lastStageLoaded += indices.length;
            }

            {
                let time = performance.now();
                for (let i = 0; i < vertices.length; ++i) {
                    const vertex = vertices[i];
                    positions[i * 3 + 0] = vertex.position[0];
                    positions[i * 3 + 1] = vertex.position[1];
                    positions[i * 3 + 2] = vertex.position[2];

                    normals[i * 3 + 0] = vertex.normal[0];
                    normals[i * 3 + 1] = vertex.normal[1];
                    normals[i * 3 + 2] = vertex.normal[2];

                    uvs[i * 2 + 0] = vertex.uv[0];
                    uvs[i * 2 + 1] = 1 - vertex.uv[1]; // flip y axis

                    switch (vertex.weightType) {
                    case PmxObject.Vertex.BoneWeightType.Bdef1:
                        {
                            const boneWeight = vertex.boneWeight as PmxObject.Vertex.BoneWeight<PmxObject.Vertex.BoneWeightType.Bdef1>;

                            boneIndices[i * 4 + 0] = boneWeight.boneIndices;
                            boneIndices[i * 4 + 1] = 0;
                            boneIndices[i * 4 + 2] = 0;
                            boneIndices[i * 4 + 3] = 0;

                            boneWeights[i * 4 + 0] = 1;
                            boneWeights[i * 4 + 1] = 0;
                            boneWeights[i * 4 + 2] = 0;
                            boneWeights[i * 4 + 3] = 0;
                        }
                        break;

                    case PmxObject.Vertex.BoneWeightType.Bdef2:
                        {
                            const boneWeight = vertex.boneWeight as PmxObject.Vertex.BoneWeight<PmxObject.Vertex.BoneWeightType.Bdef2>;

                            boneIndices[i * 4 + 0] = boneWeight.boneIndices[0];
                            boneIndices[i * 4 + 1] = boneWeight.boneIndices[1];
                            boneIndices[i * 4 + 2] = 0;
                            boneIndices[i * 4 + 3] = 0;

                            boneWeights[i * 4 + 0] = boneWeight.boneWeights;
                            boneWeights[i * 4 + 1] = 1 - boneWeight.boneWeights;
                            boneWeights[i * 4 + 2] = 0;
                            boneWeights[i * 4 + 3] = 0;
                        }
                        break;

                    case PmxObject.Vertex.BoneWeightType.Bdef4:
                    case PmxObject.Vertex.BoneWeightType.Qdef: // pmx 2.1 not support fallback to bdef4
                        {
                            const boneWeight = vertex.boneWeight as PmxObject.Vertex.BoneWeight<PmxObject.Vertex.BoneWeightType.Bdef4>;

                            boneIndices[i * 4 + 0] = boneWeight.boneIndices[0];
                            boneIndices[i * 4 + 1] = boneWeight.boneIndices[1];
                            boneIndices[i * 4 + 2] = boneWeight.boneIndices[2];
                            boneIndices[i * 4 + 3] = boneWeight.boneIndices[3];

                            boneWeights[i * 4 + 0] = boneWeight.boneWeights[0];
                            boneWeights[i * 4 + 1] = boneWeight.boneWeights[1];
                            boneWeights[i * 4 + 2] = boneWeight.boneWeights[2];
                            boneWeights[i * 4 + 3] = boneWeight.boneWeights[3];
                        }
                        break;

                    case PmxObject.Vertex.BoneWeightType.Sdef:
                        {
                            const boneWeight = vertex.boneWeight as PmxObject.Vertex.BoneWeight<PmxObject.Vertex.BoneWeightType.Sdef>;

                            boneIndices[i * 4 + 0] = boneWeight.boneIndices[0];
                            boneIndices[i * 4 + 1] = boneWeight.boneIndices[1];
                            boneIndices[i * 4 + 2] = 0;
                            boneIndices[i * 4 + 3] = 0;

                            const sdefWeights = boneWeight.boneWeights;
                            const boneWeight0 = sdefWeights.boneWeight0;
                            const boneWeight1 = 1 - boneWeight0;

                            boneWeights[i * 4 + 0] = boneWeight0;
                            boneWeights[i * 4 + 1] = boneWeight1;
                            boneWeights[i * 4 + 2] = 0;
                            boneWeights[i * 4 + 3] = 0;

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

                                boneSdefC![i * 3 + 0] = centerX;
                                boneSdefC![i * 3 + 1] = centerY;
                                boneSdefC![i * 3 + 2] = centerZ;

                                boneSdefR0![i * 3 + 0] = cr0X;
                                boneSdefR0![i * 3 + 1] = cr0Y;
                                boneSdefR0![i * 3 + 2] = cr0Z;

                                boneSdefR1![i * 3 + 0] = cr1X;
                                boneSdefR1![i * 3 + 1] = cr1Y;
                                boneSdefR1![i * 3 + 2] = cr1Z;

                                hasSdef = true;
                            }
                        }
                        break;
                    }

                    if (i % 10000 === 0 && 100 < performance.now() - time) {
                        progressEvent.loaded = lastStageLoaded + i;
                        onProgress?.({...progressEvent});

                        await Tools.DelayAsync(0);
                        time = performance.now();
                    }
                }

                progressEvent.loaded = lastStageLoaded + vertices.length;
                onProgress?.({...progressEvent});
                lastStageLoaded += vertices.length;
            }

            vertexData.positions = positions;
            vertexData.normals = normals;
            vertexData.uvs = uvs;
            vertexData.indices = indices;
            vertexData.matricesIndices = boneIndices;
            vertexData.matricesWeights = boneWeights;
        }

        scene._blockEntityCollection = !!assetContainer;
        const geometry = new Geometry(pmxObject.header.modelName, scene, vertexData, false);
        geometry._parentContainer = assetContainer;
        scene._blockEntityCollection = false;

        if (state.useSdef && hasSdef) {
            geometry.setVerticesData(SdefBufferKind.MatricesSdefCKind, boneSdefC!, false, 3);
            geometry.setVerticesData(SdefBufferKind.MatricesSdefR0Kind, boneSdefR0!, false, 3);
            geometry.setVerticesData(SdefBufferKind.MatricesSdefR1Kind, boneSdefR1!, false, 3);
        }
        geometry.applyToMesh(mesh);

        scene._blockEntityCollection = !!assetContainer;
        const multiMaterial = new MultiMaterial(pmxObject.header.modelName + "_multi", scene);
        multiMaterial._parentContainer = assetContainer;
        scene._blockEntityCollection = false;

        let buildMaterialsPromise: void | Promise<void> = undefined;

        const textureLoadPromise = new Promise<void>((resolve) => {
            buildMaterialsPromise = state.materialBuilder.buildMaterials(
                mesh.uniqueId, // uniqueId
                pmxObject.materials, // materialsInfo
                pmxObject.textures, // texturePathTable
                rootUrl, // rootUrl
                "file:" + state.pmxFileId + "_", // fileRootId
                state.referenceFiles, // referenceFiles
                scene, // scene
                assetContainer, // assetContainer
                vertexData.indices as Uint16Array | Uint32Array, // indices
                vertexData.uvs as Float32Array, // uvs
                multiMaterial, // multiMaterial
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
            const materials = pmxObject.materials;
            let offset = 0;
            for (let i = 0; i < materials.length; ++i) {
                const materialInfo = materials[i];

                new SubMesh(
                    i, // materialIndex
                    0, // verticesStart
                    pmxObject.vertices.length, // verticesCount
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
            skeleton = new Skeleton(pmxObject.header.modelName, pmxObject.header.modelName + "_skeleton", scene);
            skeleton._parentContainer = assetContainer;
            scene._blockEntityCollection = false;
            {
                const bonesInfo = pmxObject.bones;
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
                const morphsInfo = pmxObject.morphs;

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

                    const morphTarget = new MorphTarget(morphInfo.name, 0, scene);
                    morphTargets.push(morphTarget);

                    if (morphInfo.type === PmxObject.Morph.Type.VertexMorph) {
                        const positions = new Float32Array(pmxObject.vertices.length * 3);
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
                        const uvs = new Float32Array(pmxObject.vertices.length * 2);
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
                modelName: pmxObject.header.modelName,
                englishModelName: pmxObject.header.englishModelName,
                comment: pmxObject.header.comment,
                englishComment: pmxObject.header.englishComment
            },
            bones: bonesMetadata,
            morphs: morphsMetadata,
            rigidBodies: pmxObject.rigidBodies,
            joints: pmxObject.joints
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
