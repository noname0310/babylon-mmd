import { AssetContainer } from "@babylonjs/core/assetContainer";
import { Bone } from "@babylonjs/core/Bones/bone";
import { Skeleton } from "@babylonjs/core/Bones/skeleton";
import { BoundingInfo } from "@babylonjs/core/Culling/boundingInfo";
import type { ISceneLoaderAsyncResult, ISceneLoaderPluginAsync, ISceneLoaderPluginExtensions, ISceneLoaderProgressEvent } from "@babylonjs/core/Loading/sceneLoader";
import type { MultiMaterial } from "@babylonjs/core/Materials/multiMaterial";
import { Matrix, Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { Geometry } from "@babylonjs/core/Meshes/geometry";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import type { VertexData } from "@babylonjs/core/Meshes/mesh.vertexData";
import { Logger } from "@babylonjs/core/Misc/logger";
import type { MorphTargetManager } from "@babylonjs/core/Morph/morphTargetManager";
import type { Scene } from "@babylonjs/core/scene";
import type { Nullable } from "@babylonjs/core/types";

import type { IMmdMaterialBuilder } from "./IMmdMaterialBuilder";
import type { MmdModelMetadata } from "./mmdModelMetadata";
import { MmdStandardMaterialBuilder } from "./mmdStandardMaterialBuilder";
import type { BpmxObject } from "./Optimized/Parser/bpmxObject";
import type { ILogger } from "./Parser/ILogger";
import { PmxObject } from "./Parser/pmxObject";
import type { ProgressTask } from "./progress";
import { Progress } from "./progress";
import { SdefMesh } from "./sdefMesh";

/** @internal */
export interface MmdModelLoadState {
    readonly arrayBuffer: ArrayBuffer;
    readonly pmFileId: string;
    readonly materialBuilder: IMmdMaterialBuilder;
    readonly useSdef: boolean;
    readonly buildSkeleton: boolean;
    readonly buildMorph: boolean;
    readonly boundingBoxMargin: number;
}

/** @internal */
export interface BuildGeometryResult {
    readonly vertexData: VertexData;
    readonly geometry: Geometry;
}

/** @internal */
export interface BuildMaterialResult {
    readonly multiMaterial: MultiMaterial;
    readonly textureLoadPromise: Promise<void>;
}

/**
 * @internal
 * Base class of loader for MMD model (pmx / pmd / bpmx)
 */
export abstract class MmdModelLoader<LoadState extends MmdModelLoadState, ModelObject extends PmxObject | BpmxObject> implements ISceneLoaderPluginAsync, ILogger {
    /**
     * Name of the loader
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
     * This feature is useful when you want to load a model that is not animated (e.g. background object)
     */
    public buildSkeleton: boolean;

    /**
     * Whether to build morph (default: true)
     *
     * If you want to load a model without morph, you can disable this feature
     *
     * This feature is useful when you want to load a model that is not animated (e.g. background object)
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
     * Create a new MMD model loader
     */
    public constructor(name: string, extensions: ISceneLoaderPluginExtensions) {
        this.name = name;
        this.extensions = extensions;

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

    private async _loadAsyncInternal(
        scene: Scene,
        assetContainer: Nullable<AssetContainer>,
        state: LoadState,
        rootUrl: string,
        onProgress?: (event: ISceneLoaderProgressEvent) => void
    ): Promise<ISceneLoaderAsyncResult> {
        const modelObject = await this._parseFileAsync(state.arrayBuffer);

        const progress = new Progress(true, this._getProgressTaskCosts(state, modelObject), onProgress ?? null);
        progress.endTask("Parse");
        progress.invokeProgressEvent();

        scene._blockEntityCollection = !!assetContainer;
        const mesh = new (state.useSdef ? SdefMesh : Mesh)(modelObject.header.modelName, scene);
        mesh._parentContainer = assetContainer;
        scene._blockEntityCollection = false;
        mesh.setEnabled(false);

        const { vertexData, geometry } = await this._buildGeometryAsync(
            state,
            modelObject,
            mesh,
            scene,
            assetContainer,
            progress
        );

        const { multiMaterial, textureLoadPromise } = await this._buildMaterialAsync(
            state,
            modelObject,
            mesh,
            scene,
            assetContainer,
            vertexData,
            rootUrl,
            progress
        );

        this._buildSubMeshes(modelObject, mesh);

        const bonesMetadata: MmdModelMetadata.Bone[] = [];
        let skeleton: Nullable<Skeleton> = null;
        if (state.buildSkeleton) {
            skeleton = await this._buildSkeletonAsync(
                modelObject,
                mesh,
                scene,
                assetContainer,
                bonesMetadata,
                progress
            );
        } else {
            progress.endTask("Build Skeleton");
        }

        const morphsMetadata: MmdModelMetadata.Morph[] = [];
        let morphTargetManager: Nullable<MorphTargetManager> = null;
        if (state.buildMorph) {
            morphTargetManager = await this._buildMorphAsync(
                modelObject,
                mesh,
                scene,
                assetContainer,
                vertexData,
                morphsMetadata,
                progress
            );
        } else {
            progress.endTask("Build Morph");
        }

        if (state.boundingBoxMargin !== 0) {
            this._applyBoundingBoxMargin(mesh, state.boundingBoxMargin);
        }

        mesh.metadata = <MmdModelMetadata>{
            isMmdModel: true,
            header: {
                modelName: modelObject.header.modelName,
                englishModelName: modelObject.header.englishModelName,
                comment: modelObject.header.comment,
                englishComment: modelObject.header.englishComment
            },
            bones: bonesMetadata,
            morphs: morphsMetadata,
            rigidBodies: modelObject.rigidBodies,
            joints: modelObject.joints
        };

        progress.invokeProgressEvent();

        await textureLoadPromise;
        progress.endTask("Texture Load");
        progress.invokeProgressEvent();

        mesh.setEnabled(true);

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

    protected abstract _parseFileAsync(arrayBuffer: ArrayBuffer): Promise<ModelObject>;

    protected _getProgressTaskCosts(state: LoadState, modelObject: ModelObject): ProgressTask[] {
        let buildMorphCost = 0;
        if (state.buildMorph) {
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
        }

        return [
            { name: "Parse", cost: Math.floor(state.arrayBuffer.byteLength / 100) },
            { name: "Build Material", cost: 100 * modelObject.materials.length },
            { name: "Build Skeleton", cost: state.buildSkeleton ? 100 * modelObject.bones.length : 0 },
            { name: "Build Morph", cost: buildMorphCost },
            { name: "Texture Load", cost: 30000 * modelObject.textures.length }
        ];
    }

    protected abstract _buildGeometryAsync(
        state: LoadState,
        modelObject: ModelObject,
        mesh: Mesh,
        scene: Scene,
        assetContainer: Nullable<AssetContainer>,
        progress: Progress
    ): Promise<BuildGeometryResult>;

    protected abstract _buildMaterialAsync(
        state: LoadState,
        modelObject: ModelObject,
        mesh: Mesh,
        scene: Scene,
        assetContainer: Nullable<AssetContainer>,
        vertexData: VertexData,
        rootUrl: string,
        progress: Progress
    ): Promise<BuildMaterialResult>;

    protected abstract _buildSubMeshes(
        modelObject: ModelObject,
        mesh: Mesh
    ): void;

    protected async _buildSkeletonAsync(
        modelObject: ModelObject,
        mesh: Mesh,
        scene: Scene,
        assetContainer: Nullable<AssetContainer>,
        bonesMetadata: MmdModelMetadata.Bone[],
        progress: Progress
    ): Promise<Skeleton> {
        scene._blockEntityCollection = !!assetContainer;
        const skeleton = new Skeleton(modelObject.header.modelName, modelObject.header.modelName + "_skeleton", scene);
        skeleton._parentContainer = assetContainer;
        scene._blockEntityCollection = false;
        {
            const bonesInfo = modelObject.bones;
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
        progress.endTask("Build Skeleton");
        progress.invokeProgressEvent();

        return mesh.skeleton = skeleton;
    }

    protected abstract _buildMorphAsync(
        modelObject: ModelObject,
        mesh: Mesh,
        scene: Scene,
        assetContainer: Nullable<AssetContainer>,
        vertexData: VertexData,
        morphsMetadata: MmdModelMetadata.Morph[],
        progress: Progress
    ): Promise<MorphTargetManager>;

    private _applyBoundingBoxMargin(mesh: Mesh, boundingBoxMargin: number): void {
        if (mesh.subMeshes === undefined) return;
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
