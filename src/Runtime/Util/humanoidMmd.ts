import { CreateSphere, StandardMaterial } from "@babylonjs/core";
import type { Bone } from "@babylonjs/core/Bones/bone";
import type { Skeleton } from "@babylonjs/core/Bones/skeleton";
import { Quaternion, Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Matrix } from "@babylonjs/core/Maths/math.vector";
import type { Mesh } from "@babylonjs/core/Meshes/mesh";
import type { MorphTargetManager } from "@babylonjs/core/Morph/morphTargetManager";
import type { Nullable } from "@babylonjs/core/types";

import type { MmdModelMetadata } from "@/Loader/mmdModelMetadata";
import { PmxObject } from "@/Loader/Parser/pmxObject";

import type { IMmdLinkedBoneContainer, IMmdRuntimeLinkedBone } from "../IMmdRuntimeLinkedBone";
import { HumanoidMesh } from "../mmdMesh";
import { MmdModel } from "../mmdModel";
import type { MmdRuntime } from "../mmdRuntime";

class LinkedBoneProxy implements IMmdRuntimeLinkedBone {
    public name: string;

    public position: Vector3;
    public rotationQuaternion: Quaternion;
    public scaling: Vector3;

    public parent: Nullable<LinkedBoneProxy>;
    public readonly children: LinkedBoneProxy[];

    private readonly _bone: Nullable<Bone>;
    private readonly _restMatrix: Matrix;
    private readonly _finalMatrix: Matrix;

    public constructor(name: string, bone: Nullable<Bone>) {
        this.name = name;

        if (bone !== null) {
            this.position = bone.position;
            this.rotationQuaternion = bone.rotationQuaternion;
            this.scaling = bone.scaling;
        } else {
            this.position = Vector3.Zero();
            this.rotationQuaternion = Quaternion.Identity();
            this.scaling = Vector3.One();
        }

        this.parent = null;
        this.children = [];

        this._bone = bone;
        this._restMatrix = bone !== null ? bone.getRestMatrix() : Matrix.Identity();
        this._finalMatrix = new Matrix();
    }

    public getRestMatrix(): Matrix {
        return this._restMatrix;
    }

    public getFinalMatrix(): Matrix {
        return this._finalMatrix;
    }

    public setRotationQuaternion(quat: Quaternion): void {
        this.rotationQuaternion.copyFrom(quat);
    }

    public apply(): void {
        this._bone;
    }
}

class BoneContainer implements IMmdLinkedBoneContainer {
    public bones: LinkedBoneProxy[];

    public constructor(bones: LinkedBoneProxy[]) {
        this.bones = bones;
    }

    public prepare(): void {/** do nothing */ }

    public _computeTransformMatrices(): void {/** do nothing */ }
}

export interface CreateMmdModelFromHumanoidOptions {
    boneMap?: { [key: string]: string };
    morphMap?: { [key: string]: string };
}

