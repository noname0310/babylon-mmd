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
    Geometry,
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
import { MmdStandardMaterialBuilder } from "./MmdStandardMaterialBuilder";
import { PmxObject } from "./parser/PmxObject";
import { PmxReader } from "./parser/PmxReader";
import { SdefBufferKind } from "./SdefBufferKind";
import { SdefMesh } from "./SdefMesh";

export class PmxLoader implements ISceneLoaderPluginAsync {
    /**
     * Name of the loader ("pmx")
     */
    public name: string;
    public extensions: ISceneLoaderPluginExtensions;

    public materialBuilder: IMmdMaterialBuilder;
    public useSdef = true;

    public constructor() {
        this.name = "pmx";
        this.extensions = {
            // eslint-disable-next-line @typescript-eslint/naming-convention
            ".pmx": { isBinary: true }
        };

        this.materialBuilder = new MmdStandardMaterialBuilder();
    }

    public async importMeshAsync(
        _meshesNames: any,
        scene: Scene,
        data: any,
        rootUrl: string,
        onProgress?: (event: ISceneLoaderProgressEvent) => void,
        fileName?: string
    ): Promise<ISceneLoaderAsyncResult> {
        scene;
        data;
        rootUrl;
        onProgress;
        fileName;
        return Promise.reject("not implemented");
    }

