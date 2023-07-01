import type {
    IFileRequest,
    ISceneLoaderAsyncResult,
    ISceneLoaderPluginAsync,
    ISceneLoaderPluginExtensions,
    ISceneLoaderProgressEvent,
    LoadFileError,
    Scene,
    WebRequest
} from "@babylonjs/core";
import {
    AssetContainer,
    Bone,
    BoundingInfo,
    Geometry,
    Logger,
    Matrix,
    Mesh,
    MorphTarget,
    MorphTargetManager,
    MultiMaterial,
    Skeleton,
    SubMesh,
    Tools,
    Vector3,
    VertexData
} from "@babylonjs/core";

import type { IMmdMaterialBuilder } from "./IMmdMaterialBuilder";
import type { MmdModelMetadata } from "./MmdModelMetadata";
import { MmdStandardMaterialBuilder } from "./MmdStandardMaterialBuilder";
import type { ILogger } from "./parser/ILogger";
import { PmxObject } from "./parser/PmxObject";
import { PmxReader } from "./parser/PmxReader";
import { SdefBufferKind } from "./SdefBufferKind";
import { SdefMesh } from "./SdefMesh";

export class PmxLoader implements ISceneLoaderPluginAsync, ILogger {
    /**
     * Name of the loader ("pmx")
     */
    public name: string;
    public extensions: ISceneLoaderPluginExtensions;

    public materialBuilder: IMmdMaterialBuilder;
    public useSdef: boolean;
    public boundingBoxMargin: number;

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
        this.boundingBoxMargin = 10;