export class HumanoidMmd {
    private static readonly _StandardSkeletonMetaData = [
        ["全ての親", -1, 0, 31, null, null],
        ["センター", 0, 0, 30, null, null],
        ["グルーブ", 1, 0, 30, null, null],
        ["腰", 2, 0, 26, null, null],
        ["右足IK親", 0, 0, 31, null, null],
        ["右足ＩＫ", 4, 1, 62, null, {
            target: 67,
            iteration: 40,
            rotationConstraint: 2,
            links: [
                { target: 66, limitation: { minimumAngle: [-3.1415927410125732, 0, 0], maximumAngle: [-0.008726646192371845, 0, 0] } },
                { target: 65, limitation: undefined }
            ]
        }],
        ["右つま先ＩＫ", 5, 2, 62, null, { target: 72, iteration: 3, rotationConstraint: 4, links: [{ target: 67, limitation: undefined }] }],
        ["左足IK親", 0, 0, 31, null, null],
        ["左足ＩＫ", 7, 1, 62, null, {
            target: 71,
            iteration: 40,
            rotationConstraint: 2,
            links: [
                { target: 70, limitation: { minimumAngle: [-3.1415927410125732, 0, 0], maximumAngle: [-0.008726646192371845, 0, 0] } },
                { target: 69, limitation: undefined }
            ]
        }],
        ["左つま先ＩＫ", 8, 2, 62, null, { target: 73, iteration: 3, rotationConstraint: 4, links: [{ target: 71, limitation: undefined }] }],
        ["上半身", 3, 0, 27, null, null],
        ["上半身2", 10, 0, 27, null, null],
        ["下半身", 3, 0, 26, null, null],
        ["首", 11, 0, 27, null, null],
        ["頭", 13, 0, 26, null, null],
        ["右肩P", 11, 0, 26, null, null],
        ["右肩", 15, 0, 2075, null, null],
        ["右肩C", 16, 0, 274, { isLocal: false, affectRotation: true, affectPosition: false, parentIndex: 15, ratio: -1 }, null],
        ["右腕", 17, 0, 2075, null, null],
        ["右腕捩", 18, 0, 1050, null, null],
        ["右ひじ", 19, 0, 2075, null, null],
        ["右手捩", 20, 0, 1050, null, null],
        ["右手首", 21, 0, 2075, null, null],
        ["右親指０", 22, 0, 2079, null, null],
        ["右親指１", 23, 0, 2075, null, null],
        ["右親指２", 24, 0, 2075, null, null],
        ["右小指１", 22, 0, 2075, null, null],
        ["右小指２", 26, 0, 2075, null, null],
        ["右小指３", 27, 0, 2075, null, null],
        ["右薬指１", 22, 0, 2075, null, null],
        ["右薬指２", 29, 0, 2075, null, null],
        ["右薬指３", 30, 0, 2075, null, null],
        ["右中指１", 22, 0, 2075, null, null],
        ["右中指２", 32, 0, 2075, null, null],
        ["右中指３", 33, 0, 2075, null, null],
        ["右人指１", 22, 0, 2075, null, null],
        ["右人指２", 35, 0, 2075, null, null],
        ["右人指３", 36, 0, 2075, null, null],
        ["左肩P", 11, 0, 26, null, null],
        ["左肩", 38, 0, 2075, null, null],
        ["左肩C", 39, 0, 274, { isLocal: false, affectRotation: true, affectPosition: false, parentIndex: 38, ratio: -1 }, null],
        ["左腕", 40, 0, 2075, null, null],
        ["左腕捩", 41, 0, 1050, null, null],
        ["左ひじ", 42, 0, 2075, null, null],
        ["左手捩", 43, 0, 1050, null, null],
        ["左手首", 44, 0, 2075, null, null],
        ["左親指０", 45, 0, 2079, null, null],
        ["左親指１", 46, 0, 2075, null, null],
        ["左親指２", 47, 0, 2075, null, null],
        ["左小指１", 45, 0, 2075, null, null],
        ["左小指２", 49, 0, 2075, null, null],
        ["左小指３", 50, 0, 2075, null, null],
        ["左薬指１", 45, 0, 2075, null, null],
        ["左薬指２", 52, 0, 2075, null, null],
        ["左薬指３", 53, 0, 2075, null, null],
        ["左中指１", 45, 0, 2075, null, null],
        ["左中指２", 55, 0, 2075, null, null],
        ["左中指３", 56, 0, 2075, null, null],
        ["左人指１", 45, 0, 2075, null, null],
        ["左人指２", 58, 0, 2075, null, null],
        ["左人指３", 59, 0, 2075, null, null],
        ["右目", 14, 2, 2330, { isLocal: false, affectRotation: true, affectPosition: false, parentIndex: 63, ratio: 1 }, null],
        ["左目", 14, 2, 2330, { isLocal: false, affectRotation: true, affectPosition: false, parentIndex: 63, ratio: 1 }, null],
        ["両目", 14, 0, 2074, null, null],
        ["腰キャンセル右", 12, 0, 274, { isLocal: false, affectRotation: true, affectPosition: false, parentIndex: 3, ratio: -1 }, null],
        ["右足", 64, 0, 27, null, null],
        ["右ひざ", 65, 0, 27, null, null],
        ["右足首", 66, 0, 27, null, null],
        ["腰キャンセル左", 12, 0, 274, { isLocal: false, affectRotation: true, affectPosition: false, parentIndex: 3, ratio: -1 }, null],
        ["左足", 68, 0, 27, null, null],
        ["左ひざ", 69, 0, 27, null, null],
        ["左足首", 70, 0, 27, null, null],
        ["右つま先", 67, 2, 18, null, null],
        ["左つま先", 71, 2, 18, null, null],
        ["右足D", 64, 1, 283, { isLocal: false, affectRotation: true, affectPosition: false, parentIndex: 65, ratio: 1 }, null],
        ["右ひざD", 74, 1, 283, { isLocal: false, affectRotation: true, affectPosition: false, parentIndex: 66, ratio: 1 }, null],
        ["右足首D", 75, 2, 282, { isLocal: false, affectRotation: true, affectPosition: false, parentIndex: 67, ratio: 1 }, null],
        ["左足D", 68, 1, 283, { isLocal: false, affectRotation: true, affectPosition: false, parentIndex: 69, ratio: 1 }, null],
        ["左ひざD", 77, 1, 283, { isLocal: false, affectRotation: true, affectPosition: false, parentIndex: 70, ratio: 1 }, null],
        ["左足首D", 78, 2, 282, { isLocal: false, affectRotation: true, affectPosition: false, parentIndex: 71, ratio: 1 }, null],
        ["右足先EX", 76, 2, 26, null, null],
        ["左足先EX", 79, 2, 26, null, null]
    ] satisfies [
        MmdModelMetadata.Bone["name"],
        MmdModelMetadata.Bone["parentBoneIndex"],
        MmdModelMetadata.Bone["transformOrder"],
        MmdModelMetadata.Bone["flag"],
        Nullable<NonNullable<MmdModelMetadata.Bone["appendTransform"]>>,
        Nullable<NonNullable<MmdModelMetadata.Bone["ik"]>>
    ][];