    public async loadAsync(
        scene: Scene,
        data: any,
        rootUrl: string,
        onProgress?: (event: ISceneLoaderProgressEvent) => void,
        fileName?: string
    ): Promise<void> {
        // data must be ArrayBuffer
        const pmxObject = await PmxReader.parseAsync(data)
            .catch((e: any) => {
                return Promise.reject(e);
            });

        const useSdef = this.useSdef;

        const mesh = new (useSdef ? SdefMesh : Mesh)(pmxObject.header.modelName, scene);

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
                        await Tools.DelayAsync(0);
                        time = performance.now();
                    }
                }
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
                    case PmxObject.Vertex.BoneWeightType.bdef1:
                        {
                            const boneWeight = vertex.boneWeight as PmxObject.Vertex.BoneWeight<PmxObject.Vertex.BoneWeightType.bdef1>;

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

                    case PmxObject.Vertex.BoneWeightType.bdef2:
                        {
                            const boneWeight = vertex.boneWeight as PmxObject.Vertex.BoneWeight<PmxObject.Vertex.BoneWeightType.bdef2>;

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

                    case PmxObject.Vertex.BoneWeightType.bdef4:
                    case PmxObject.Vertex.BoneWeightType.qdef: // pmx 2.1 not support fallback to bdef4
                        {
                            const boneWeight = vertex.boneWeight as PmxObject.Vertex.BoneWeight<PmxObject.Vertex.BoneWeightType.bdef4>;

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

                    case PmxObject.Vertex.BoneWeightType.sdef:
                        {
                            const boneWeight = vertex.boneWeight as PmxObject.Vertex.BoneWeight<PmxObject.Vertex.BoneWeightType.sdef>;

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
                        await Tools.DelayAsync(0);
                        time = performance.now();
                    }
                }
            }

            vertexData.positions = positions;
            vertexData.normals = normals;
            vertexData.uvs = uvs;
            vertexData.indices = indices;
            vertexData.matricesIndices = boneIndices;
            vertexData.matricesWeights = boneWeights;
        }

        const geometry = new Geometry(pmxObject.header.modelName, scene, vertexData, false);
        if (useSdef && hasSdef) {
            geometry.setVerticesData(SdefBufferKind.matricesSdefCKind, boneSdefC!, false, 3);
            geometry.setVerticesData(SdefBufferKind.matricesSdefR0Kind, boneSdefR0!, false, 3);
            geometry.setVerticesData(SdefBufferKind.matricesSdefR1Kind, boneSdefR1!, false, 3);
        }
        geometry.applyToMesh(mesh);

        const multiMaterial = new MultiMaterial(pmxObject.header.modelName + "_multi", scene);
        const buildMaterialsPromise = this.materialBuilder.buildMaterials(
            mesh.uniqueId,
            pmxObject,
            rootUrl,
            scene,
            vertexData.indices,
            vertexData.uvs,
            multiMaterial
        );
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

        const skeleton = new Skeleton(pmxObject.header.modelName, pmxObject.header.modelName + "_skeleton", scene);
        {
            const bonesInfo = pmxObject.bones;
            {
                const bones: Bone[] = [];

                for (let i = 0; i < bonesInfo.length; ++i) {
                    const boneInfo = bonesInfo[i];
                    const boneWorldPosition = boneInfo.position;

                    const bonePosition = new Vector3(boneWorldPosition[0], boneWorldPosition[1], boneWorldPosition[2]);
                    if (boneInfo.parentBoneIndex !== -1) {
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
                }

                for (let i = 0; i < bones.length; ++i) {
                    const boneInfo = bonesInfo[i];
                    const bone = bones[i];

                    if (boneInfo.parentBoneIndex !== -1) {
                        bone.setParent(bones[boneInfo.parentBoneIndex]);
                    }
                }
            }
        }
        mesh.skeleton = skeleton;

        const morphTargetManager = new MorphTargetManager();
        {
            const morphsInfo = pmxObject.morphs;

            const morphTargets: MorphTarget[] = [];
            const morphIndexMap = new Map<string, number>();

            for (let i = 0; i < morphsInfo.length; ++i) {
                const morphInfo = morphsInfo[i];
                if (
                    morphInfo.type !== PmxObject.Morph.Type.vertexMorph &&
                    morphInfo.type !== PmxObject.Morph.Type.uvMorph
                ) {
                    // group morph, bone morph, material morph will be handled by cpu bound custom runtime
                    continue;
                }

                const morphIndex = morphIndexMap.get(morphInfo.name);
                let morphTarget: MorphTarget;
                if (morphIndex === undefined) {
                    morphTarget = new MorphTarget(morphInfo.name, 0, scene);
                    morphTargets.push(morphTarget);
                    morphIndexMap.set(morphInfo.name, morphTargets.length - 1);
                } else {
                    morphTarget = morphTargets[morphIndex];
                }

                if (morphInfo.type === PmxObject.Morph.Type.vertexMorph) {
                    let positions = morphTarget.getPositions();
                    if (positions === null) {
                        positions = new Float32Array(pmxObject.vertices.length * 3);
                        positions.set(vertexData.positions);
                    }

                    const elements = morphInfo.elements as PmxObject.Morph.VertexMorph[];
                    let time = performance.now();
                    for (let i = 0; i < elements.length; ++i) {
                        const element = elements[i];
                        const elementIndex = element.index;
                        const elementPosition = element.position;
                        positions[elementIndex * 3 + 0] += elementPosition[0];
                        positions[elementIndex * 3 + 1] += elementPosition[1];
                        positions[elementIndex * 3 + 2] += elementPosition[2];

                        if (i % 10000 === 0 && 100 < performance.now() - time) {
                            await Tools.DelayAsync(0);
                            time = performance.now();
                        }
                    }

                    morphTarget.setPositions(positions);
                } else /*if (morphInfo.type === PmxObject.Morph.Type.uvMorph)*/ {
                    let uvs = morphTarget.getUVs();
                    if (uvs === null) {
                        uvs = new Float32Array(pmxObject.vertices.length * 2);
                        uvs.set(vertexData.uvs);
                    }

                    const elements = morphInfo.elements as PmxObject.Morph.UvMorph[];
                    let time = performance.now();
                    for (let i = 0; i < elements.length; ++i) {
                        const element = elements[i];
                        const elementIndex = element.index;
                        const elementUvOffset = element.offset;

                        // todo: fix uv morph
                        uvs[elementIndex * 2 + 0] += elementUvOffset[0];
                        uvs[elementIndex * 2 + 0] *= elementUvOffset[1];

                        uvs[elementIndex * 2 + 1] += elementUvOffset[2];
                        uvs[elementIndex * 2 + 1] *= elementUvOffset[3];

                        if (i % 10000 === 0 && 100 < performance.now() - time) {
                            await Tools.DelayAsync(0);
                            time = performance.now();
                        }
                    }
                }
            }

            for (let i = 0; i < morphTargets.length; ++i) {
                morphTargetManager.addTarget(morphTargets[i]);
            }
        }
        mesh.morphTargetManager = morphTargetManager;

        onProgress;
        fileName;
    }

    public loadAssetContainerAsync(
        scene: Scene,
        data: any,
        rootUrl: string,
        onProgress?: (event: ISceneLoaderProgressEvent) => void,
        fileName?: string
    ): Promise<AssetContainer> {
        const assetContainer = new AssetContainer(scene);
        data;
        rootUrl;
        onProgress;
        fileName;
        return Promise.resolve(assetContainer);
    }

    public loadFile(
        scene: Scene,
        fileOrUrl: string | File,
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
}
