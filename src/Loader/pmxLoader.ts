import type { AssetContainer } from "@babylonjs/core/assetContainer";
import { type ISceneLoaderPluginAsync, type ISceneLoaderProgressEvent, SceneLoader } from "@babylonjs/core/Loading/sceneLoader";
import { MultiMaterial } from "@babylonjs/core/Materials/multiMaterial";
import { Geometry } from "@babylonjs/core/Meshes/geometry";
import type { Mesh } from "@babylonjs/core/Meshes/mesh";
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

import type { BuildGeometryResult, BuildMaterialResult, MmdModelLoadState } from "./mmdModelLoader";
import { MmdModelLoader } from "./mmdModelLoader";
import type { MmdModelMetadata } from "./mmdModelMetadata";
import { ObjectUniqueIdProvider } from "./objectUniqueIdProvider";
import type { ILogger } from "./Parser/ILogger";
import { PmxObject } from "./Parser/pmxObject";
import { PmxReader } from "./Parser/pmxReader";
import type { Progress, ProgressTask } from "./progress";
import { SdefBufferKind } from "./sdefBufferKind";

interface PmxLoadState extends MmdModelLoadState {
    readonly referenceFiles: readonly File[];
}

/**
 * PmxLoader is a loader that loads the model in the PMX format
 *
 * PMX is a binary file format that contains all the data except the texture of the model
 */
export class PmxLoader extends MmdModelLoader<PmxLoadState, PmxObject> implements ISceneLoaderPluginAsync, ILogger {
    /**
     * Reference files for load PMX from files (textures)
     *
     * This property is used to load textures from files
     *
     * pmx files typically store texture files separately in a subdirectory of url root
     *
     * Therefore, in order to load it as a file, you need to put information about these files separately
     */
    public referenceFiles: readonly File[];

    /**
     * Create a new PmxLoader
     */
    public constructor() {
        super(
            "pmx",
            {
                // eslint-disable-next-line @typescript-eslint/naming-convention
                ".pmx": { isBinary: true }
            }
        );

        this.referenceFiles = [];
    }

    public loadFile(
        scene: Scene,
        fileOrUrl: string | File,
        _rootUrl: string,
        onSuccess: (data: PmxLoadState, responseURL?: string | undefined) => void,
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
                const loadState: PmxLoadState = {
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

    protected override async _parseFileAsync(arrayBuffer: ArrayBuffer): Promise<PmxObject> {
        return await PmxReader.ParseAsync(arrayBuffer, this)
            .catch((e: any) => {
                return Promise.reject(e);
            });
    }

    protected override _getProgressTaskCosts(state: PmxLoadState, modelObject: PmxObject): ProgressTask[] {
        const tasks = super._getProgressTaskCosts(state, modelObject);
        tasks.push({ name: "Build Face", cost: modelObject.faces.length });
        tasks.push({ name: "Build Vertex", cost: modelObject.vertices.length });
        return tasks;
    }

    protected override async _buildGeometryAsync(
        state: PmxLoadState,
        modelObject: PmxObject,
        mesh: Mesh,
        scene: Scene,
        assetContainer: Nullable<AssetContainer>,
        progress: Progress
    ): Promise<BuildGeometryResult> {
        const vertexData = new VertexData();
        const boneSdefC = state.useSdef ? new Float32Array(modelObject.vertices.length * 3) : undefined;
        const boneSdefR0 = state.useSdef ? new Float32Array(modelObject.vertices.length * 3) : undefined;
        const boneSdefR1 = state.useSdef ? new Float32Array(modelObject.vertices.length * 3) : undefined;
        let hasSdef = false;
        {
            const vertices = modelObject.vertices;
            const positions = new Float32Array(vertices.length * 3);
            const normals = new Float32Array(vertices.length * 3);
            const uvs = new Float32Array(vertices.length * 2);
            const boneIndices = new Float32Array(vertices.length * 4);
            const boneWeights = new Float32Array(vertices.length * 4);

            let indices;
            if (modelObject.faces instanceof Uint8Array || modelObject.faces instanceof Uint16Array) {
                indices = new Uint16Array(modelObject.faces.length);
            } else {
                indices = new Uint32Array(modelObject.faces.length);
            }
            {
                let time = performance.now();
                const faces = modelObject.faces;
                for (let i = 0; i < indices.length; i += 3) { // reverse winding order
                    indices[i + 0] = faces[i + 0];
                    indices[i + 1] = faces[i + 2];
                    indices[i + 2] = faces[i + 1];

                    if (i % 10000 === 0 && 100 < performance.now() - time) {
                        progress.setTaskProgress("Build Face", i);
                        progress.invokeProgressEvent();

                        await Tools.DelayAsync(0);
                        time = performance.now();
                    }
                }

                progress.endTask("Build Face");
                progress.invokeProgressEvent();
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
                        progress.setTaskProgress("Build Vertex", i);
                        progress.invokeProgressEvent();

                        await Tools.DelayAsync(0);
                        time = performance.now();
                    }
                }

                progress.endTask("Build Vertex");
                progress.invokeProgressEvent();
            }

            vertexData.positions = positions;
            vertexData.normals = normals;
            vertexData.uvs = uvs;
            vertexData.indices = indices;
            vertexData.matricesIndices = boneIndices;
            vertexData.matricesWeights = boneWeights;
        }

        scene._blockEntityCollection = !!assetContainer;
        const geometry = new Geometry(modelObject.header.modelName, scene, vertexData, false);
        geometry._parentContainer = assetContainer;
        scene._blockEntityCollection = false;

        if (state.useSdef && hasSdef) {
            geometry.setVerticesData(SdefBufferKind.MatricesSdefCKind, boneSdefC!, false, 3);
            geometry.setVerticesData(SdefBufferKind.MatricesSdefR0Kind, boneSdefR0!, false, 3);
            geometry.setVerticesData(SdefBufferKind.MatricesSdefR1Kind, boneSdefR1!, false, 3);
        }
        geometry.applyToMesh(mesh);

        return { vertexData, geometry };
    }