        this._loggingEnabled = false;
        this.log = this._logDisabled;
        this.warn = this._warnDisabled;
        this.error = this._errorDisabled;
    }

    public importMeshAsync(
        _meshesNames: any,
        scene: Scene,
        data: any,
        rootUrl: string,
        onProgress?: (event: ISceneLoaderProgressEvent) => void,
        _fileName?: string
    ): Promise<ISceneLoaderAsyncResult> {
        return this._loadAsyncInternal(scene, null, data, rootUrl, onProgress);
    }

    public loadAsync(
        scene: Scene,
        data: any,
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
        data: any,
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
        onSuccess: (data: any, responseURL?: string | undefined) => void,
        onProgress?: ((ev: ISceneLoaderProgressEvent) => void) | undefined,
        useArrayBuffer?: boolean | undefined,
        onError?: ((request?: WebRequest | undefined, exception?: LoadFileError | undefined) => void) | undefined
    ): IFileRequest {
        const request = scene._loadFile(
            fileOrUrl,
            onSuccess,
            onProgress,
            true,
            useArrayBuffer,
            onError
        );
        return request;
    }

    private async _loadAsyncInternal(
        scene: Scene,
        assetContainer: AssetContainer | null,
        data: ArrayBuffer,
        rootUrl: string,
        onProgress?: (event: ISceneLoaderProgressEvent) => void
    ): Promise<ISceneLoaderAsyncResult> {
        const useSdef = this.useSdef;
        const boundingBoxMargin = this.boundingBoxMargin;

        // data must be ArrayBuffer
        const pmxObject = await PmxReader.ParseAsync(data, this)
            .catch((e: any) => {
                return Promise.reject(e);
            });

        const parseCost = Math.floor(data.byteLength / 100);
        const buildMaterialCost = 100 * pmxObject.materials.length;
        const buildSkeletonCost = 100 * pmxObject.bones.length;
        let buildMorphCost = 0;
        {
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

                buildMorphCost += morphInfo.elements.length;
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
        const mesh = new (useSdef ? SdefMesh : Mesh)(pmxObject.header.modelName, scene);
        mesh._parentContainer = assetContainer;
        scene._blockEntityCollection = false;

        const vertexData = new VertexData();
        const boneSdefC = useSdef ? new Float32Array(pmxObject.vertices.length * 3) : undefined;
        const boneSdefR0 = useSdef ? new Float32Array(pmxObject.vertices.length * 3) : undefined;
        const boneSdefR1 = useSdef ? new Float32Array(pmxObject.vertices.length * 3) : undefined;
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

                            if (useSdef) {
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

        if (useSdef && hasSdef) {
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
            buildMaterialsPromise = this.materialBuilder.buildMaterials(
                mesh.uniqueId,
                pmxObject,
                rootUrl,
                scene,
                assetContainer,
                vertexData.indices as Uint16Array | Uint32Array,
                vertexData.uvs as Float32Array,
                multiMaterial,
                (event) => {
                    if (!applyTextureLoading) return;
                    const loadedRatio = event.loaded / event.total;
                    progressEvent.loaded = lastStageLoaded + Math.floor(textureLoadCost * loadedRatio);
                    onProgress?.({...progressEvent});
                },
                () => resolve()
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

        scene._blockEntityCollection = !!assetContainer;
        const skeleton = new Skeleton(pmxObject.header.modelName, pmxObject.header.modelName + "_skeleton", scene);
        skeleton._parentContainer = assetContainer;
        scene._blockEntityCollection = false;
        const bonesMetadata: MmdModelMetadata.Bone[] = [];
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

        scene._blockEntityCollection = !!assetContainer;
        const morphTargetManager = new MorphTargetManager(scene);
        morphTargetManager._parentContainer = assetContainer;
        scene._blockEntityCollection = false;

        const morphsMetadata: MmdModelMetadata.Morph[] = [];
        {
            const morphsInfo = pmxObject.morphs;

            const morphTargets: MorphTarget[] = [];

            for (let i = 0; i < morphsInfo.length; ++i) {
                const morphInfo = morphsInfo[i];

                // create morph metadata
                if (
                    morphInfo.type !== PmxObject.Morph.Type.FlipMorph &&
                    morphInfo.type !== PmxObject.Morph.Type.ImpulseMorph
                ) {
                    let elements: readonly PmxObject.Morph.GroupMorph[]
                        | readonly PmxObject.Morph.BoneMorph[]
                        | readonly PmxObject.Morph.MaterialMorph[]
                        | number = morphTargets.length;
                    if (
                        morphInfo.type === PmxObject.Morph.Type.GroupMorph ||
                        morphInfo.type === PmxObject.Morph.Type.BoneMorph ||
                        morphInfo.type === PmxObject.Morph.Type.MaterialMorph
                    ) {
                        elements = morphInfo.elements as (
                            readonly PmxObject.Morph.GroupMorph[]
                            | readonly PmxObject.Morph.BoneMorph[]
                            | readonly PmxObject.Morph.MaterialMorph[]);
                    }

                    morphsMetadata.push({
                        name: morphInfo.name,
                        englishName: morphInfo.englishName,

                        category: morphInfo.category,
                        type: morphInfo.type,

                        elements: elements
                    });
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

                    const elements = morphInfo.elements as PmxObject.Morph.VertexMorph[];
                    let time = performance.now();
                    for (let j = 0; j < elements.length; ++j) {
                        const element = elements[j];
                        const elementIndex = element.index;
                        const elementPosition = element.position;
                        positions[elementIndex * 3 + 0] += elementPosition[0];
                        positions[elementIndex * 3 + 1] += elementPosition[1];
                        positions[elementIndex * 3 + 2] += elementPosition[2];

                        if (j % 10000 === 0 && 100 < performance.now() - time) {
                            progressEvent.loaded = lastStageLoaded + j;
                            onProgress?.({...progressEvent});

                            await Tools.DelayAsync(0);
                            time = performance.now();
                        }
                    }
                    lastStageLoaded += elements.length;

                    morphTarget.setPositions(positions);
                } else /*if (morphInfo.type === PmxObject.Morph.Type.uvMorph)*/ {
                    const uvs = new Float32Array(pmxObject.vertices.length * 2);
                    uvs.set(vertexData.uvs);

                    const elements = morphInfo.elements as PmxObject.Morph.UvMorph[];
                    let time = performance.now();
                    for (let j = 0; j < elements.length; ++j) {
                        const element = elements[j];
                        const elementIndex = element.index;
                        const elementUvOffset = element.offset;

                        uvs[elementIndex * 2 + 0] += elementUvOffset[0];
                        uvs[elementIndex * 2 + 1] += elementUvOffset[1];

                        if (j % 10000 === 0 && 100 < performance.now() - time) {
                            progressEvent.loaded = lastStageLoaded + j;
                            onProgress?.({...progressEvent});

                            await Tools.DelayAsync(0);
                            time = performance.now();
                        }
                    }
                    lastStageLoaded += elements.length;

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
            assetContainer.skeletons.push(skeleton);
            assetContainer.morphTargetManagers.push(morphTargetManager);
        }

        return {
            meshes: [mesh],
            particleSystems: [],
            skeletons: [skeleton],
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
