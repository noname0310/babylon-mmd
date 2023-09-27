import type { Bone } from "@babylonjs/core/Bones/bone";
import type { Skeleton } from "@babylonjs/core/Bones/skeleton";
import type { Quaternion, Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Matrix } from "@babylonjs/core/Maths/math.vector";
import type { Mesh } from "@babylonjs/core/Meshes/mesh";
import type { MorphTargetManager } from "@babylonjs/core/Morph/morphTargetManager";
import type { Nullable } from "@babylonjs/core/types";

import type { MmdModelMetadata } from "@/Loader/mmdModelMetadata";

import type { IMmdLinkedBoneContainer, IMmdRuntimeLinkedBone } from "../IMmdRuntimeLinkedBone";
import { HumanoidMesh } from "../mmdMesh";
import { MmdModel } from "../mmdModel";
import type { MmdRuntime } from "../mmdRuntime";

class LinkedBoneProxy implements IMmdRuntimeLinkedBone {
    private readonly _bone: Bone;
    private readonly _restMatrix: Matrix;
    private readonly _finalMatrix: Matrix;

    public position: Vector3;
    public rotationQuaternion: Quaternion;
    public scaling: Vector3;

    public parent: Nullable<LinkedBoneProxy>;
    public readonly children: LinkedBoneProxy[];

    public constructor(bone: Bone) {
        this._bone = bone;
        this._restMatrix = bone.getRestMatrix();
        this._finalMatrix = new Matrix();

        this.position = bone.position;
        this.rotationQuaternion = bone.rotationQuaternion;
        this.scaling = bone.scaling;

        this.parent = null;
        this.children = [];
    }

    public getRestMatrix(): Matrix {
        return this._restMatrix;
    }

    public getFinalMatrix(): Matrix {
        return this._finalMatrix;
    }

    public apply(): void {
        this._bone;
    }
}

class BoneContainer implements IMmdLinkedBoneContainer {
    public bones: IMmdRuntimeLinkedBone[];

    public constructor(bones: IMmdRuntimeLinkedBone[]) {
        this.bones = bones;
    }

    public prepare(): void {/** do nothing */ }
}

LinkedBoneProxy;
BoneContainer;

export class HumanoidMmd {
    private _createMetadata(
        name: string,
        skeleton: Skeleton,
        morphTargetManager: Nullable<MorphTargetManager>
    ): MmdModelMetadata {
        name;
        skeleton;
        morphTargetManager;
        throw new Error("Not implemented.");
    }

    public createMmdModelFromHumanoid(mmdRuntime: MmdRuntime, humanoidMesh: Mesh): MmdModel {
        const skeleton = humanoidMesh.skeleton;
        if (skeleton === null) throw new Error("Skeleton not found.");

        const metadata = this._createMetadata(humanoidMesh.name, skeleton, humanoidMesh.morphTargetManager);
        humanoidMesh.metadata = metadata;

        if (!HumanoidMesh.isHumanoidMesh(humanoidMesh)) throw new Error("Mesh validation failed.");

        return new MmdModel(humanoidMesh, new BoneContainer([]), null, null, mmdRuntime);
    }
}