    protected override async _buildMaterialAsync(
        state: PmxLoadState,
        modelObject: PmxObject,
        mesh: Mesh,
        scene: Scene,
        assetContainer: Nullable<AssetContainer>,
        vertexData: VertexData,
        rootUrl: string,
        progress: Progress
    ): Promise<BuildMaterialResult> {
        scene._blockEntityCollection = !!assetContainer;
        const multiMaterial = new MultiMaterial(modelObject.header.modelName + "_multi", scene);
        multiMaterial._parentContainer = assetContainer;
        scene._blockEntityCollection = false;

        let buildMaterialsPromise: void | Promise<void> = undefined;

        const textureLoadPromise = new Promise<void>((resolve) => {
            buildMaterialsPromise = state.materialBuilder.buildMaterials(
                mesh.uniqueId, // uniqueId
                modelObject.materials, // materialsInfo
                modelObject.textures, // texturePathTable
                rootUrl, // rootUrl
                "file:" + state.pmxFileId + "_", // fileRootId
                state.referenceFiles, // referenceFiles
                scene, // scene
                assetContainer, // assetContainer
                vertexData.indices as Uint16Array | Uint32Array, // indices
                vertexData.uvs as Float32Array, // uvs
                multiMaterial, // multiMaterial
                this, // logger
                (event) => {
                    if (!event.lengthComputable) return;
                    progress.setTaskProgressRatio("Texture Load", event.loaded / event.total, true);
                    progress.invokeProgressEvent();
                }, // onTextureLoadProgress
                () => resolve() // onTextureLoadComplete
            );
        });
        if (buildMaterialsPromise !== undefined) {
            await buildMaterialsPromise;
        }
        mesh.material = multiMaterial;

        progress.endTask("Build Material");
        progress.invokeProgressEvent();

        return { multiMaterial, textureLoadPromise };
    }

    protected override _buildSubMeshes(
        modelObject: PmxObject,
        mesh: Mesh
    ): void {
        mesh.subMeshes.length = 0;
        const materials = modelObject.materials;
        let offset = 0;
        for (let i = 0; i < materials.length; ++i) {
            const materialInfo = materials[i];

            new SubMesh(
                i, // materialIndex
                0, // verticesStart
                modelObject.vertices.length, // verticesCount
                offset, // indexStart
                materialInfo.surfaceCount, // indexCount
                mesh
            );

            offset += materialInfo.surfaceCount;
        }
    }

    protected override async _buildMorphAsync(
        modelObject: PmxObject,
        mesh: Mesh,
        scene: Scene,
        assetContainer: Nullable<AssetContainer>,
        vertexData: VertexData,
        morphsMetadata: MmdModelMetadata.Morph[],
        progress: Progress
    ): Promise<MorphTargetManager> {
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
                    const positions = new Float32Array(modelObject.vertices.length * 3);
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
                    const uvs = new Float32Array(modelObject.vertices.length * 2);
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
    SceneLoader.RegisterPlugin(new PmxLoader());
}