    private readonly _standardSkeletonMetadataNameMap = new Map<string, number>();

    public constructor() {
        for (let i = 0; i < HumanoidMmd._StandardSkeletonMetaData.length; ++i) {
            const metadata = HumanoidMmd._StandardSkeletonMetaData[i];
            this._standardSkeletonMetadataNameMap.set(metadata[0], i);
        }
    }

    private _createMetadata(
        name: string,
        morphTargetManager: Nullable<MorphTargetManager>,
        morphMap: { [key: string]: string }
    ): MmdModelMetadata {
        const header: MmdModelMetadata.Header = {
            modelName: name,
            englishModelName: name,
            comment: "",
            englishComment: ""
        };

        const bones: MmdModelMetadata.Bone[] = [];
        const standardSkeletonMetadata = HumanoidMmd._StandardSkeletonMetaData;
        for (let i = 0; i < standardSkeletonMetadata.length; ++i) {
            const metadata = standardSkeletonMetadata[i];

            const ik = metadata[5];

            const bone: MmdModelMetadata.Bone = {
                name: metadata[0],
                parentBoneIndex: metadata[1],
                transformOrder: metadata[2],
                flag: metadata[3],
                appendTransform: metadata[4] !== null ? { ...metadata[4] } : undefined,
                transformAfterPhysics: false,
                ik: ik !== null ? {
                    target: ik.target,
                    iteration: ik.iteration,
                    rotationConstraint: ik.rotationConstraint,
                    links: ik.links.map(link => ({
                        target: link.target,
                        limitation: link.limitation !== undefined ? { ...link.limitation } : undefined
                    }))
                } : undefined
            };
            bones.push(bone);
        }

        const morphs: MmdModelMetadata.Morph[] = [];
        if (morphTargetManager !== null) {
            const numTargets = morphTargetManager.numTargets;
            for (let i = 0; i < numTargets; ++i) {
                const target = morphTargetManager.getTarget(i);
                const mappedName = morphMap[target.name] ?? target.name;
                const morph: MmdModelMetadata.Morph = {
                    name: mappedName,
                    englishName: mappedName,
                    category: PmxObject.Morph.Category.Eye,
                    type: PmxObject.Morph.Type.VertexMorph,
                    index: i
                };
                morphs.push(morph);
            }
        }

        return {
            isMmdModel: true,
            header,
            bones: bones,
            morphs: morphs,
            rigidBodies: [],
            joints: []
        };
    }

