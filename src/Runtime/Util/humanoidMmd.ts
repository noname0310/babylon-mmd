import type { Bone } from "@babylonjs/core/Bones/bone";
import type { Skeleton } from "@babylonjs/core/Bones/skeleton";
// import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Quaternion, Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Matrix } from "@babylonjs/core/Maths/math.vector";
// import { CreateBox } from "@babylonjs/core/Meshes/Builders/boxBuilder";
import type { Mesh } from "@babylonjs/core/Meshes/mesh";
import type { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import type { MorphTargetManager } from "@babylonjs/core/Morph/morphTargetManager";
import type { Nullable } from "@babylonjs/core/types";

import type { MmdModelMetadata } from "@/Loader/mmdModelMetadata";
import { PmxObject } from "@/Loader/Parser/pmxObject";

import type { ILogger } from "../ILogger";
import type { IMmdModel } from "../IMmdModel";
import type { IMmdRuntime } from "../IMmdRuntime";
import type { IMmdLinkedBoneContainer, IMmdRuntimeLinkedBone } from "../IMmdRuntimeLinkedBone";
import { HumanoidMesh } from "../mmdMesh";

class LinkedBoneProxy implements IMmdRuntimeLinkedBone {
    public name: string;

    public get position(): Vector3 {
        return this._position;
    }

    public set position(value: Vector3) {
        this._position.copyFrom(value);
    }

    public get rotationQuaternion(): Quaternion {
        return this._rotationQuaternion;
    }

    public set rotationQuaternion(value: Quaternion) {
        this._rotationQuaternion.copyFrom(value);
    }

    public get scaling(): Vector3 {
        return this._scaling;
    }

    public set scaling(value: Vector3) {
        this._scaling.copyFrom(value);
    }

    public readonly _position: Vector3;
    public readonly _rotationQuaternion: Quaternion;
    public readonly _scaling: Vector3;

    public parent: Nullable<LinkedBoneProxy>;
    public readonly children: LinkedBoneProxy[];

    public readonly bone: Nullable<Bone>;
    private readonly _boneWorldRestRotationMatrix: Nullable<Matrix>;
    private readonly _boneFinalMatrix: Nullable<Matrix>;
    private readonly _boneFinalMatrixInverse: Nullable<Matrix>;
    private _boneParent: Nullable<LinkedBoneProxy>;

    private readonly _restMatrix: Matrix;
    private readonly _finalMatrix: Matrix;

    private readonly _positionApplyScale: Vector3;
    private readonly _scalingMatrix: Matrix;

    // private readonly _debugSphere: Nullable<Mesh>;

    public constructor(name: string, bone: Nullable<Bone>, positionApplyScale: Vector3, scalingMatrix: Matrix) {
        this.name = name;

        this._position = Vector3.Zero();
        this._rotationQuaternion = Quaternion.Identity();
        this._scaling = Vector3.One();

        this.parent = null;
        this.children = [];

        this.bone = bone;
        this._boneWorldRestRotationMatrix = bone !== null ? bone.getFinalMatrix().getRotationMatrix() : null;
        this._boneFinalMatrix = bone !== null ? Matrix.Identity() : null;
        this._boneFinalMatrixInverse = bone !== null ? Matrix.Identity() : null;
        this._boneParent = null;

        this._restMatrix = Matrix.Identity();
        this._finalMatrix = Matrix.Identity();

        this._positionApplyScale = positionApplyScale;
        this._scalingMatrix = scalingMatrix;

        // this._debugSphere = null;
    }

    public getRestMatrix(): Matrix {
        return this._restMatrix;
    }

    public getFinalMatrix(): Matrix {
        return this._finalMatrix;
    }

    public setRotationQuaternion(quat: Quaternion): void {
        this._rotationQuaternion.copyFrom(quat);
    }

    public updateBoneParent(): void {
        let parent = this.parent;
        if (parent !== null) {
            while (parent.bone === null) {
                parent = parent.parent;
                if (parent === null) break;
            }
        }
        this._boneParent = parent;
    }

    public computeBoneFinalMatrix(upperBodyBone: LinkedBoneProxy): void {
        const boneFinalMatrix = this._boneFinalMatrix!;

        // special case for center bone for fix difference between MMD and Humanoid bone hierarchy
        if (this.name === "センター") {
            boneFinalMatrix.copyFrom(upperBodyBone._finalMatrix!);
        } else boneFinalMatrix.copyFrom(this._finalMatrix);

        this._scalingMatrix.multiplyToRef(boneFinalMatrix, boneFinalMatrix);
        boneFinalMatrix.multiplyToRef(this._scalingMatrix, boneFinalMatrix);
        const positionApplyScale = this._positionApplyScale;
        boneFinalMatrix.setTranslationFromFloats(
            boneFinalMatrix.m[12] * positionApplyScale.x,
            boneFinalMatrix.m[13] * positionApplyScale.y,
            boneFinalMatrix.m[14] * positionApplyScale.z
        );

        this._boneWorldRestRotationMatrix!.multiplyToRef(boneFinalMatrix, boneFinalMatrix);

        // if (this._debugSphere === null) {
        //     this._debugSphere = CreateBox("sphere" + this.name, { size: 0.5 });
        //     const material = this._debugSphere.material = new StandardMaterial("material");
        //     material.zOffset = -10000;
        //     this._debugSphere.rotationQuaternion = Quaternion.Identity();
        // }

        // const debugSphere = this._debugSphere;
        // boneFinalMatrix.decompose(debugSphere.scaling, debugSphere.rotationQuaternion!, debugSphere.position);
        // debugSphere.position = debugSphere.position.set(
        //     this.position.x / positionApplyScale.x,
        //     this.position.y / positionApplyScale.y,
        //     this.position.z / positionApplyScale.z
        // );

        this._boneFinalMatrixInverse!.copyFrom(boneFinalMatrix).invert();
    }

    private static readonly _BoneLocalMatrix = new Matrix();

    public apply(): void {
        const parent = this._boneParent;

        const boneLocalMatrix = LinkedBoneProxy._BoneLocalMatrix.copyFrom(this._boneFinalMatrix!);
        if (parent !== null) boneLocalMatrix.multiplyToRef(parent._boneFinalMatrixInverse!, boneLocalMatrix);

        this.bone!._matrix = boneLocalMatrix;
    }
}

class BoneContainer implements IMmdLinkedBoneContainer {
    public bones: LinkedBoneProxy[];
    private readonly _upperBodyBone: LinkedBoneProxy;

    private readonly _skeleton: Skeleton;

    public constructor(bones: LinkedBoneProxy[], skeleton: Skeleton) {
        this.bones = bones;

        let upperBodyBone: LinkedBoneProxy | null = null;
        for (let i = 0; i < bones.length; ++i) {
            const boneProxy = bones[i];
            if (boneProxy.name === "上半身") {
                upperBodyBone = boneProxy;
                break;
            }
        }
        this._upperBodyBone = upperBodyBone!;

        this._skeleton = skeleton;
    }

    public prepare(): void {/** do nothing */ }

    public get _computeTransformMatrices(): any {
        return true;
    }

    public set _computeTransformMatrices(value: any) {
        if (value === true) { // restore matrix update policy
            this._skeleton.onBeforeComputeObservable.removeCallback(this._onBeforeCompute);

            const bones = this._skeleton.bones;
            let numBonesWithLinkedTransformNode = 0;
            for (let i = 0; i < bones.length; ++i) {
                if (bones[i]._linkedTransformNode !== null) numBonesWithLinkedTransformNode += 1;
            }
            this._skeleton._numBonesWithLinkedTransformNode = numBonesWithLinkedTransformNode; // restore sync with linked transform node
        } else { // override matrix update policy
            this._skeleton.onBeforeComputeObservable.add(this._onBeforeCompute);

            this._skeleton._numBonesWithLinkedTransformNode = 0; // force disable sync with linked transform node
        }
    }

    private readonly _onBeforeCompute = (): void => {
        const proxies = this.bones;

        const upperBodyBone = this._upperBodyBone;
        for (let i = 0; i < proxies.length; ++i) {
            if (proxies[i].bone !== null) proxies[i].computeBoneFinalMatrix(upperBodyBone);
        }

        for (let i = 0; i < proxies.length; ++i) {
            if (proxies[i].bone !== null) proxies[i].apply();
        }
    };
}

/**
 * Options for creating MMD model from humanoid
 */
export interface CreateMmdModelFromHumanoidOptions {
    /**
     * Humanoid bone name to MMD bone name map (default: {})
     *
     * Usually created by `MmdHumanoidMapper`
     *
     * Bones where the map is not defined will be ignored
     */
    boneMap?: { [key: string]: string };

    /**
     * Humanoid morph name to MMD morph name map (default: {})
     *
     * Morphs where the map is not defined will be mapped to the same name
     */
    morphMap?: { [key: string]: string };

    /**
     * Transform offset for match skeleton space (default: Matrix.Identity())
     */
    transformOffset?: TransformNode | Matrix;
}

/**
 * Virtualizes the humanoid model as MMD model
 */
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
        ["右肩C", 16, 0, 274, { parentIndex: 15, ratio: -1 }, null],
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
        ["左肩C", 39, 0, 274, { parentIndex: 38, ratio: -1 }, null],
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
        ["右目", 14, 2, 2330, { parentIndex: 63, ratio: 1 }, null],
        ["左目", 14, 2, 2330, { parentIndex: 63, ratio: 1 }, null],
        ["両目", 14, 0, 2074, null, null],
        ["腰キャンセル右", 12, 0, 274, { parentIndex: 3, ratio: -1 }, null],
        ["右足", 64, 0, 27, null, null],
        ["右ひざ", 65, 0, 27, null, null],
        ["右足首", 66, 0, 27, null, null],
        ["腰キャンセル左", 12, 0, 274, { parentIndex: 3, ratio: -1 }, null],
        ["左足", 68, 0, 27, null, null],
        ["左ひざ", 69, 0, 27, null, null],
        ["左足首", 70, 0, 27, null, null],
        ["右つま先", 67, 2, 18, null, null],
        ["左つま先", 71, 2, 18, null, null],
        ["右足D", 64, 1, 283, { parentIndex: 65, ratio: 1 }, null],
        ["右ひざD", 74, 1, 283, { parentIndex: 66, ratio: 1 }, null],
        ["右足首D", 75, 2, 282, { parentIndex: 67, ratio: 1 }, null],
        ["左足D", 68, 1, 283, { parentIndex: 69, ratio: 1 }, null],
        ["左ひざD", 77, 1, 283, { parentIndex: 70, ratio: 1 }, null],
        ["左足首D", 78, 2, 282, { parentIndex: 71, ratio: 1 }, null],
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

    private _removeScaleFromOffsetMatrix(matrix: Matrix): Vector3 {
        const scale = new Vector3();
        matrix.decompose(scale);

        scale.x = Math.abs(scale.x);
        scale.y = Math.abs(scale.y);
        scale.z = Math.abs(scale.z);

        const m = matrix.m;
        matrix.setRowFromFloats(0, m[0] / scale.x, m[1] / scale.x, m[2] / scale.x, m[3]);
        matrix.setRowFromFloats(1, m[4] / scale.y, m[5] / scale.y, m[6] / scale.y, m[7]);
        matrix.setRowFromFloats(2, m[8] / scale.z, m[9] / scale.z, m[10] / scale.z, m[11]);
        return scale;
    }

    private _copyBonePosition(source: string, target: string, boneProxyMap: Map<string, LinkedBoneProxy>): Nullable<LinkedBoneProxy> {
        const sourceBoneProxy = boneProxyMap.get(source);
        const targetBoneProxy = boneProxyMap.get(target);
        if (sourceBoneProxy === undefined || targetBoneProxy === undefined) {
            return null;
        }

        targetBoneProxy._position.copyFrom(sourceBoneProxy._position);
        return targetBoneProxy;
    }

    private _getAverageBonePosition(sourceNames: string[], boneProxyMap: Map<string, LinkedBoneProxy>): Nullable<Vector3> {
        const averagePosition = Vector3.Zero();
        for (let i = 0; i < sourceNames.length; ++i) {
            const sourceBoneProxy = boneProxyMap.get(sourceNames[i]);
            if (sourceBoneProxy === undefined) return null;

            averagePosition.addInPlace(sourceBoneProxy._position);
        }
        return averagePosition.scaleInPlace(1 / sourceNames.length);
    }

    private _buildBoneProxyTree(
        skeleton: Skeleton,
        boneMap: { [key: string]: string },
        bonesMetadata: readonly MmdModelMetadata.Bone[],
        transformOffset: Matrix,
        logger: ILogger
    ): LinkedBoneProxy[] {
        const normalizedTransformOffset = transformOffset.clone();
        const scale = this._removeScaleFromOffsetMatrix(normalizedTransformOffset);
        const invScale = new Vector3(1 / scale.x, 1 / scale.y, 1 / scale.z);

        const bones = skeleton.bones;
        const positionInitializedProxies = new Set<string>();
        const boneMappedNameMap = new Map<string, Bone>();
        for (let i = 0; i < bones.length; ++i) {
            const bone = bones[i];
            const mappedName = boneMap[bone.name];
            if (mappedName !== undefined) boneMappedNameMap.set(mappedName, bone);
        }

        skeleton.prepare(true);

        const boneProxies: LinkedBoneProxy[] = [];
        const boneProxyMap = new Map<string, LinkedBoneProxy>();
        for (let i = 0; i < bonesMetadata.length; ++i) {
            const boneMetadata = bonesMetadata[i];
            const bone = boneMappedNameMap.get(boneMetadata.name) ?? null;

            const boneProxy = new LinkedBoneProxy(
                boneMetadata.name,
                bone,
                invScale,
                normalizedTransformOffset
            );

            if (bone !== null) {
                const bonePosition = bone.getFinalMatrix().getTranslation();
                boneProxy._position.copyFrom(bonePosition);
                positionInitializedProxies.add(boneProxy.name);
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

        // root
        if (!positionInitializedProxies.has("全ての親")) {
            boneProxyMap.get("全ての親")!._position.y = 0.1 * invScale.y;
            positionInitializedProxies.add("全ての親");
        }

        // center control
        {
            const hasCenter = positionInitializedProxies.has("センター");
            const hasGroove = positionInitializedProxies.has("グルーブ");
            if (!hasCenter && !hasGroove) {
                const position = this._getAverageBonePosition(["左足", "左ひざ", "右足", "右ひざ"], boneProxyMap);
                if (position !== null) {
                    boneProxyMap.get("センター")!._position.copyFrom(position);
                    boneProxyMap.get("グルーブ")!._position.copyFrom(position);
                    positionInitializedProxies.add("センター");
                    positionInitializedProxies.add("グルーブ");
                }
            } else if (!hasCenter) {
                const result = this._copyBonePosition("グルーブ", "センター", boneProxyMap);
                if (result !== null) positionInitializedProxies.add("センター");
            } else if (!hasGroove) {
                const result = this._copyBonePosition("センター", "グルーブ", boneProxyMap);
                if (result !== null) positionInitializedProxies.add("グルーブ");
            }
        }
        {
            const hasUpperBody = positionInitializedProxies.has("上半身");
            const hasLowerBody = positionInitializedProxies.has("下半身");
            const hasWaist = positionInitializedProxies.has("腰");
            if (!hasUpperBody && !hasLowerBody && !hasWaist) {
                const position = this._getAverageBonePosition(["左足", "左足", "右足", "右足", "首"], boneProxyMap);
                if (position !== null) {
                    boneProxyMap.get("上半身")!._position.copyFrom(position);
                    boneProxyMap.get("下半身")!._position.copyFrom(position);
                    boneProxyMap.get("腰")!._position.copyFrom(position);
                    positionInitializedProxies.add("上半身");
                    positionInitializedProxies.add("下半身");
                    positionInitializedProxies.add("腰");
                }
            } else if (!hasUpperBody) {
                const result = this._copyBonePosition(hasLowerBody ? "下半身" : "腰", "上半身", boneProxyMap);
                if (result !== null) positionInitializedProxies.add("上半身");
            } else if (!hasLowerBody) {
                const result = this._copyBonePosition(hasUpperBody ? "上半身" : "腰", "下半身", boneProxyMap);
                if (result !== null) positionInitializedProxies.add("下半身");
            }
            if (!hasWaist) {
                const result = this._copyBonePosition(hasLowerBody ? "下半身" : "上半身", "腰", boneProxyMap);
                if (result !== null) positionInitializedProxies.add("腰");
            }
        }

        // eye control
        if (!positionInitializedProxies.has("両目")) {
            const position = this._getAverageBonePosition(["右目", "左目"], boneProxyMap);
            if (position !== null) {
                const bothEyes = boneProxyMap.get("両目")!;
                bothEyes._position.copyFrom(position);

                const headPosition = boneProxyMap.get("頭")!._position;
                const yDiff = headPosition.y - bothEyes._position.y;
                bothEyes._position.y -= yDiff * 2;

                positionInitializedProxies.add("両目");
            }
        }

        // shoulder support
        if (!positionInitializedProxies.has("右肩P")) {
            const result = this._copyBonePosition("右肩", "右肩P", boneProxyMap);
            if (result !== null) positionInitializedProxies.add("右肩P");
        }
        if (!positionInitializedProxies.has("右肩C")) {
            const result = this._copyBonePosition("右腕", "右肩C", boneProxyMap);
            if (result !== null) positionInitializedProxies.add("右肩C");
        }

        if (!positionInitializedProxies.has("左肩P")) {
            const result = this._copyBonePosition("左肩", "左肩P", boneProxyMap);
            if (result !== null) positionInitializedProxies.add("左肩P");
        }
        if (!positionInitializedProxies.has("左肩C")) {
            const result = this._copyBonePosition("左腕", "左肩C", boneProxyMap);
            if (result !== null) positionInitializedProxies.add("左肩C");
        }

        // arm support
        if (!positionInitializedProxies.has("右腕捩")) {
            const position = this._getAverageBonePosition(["右腕", "右ひじ"], boneProxyMap);
            if (position !== null) {
                boneProxyMap.get("右腕捩")!._position.copyFrom(position);
                positionInitializedProxies.add("右腕捩");
            }
        }
        if (!positionInitializedProxies.has("右手捩")) {
            const position = this._getAverageBonePosition(["右ひじ", "右手首"], boneProxyMap);
            if (position !== null) {
                boneProxyMap.get("右手捩")!._position.copyFrom(position);
                positionInitializedProxies.add("右手捩");
            }
        }

        if (!positionInitializedProxies.has("左腕捩")) {
            const position = this._getAverageBonePosition(["左腕", "左ひじ"], boneProxyMap);
            if (position !== null) {
                boneProxyMap.get("左腕捩")!._position.copyFrom(position);
                positionInitializedProxies.add("左腕捩");
            }
        }
        if (!positionInitializedProxies.has("左手捩")) {
            const position = this._getAverageBonePosition(["左ひじ", "左手首"], boneProxyMap);
            if (position !== null) {
                boneProxyMap.get("左手捩")!._position.copyFrom(position);
                positionInitializedProxies.add("左手捩");
            }
        }

        // leg rotation support
        if (!positionInitializedProxies.has("腰キャンセル右")) {
            const result = this._copyBonePosition("右足", "腰キャンセル右", boneProxyMap);
            if (result !== null) positionInitializedProxies.add("腰キャンセル右");
        }
        if (!positionInitializedProxies.has("腰キャンセル左")) {
            const result = this._copyBonePosition("左足", "腰キャンセル左", boneProxyMap);
            if (result !== null) positionInitializedProxies.add("腰キャンセル左");
        }

        // ik
        if (!positionInitializedProxies.has("右足ＩＫ")) {
            const result = this._copyBonePosition("右足首", "右足ＩＫ", boneProxyMap);
            if (result !== null) positionInitializedProxies.add("右足ＩＫ");
        }
        if (!positionInitializedProxies.has("右足IK親")) {
            const targetBone = this._copyBonePosition("右足首", "右足IK親", boneProxyMap);
            if (targetBone !== null) {
                targetBone._position.y = 0.1 * invScale.y;
                positionInitializedProxies.add("右足IK親");
            }
        }
        if (!positionInitializedProxies.has("右つま先ＩＫ")) {
            const result = this._copyBonePosition("右つま先", "右つま先ＩＫ", boneProxyMap);
            if (result !== null) positionInitializedProxies.add("右つま先ＩＫ");
        }

        if (!positionInitializedProxies.has("左足ＩＫ")) {
            const result = this._copyBonePosition("左足首", "左足ＩＫ", boneProxyMap);
            if (result !== null) positionInitializedProxies.add("左足ＩＫ");
        }
        if (!positionInitializedProxies.has("左足IK親")) {
            const targetBone = this._copyBonePosition("左足首", "左足IK親", boneProxyMap);
            if (targetBone !== null) {
                targetBone._position.y = 0.1 * invScale.y;
                positionInitializedProxies.add("左足IK親");
            }
        }
        if (!positionInitializedProxies.has("左つま先ＩＫ")) {
            const result = this._copyBonePosition("左つま先", "左つま先ＩＫ", boneProxyMap);
            if (result !== null) positionInitializedProxies.add("左つま先ＩＫ");
        }

        // ik additional transform controls
        if (!positionInitializedProxies.has("右足D")) {
            const result = this._copyBonePosition("右足", "右足D", boneProxyMap);
            if (result !== null) positionInitializedProxies.add("右足D");
        }
        if (!positionInitializedProxies.has("右ひざD")) {
            const result = this._copyBonePosition("右ひざ", "右ひざD", boneProxyMap);
            if (result !== null) positionInitializedProxies.add("右ひざD");
        }
        if (!positionInitializedProxies.has("右足首D")) {
            const result = this._copyBonePosition("右足首", "右足首D", boneProxyMap);
            if (result !== null) positionInitializedProxies.add("右足首D");
        }
        if (!positionInitializedProxies.has("右足先EX")) {
            const result = this._copyBonePosition("右つま先", "右足先EX", boneProxyMap);
            if (result !== null) positionInitializedProxies.add("右足先EX");
        }

        if (!positionInitializedProxies.has("左足D")) {
            const result = this._copyBonePosition("左足", "左足D", boneProxyMap);
            if (result !== null) positionInitializedProxies.add("左足D");
        }
        if (!positionInitializedProxies.has("左ひざD")) {
            const result = this._copyBonePosition("左ひざ", "左ひざD", boneProxyMap);
            if (result !== null) positionInitializedProxies.add("左ひざD");
        }
        if (!positionInitializedProxies.has("左足首D")) {
            const result = this._copyBonePosition("左足首", "左足首D", boneProxyMap);
            if (result !== null) positionInitializedProxies.add("左足首D");
        }
        if (!positionInitializedProxies.has("左足先EX")) {
            const result = this._copyBonePosition("左つま先", "左足先EX", boneProxyMap);
            if (result !== null) positionInitializedProxies.add("左足先EX");
        }

        for (let i = 0; i < boneProxies.length; ++i) {
            const boneProxy = boneProxies[i];
            boneProxy._position.multiplyInPlace(scale);
            Vector3.TransformCoordinatesToRef(boneProxy._position, normalizedTransformOffset, boneProxy._position);
        }

        // force initialize bone positions
        let positionUninitializedProxyCount = boneProxies.length - positionInitializedProxies.size;
        while (0 < positionUninitializedProxyCount) {
            for (let i = 0; i < boneProxies.length; ++i) {
                const boneProxy = boneProxies[i];
                if (positionInitializedProxies.has(boneProxy.name)) continue;

                const parent = boneProxy.parent;
                if (parent !== null && positionInitializedProxies.has(parent.name)) {
                    boneProxy._position.copyFrom(parent._position);
                    positionInitializedProxies.add(boneProxy.name);
                    positionUninitializedProxyCount -= 1;
                    logger.warn(`Bone position of ${boneProxy.name} is not initialized. Use parent bone position instead. Animation may not work correctly.`);
                }
            }
        }

        // world to local / initialize bone parent
        const worldPositions = new Map<LinkedBoneProxy, Vector3>();
        for (let i = 0; i < boneProxies.length; ++i) {
            worldPositions.set(boneProxies[i], boneProxies[i]._position.clone());
        }
        for (let i = 0; i < boneProxies.length; ++i) {
            const boneProxy = boneProxies[i];
            const parent = boneProxy.parent;
            if (parent !== null) {
                const parentPosition = worldPositions.get(parent)!;
                boneProxy._position.subtractInPlace(parentPosition);
            }
            boneProxy.getRestMatrix().setTranslation(boneProxy._position);

            boneProxy.updateBoneParent();
        }

        return boneProxies;
    }

    /**
     * Force Create MMD model from humanoid mesh
     * @param mmdRuntime MMD runtime
     * @param humanoidMesh Humanoid mesh
     * @param options Options
     * @returns MMD model created from humanoid mesh
     */
    public createMmdModelFromHumanoid<T extends IMmdModel>(
        mmdRuntime: IMmdRuntime<T>,
        humanoidMesh: Mesh,
        options: CreateMmdModelFromHumanoidOptions = {}
    ): T {
        const {
            boneMap = {},
            morphMap = {},
            transformOffset = Matrix.Identity()
        } = options;

        const skeleton = humanoidMesh.skeleton;
        if (skeleton === null) throw new Error("Skeleton not found.");

        const metadata = this._createMetadata(humanoidMesh.name, humanoidMesh.morphTargetManager, morphMap);
        humanoidMesh.metadata = metadata;

        if (!HumanoidMesh.isHumanoidMesh(humanoidMesh)) throw new Error("Mesh validation failed.");

        let transformOffsetMatrix: Matrix;
        if ((transformOffset as TransformNode).getWorldMatrix !== undefined) {
            transformOffsetMatrix = (transformOffset as TransformNode).computeWorldMatrix(true).clone();
        } else {
            transformOffsetMatrix = (transformOffset as Matrix).clone();
        }

        const boneProxies = this._buildBoneProxyTree(skeleton, boneMap, metadata.bones, transformOffsetMatrix, mmdRuntime);
        return mmdRuntime.createMmdModelFromSkeleton(humanoidMesh, new BoneContainer(boneProxies, skeleton), {
            materialProxyConstructor: null,
            buildPhysics: false
        });
    }
}