    private _copyBonePosition(source: string, target: string, boneProxyMap: Map<string, LinkedBoneProxy>): Nullable<LinkedBoneProxy> {
        const sourceBoneProxy = boneProxyMap.get(source);
        const targetBoneProxy = boneProxyMap.get(target);
        if (sourceBoneProxy === undefined || targetBoneProxy === undefined) {
            return null;
        }

        targetBoneProxy.position.copyFrom(sourceBoneProxy.position);
        return targetBoneProxy;
    }

    private _getAverageBonePosition(sourceNames: string[], boneProxyMap: Map<string, LinkedBoneProxy>): Nullable<Vector3> {
        const averagePosition = Vector3.Zero();
        for (let i = 0; i < sourceNames.length; ++i) {
            const sourceBoneProxy = boneProxyMap.get(sourceNames[i]);
            if (sourceBoneProxy === undefined) return null;

            averagePosition.addInPlace(sourceBoneProxy.position);
        }
        return averagePosition.scaleInPlace(1 / sourceNames.length);
    }

    private _buildBoneProxyTree(
        skeleton: Skeleton,
        boneMap: { [key: string]: string },
        bonesMetadata: readonly MmdModelMetadata.Bone[]
    ): LinkedBoneProxy[] {
        const bones = skeleton.bones;
        const boneMappedNameMap = new Map<string, Bone>();
        for (let i = 0; i < bones.length; ++i) {
            const bone = bones[i];
            const mappedName = boneMap[bone.name];
            if (mappedName !== undefined) boneMappedNameMap.set(mappedName, bone);
        }

        skeleton.prepare();

        const boneProxies: LinkedBoneProxy[] = [];
        const boneProxyMap = new Map<string, LinkedBoneProxy>();
        for (let i = 0; i < bonesMetadata.length; ++i) {
            const boneMetadata = bonesMetadata[i];
            const bone = boneMappedNameMap.get(boneMetadata.name) ?? null;

            const boneProxy = new LinkedBoneProxy(boneMetadata.name, bone);
            if (bone !== null) {
                const bonePosition = bone.getFinalMatrix().getTranslation();
                boneProxy.position.copyFrom(bonePosition);
            }

            boneProxies.push(boneProxy);
            boneProxyMap.set(boneMetadata.name, boneProxy);
        }

        for (let i = 0; i < bonesMetadata.length; ++i) {
            const boneMetadata = bonesMetadata[i];
            const boneProxy = boneProxies[i];

            const parentIndex = boneMetadata.parentBoneIndex;
            if (parentIndex !== -1) {
                const parentBoneProxy = boneProxies[parentIndex];
                boneProxy.parent = parentBoneProxy;
                parentBoneProxy.children.push(boneProxy);
            }
        }

        // initialize bone positions
        if (!boneMappedNameMap.has("全ての親")) {
            boneProxyMap.get("全ての親")!.position.y = 0.1;
        }
        {
            const hasCenter = boneMappedNameMap.has("センター");
            const hasGroove = boneMappedNameMap.has("グルーブ");
            if (!hasCenter && !hasGroove) {
                const position = this._getAverageBonePosition(["左足", "左ひざ", "右足", "右ひざ"], boneProxyMap);
                if (position !== null) {
                    boneProxyMap.get("センター")!.position.copyFrom(position);
                    boneProxyMap.get("グルーブ")!.position.copyFrom(position);
                }
            } else if (!hasCenter) {
                this._copyBonePosition("グルーブ", "センター", boneProxyMap);
            } else if (!hasGroove) {
                this._copyBonePosition("センター", "グルーブ", boneProxyMap);
            }
        }
        {
            const hasUpperBody = boneMappedNameMap.has("上半身");
            const hasLowerBody = boneMappedNameMap.has("下半身");
            const hasWaist = boneMappedNameMap.has("腰");
            if (!hasUpperBody && !hasLowerBody && !hasWaist) {
                const position = this._getAverageBonePosition(["左足", "左足", "右足", "右足", "首"], boneProxyMap);
                if (position !== null) {
                    boneProxyMap.get("上半身")!.position.copyFrom(position);
                    boneProxyMap.get("下半身")!.position.copyFrom(position);
                }
            } else if (!hasUpperBody) {
                this._copyBonePosition(hasLowerBody ? "下半身" : "腰", "上半身", boneProxyMap);
            } else if (!hasLowerBody) {
                this._copyBonePosition(hasUpperBody ? "上半身" : "腰", "下半身", boneProxyMap);
            } else if (!hasWaist) {
                this._copyBonePosition(hasLowerBody ? "下半身" : "上半身", "腰", boneProxyMap);
            }
        }

        if (!boneMappedNameMap.has("右肩P")) {
            this._copyBonePosition("右肩", "右肩P", boneProxyMap);
        }
        if (!boneMappedNameMap.has("左肩P")) {
            this._copyBonePosition("左肩", "左肩P", boneProxyMap);
        }

        // ik
        if (!boneMappedNameMap.has("右足ＩＫ")) {
            this._copyBonePosition("右足首", "右足ＩＫ", boneProxyMap);
        }
        if (!boneMappedNameMap.has("左足ＩＫ")) {
            this._copyBonePosition("左足首", "左足ＩＫ", boneProxyMap);
        }
        if (!boneMappedNameMap.has("右足IK親")) {
            const targetBone = this._copyBonePosition("右足首", "右足IK親", boneProxyMap);
            if (targetBone !== null) targetBone.position.y = 0.1;
        }
        if (!boneMappedNameMap.has("左足IK親")) {
            const targetBone = this._copyBonePosition("左足首", "左足IK親", boneProxyMap);
            if (targetBone !== null) targetBone.position.y = 0.1;
        }
        if (!boneMappedNameMap.has("右つま先ＩＫ")) {
            this._copyBonePosition("左つま先", "右つま先ＩＫ", boneProxyMap);
        }
        if (!boneMappedNameMap.has("左つま先ＩＫ")) {
            this._copyBonePosition("右つま先", "左つま先ＩＫ", boneProxyMap);
        }


        for (let i = 0; i < boneProxies.length; ++i) {
            const boneProxy = boneProxies[i];
            const worldPosition = boneProxy.position;
            const sphere = CreateSphere("sphere", { diameter: 0.1 }, skeleton.getScene());
            sphere.position.copyFrom(worldPosition).scaleInPlace(10);
            sphere.position.z = -sphere.position.z;
            if (sphere.position.x === 0 && sphere.position.y === 0 && sphere.position.z === 0) {
                console.log(boneProxy.name);
            }
            const material = sphere.material = new StandardMaterial("material", skeleton.getScene());
            material.zOffset = -10000;
        }

        // world to local
        const worldPositions = new Map<LinkedBoneProxy, Vector3>();
        for (let i = 0; i < boneProxies.length; ++i) {
            worldPositions.set(boneProxies[i], boneProxies[i].position.clone());
        }
        for (let i = 0; i < boneProxies.length; ++i) {
            const boneProxy = boneProxies[i];
            const parent = boneProxy.parent;
            if (parent !== null) {
                const parentPosition = worldPositions.get(parent)!;
                boneProxy.position.subtractInPlace(parentPosition);
            }
        }

        return boneProxies;
    }

    public createMmdModelFromHumanoid(mmdRuntime: MmdRuntime, humanoidMesh: Mesh, options: CreateMmdModelFromHumanoidOptions = {}): MmdModel {
        const {
            boneMap = {},
            morphMap = {}
        } = options;

        const skeleton = humanoidMesh.skeleton;
        if (skeleton === null) throw new Error("Skeleton not found.");

        const metadata = this._createMetadata(humanoidMesh.name, humanoidMesh.morphTargetManager, morphMap);
        humanoidMesh.metadata = metadata;

        if (!HumanoidMesh.isHumanoidMesh(humanoidMesh)) throw new Error("Mesh validation failed.");

        const boneProxies = this._buildBoneProxyTree(skeleton, boneMap, metadata.bones);
        const mmdModel = new MmdModel(humanoidMesh, new BoneContainer(boneProxies), null, null, mmdRuntime);
        mmdRuntime.addMmdModelInternal(mmdModel);
        return mmdModel;
    }
}
