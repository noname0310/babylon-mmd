import type { Skeleton } from "@babylonjs/core/Bones/skeleton";
import { VertexBuffer } from "@babylonjs/core/Buffers/buffer";
import type { Material } from "@babylonjs/core/Materials/material";
import { Matrix, Quaternion, Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import type { MeshLODLevel } from "@babylonjs/core/Meshes/meshLODLevel";
import type { SubMesh } from "@babylonjs/core/Meshes/subMesh";
import type { Observable, Observer } from "@babylonjs/core/Misc/observable";
import { RegisterClass } from "@babylonjs/core/Misc/typeStore";
import type { Node } from "@babylonjs/core/node";
import type { Scene } from "@babylonjs/core/scene";
import type { FloatArray, Nullable } from "@babylonjs/core/types";

import { MmdBufferKind } from "./mmdBufferKind";

/**
 * IMPORTANT NOTE:
 * If original _InternalMeshDataInfo represents or applySkeleton implementation is changed, this implementation must be updated.
 */

/* eslint-disable @typescript-eslint/naming-convention */
interface _InternalMeshDataInfo {
    // Events
    _onBeforeRenderObservable: Nullable<Observable<Mesh>>;
    _onBeforeBindObservable: Nullable<Observable<Mesh>>;
    _onAfterRenderObservable: Nullable<Observable<Mesh>>;
    _onBeforeDrawObservable: Nullable<Observable<Mesh>>;
    _onBetweenPassObservable: Nullable<Observable<SubMesh>>;

    _areNormalsFrozen: boolean; // Will be used by ribbons mainly
    _sourcePositions: Nullable<Float32Array>; // Will be used to save original positions when using software skinning
    _sourceNormals: Nullable<Float32Array>; // Will be used to save original normals when using software skinning

    // Will be used to save a source mesh reference, If any
    _source: Nullable<Mesh>;
    // Will be used to for fast cloned mesh lookup
    meshMap: Nullable<{ [id: string]: Mesh | undefined }>;

    _preActivateId: number;
    _LODLevels: MeshLODLevel[];
    /** Alternative definition of LOD level, using screen coverage instead of distance */
    _useLODScreenCoverage: boolean;
    _checkReadinessObserver: Nullable<Observer<Scene>>;

    _onMeshReadyObserverAdded: (observer: Observer<Mesh>) => void;

    _effectiveMaterial: Nullable<Material>;

    _forcedInstanceCount: number;

    _overrideRenderingFillMode: Nullable<number>;
}
/* eslint-enable @typescript-eslint/naming-convention */

/**
 * Sdef mesh
 *
 * This class supports Spherical Defromation(SDEF) on CPU skinning
 */
export class SdefMesh extends Mesh {
    /**
     * Updates the vertex buffer by applying transformation from the bones
     * @param skeleton defines the skeleton to apply to current mesh
     * @returns the current mesh
     */
    public override applySkeleton(skeleton: Skeleton): Mesh {
        if (!this.geometry) {
            return this;
        }

        if (this.geometry._softwareSkinningFrameId === this.getScene().getFrameId()) {
            return this;
        }

        this.geometry._softwareSkinningFrameId = this.getScene().getFrameId();

        if (!this.isVerticesDataPresent(VertexBuffer.PositionKind)) {
            return this;
        }
        if (!this.isVerticesDataPresent(VertexBuffer.MatricesIndicesKind)) {
            return this;
        }
        if (!this.isVerticesDataPresent(VertexBuffer.MatricesWeightsKind)) {
            return this;
        }

        const hasNormals = this.isVerticesDataPresent(VertexBuffer.NormalKind);

        const internalDataInfo = (this as any)._internalMeshDataInfo as _InternalMeshDataInfo;

        if (!internalDataInfo._sourcePositions) {
            const submeshes = this.subMeshes.slice();
            this.setPositionsForCPUSkinning();
            this.subMeshes = submeshes;
        }

        if (hasNormals && !internalDataInfo._sourceNormals) {
            this.setNormalsForCPUSkinning();
        }

        // positionsData checks for not being Float32Array will only pass at most once
        let positionsData = this.getVerticesData(VertexBuffer.PositionKind);

        if (!positionsData) {
            return this;
        }

        if (!(positionsData instanceof Float32Array)) {
            positionsData = new Float32Array(positionsData);
        }

        // normalsData checks for not being Float32Array will only pass at most once
        let normalsData = this.getVerticesData(VertexBuffer.NormalKind);

        if (hasNormals) {
            if (!normalsData) {
                return this;
            }

            if (!(normalsData instanceof Float32Array)) {
                normalsData = new Float32Array(normalsData);
            }
        }

        const hasSdefParams = this.isVerticesDataPresent(MmdBufferKind.MatricesSdefCKind);
        let sdefC0Data: Nullable<FloatArray> = null;
        let sdefRW0Data: Nullable<FloatArray> = null;
        let sdefRW1Data: Nullable<FloatArray> = null;
        if (hasSdefParams) {
            sdefC0Data = this.getVerticesData(MmdBufferKind.MatricesSdefCKind);
            sdefRW0Data = this.getVerticesData(MmdBufferKind.MatricesSdefRW0Kind);
            sdefRW1Data = this.getVerticesData(MmdBufferKind.MatricesSdefRW1Kind);
        }

        const matricesIndicesData = this.getVerticesData(VertexBuffer.MatricesIndicesKind);
        const matricesWeightsData = this.getVerticesData(VertexBuffer.MatricesWeightsKind);

        if (!matricesWeightsData || !matricesIndicesData) {
            return this;
        }

        const needExtras = this.numBoneInfluencers > 4;
        const matricesIndicesExtraData = needExtras ? this.getVerticesData(VertexBuffer.MatricesIndicesExtraKind) : null;
        const matricesWeightsExtraData = needExtras ? this.getVerticesData(VertexBuffer.MatricesWeightsExtraKind) : null;

        const skeletonMatrices = skeleton.getTransformMatrices(this);
        const tempVector3 = Vector3.Zero();
        const finalMatrix = new Matrix();
        const tempMatrix = new Matrix();

        // sdef temp variables
        const transformMatrix0 = new Matrix();
        const transformMatrix1 = new Matrix();

        const tempQuaternion0 = new Quaternion();
        const tempQuaternion1 = new Quaternion();

        const finalVector = new Vector3();
        // end sdef temp variables

        const sourcePositions = internalDataInfo._sourcePositions;
        const sourceNormals = internalDataInfo._sourceNormals;

        let matWeightIdx = 0;
        let inf: number;
        for (let index = 0; index < positionsData.length; index += 3, matWeightIdx += 4) {
            let r0x = 0;
            if (hasSdefParams) {
                r0x = sdefRW0Data![index];
            }

            if (r0x === 0) { // Linear transform
                let weight: number;
                for (inf = 0; inf < 4; inf++) {
                    weight = matricesWeightsData[matWeightIdx + inf];
                    if (weight > 0) {
                        Matrix.FromFloat32ArrayToRefScaled(skeletonMatrices, Math.floor(matricesIndicesData[matWeightIdx + inf] * 16), weight, tempMatrix);
                        finalMatrix.addToSelf(tempMatrix);
                    }
                }
                if (needExtras) {
                    for (inf = 0; inf < 4; inf++) {
                        weight = matricesWeightsExtraData![matWeightIdx + inf];
                        if (weight > 0) {
                            Matrix.FromFloat32ArrayToRefScaled(skeletonMatrices, Math.floor(matricesIndicesExtraData![matWeightIdx + inf] * 16), weight, tempMatrix);
                            finalMatrix.addToSelf(tempMatrix);
                        }
                    }
                }

                Vector3.TransformCoordinatesFromFloatsToRef(
                    sourcePositions![index],
                    sourcePositions![index + 1],
                    sourcePositions![index + 2],
                    finalMatrix,
                    tempVector3
                );
                tempVector3.toArray(positionsData, index);

                if (hasNormals) {
                    Vector3.TransformNormalFromFloatsToRef(
                        sourceNormals![index],
                        sourceNormals![index + 1],
                        sourceNormals![index + 2],
                        finalMatrix,
                        tempVector3
                    );
                    tempVector3.toArray(normalsData!, index);
                }

                finalMatrix.reset();
            } else { // SDEF transform
                /*

                // https://github.com/benikabocha/saba/blob/master/src/Saba/Model/MMD/PMXModel.cpp#L1032
                auto& nodes = (*m_nodeMan.GetNodes());
                const auto i0 = vtxInfo->m_sdef.m_boneIndex[0];
                const auto i1 = vtxInfo->m_sdef.m_boneIndex[1];
                const auto w0 = vtxInfo->m_sdef.m_boneWeight;
                const auto w1 = 1.0f - w0;
                const auto center = vtxInfo->m_sdef.m_sdefC;
                const auto cr0 = vtxInfo->m_sdef.m_sdefR0;
                const auto cr1 = vtxInfo->m_sdef.m_sdefR1;
                const auto q0 = glm::quat_cast(nodes[i0]->GetGlobalTransform());
                const auto q1 = glm::quat_cast(nodes[i1]->GetGlobalTransform());
                const auto m0 = transforms[i0];
                const auto m1 = transforms[i1];

                const auto pos = *position + *morphPos;
                const auto rot_mat = glm::mat3_cast(glm::slerp(q0, q1, w1));

                *updatePosition = glm::mat3(rot_mat) * (pos - center) + glm::vec3(m0 * glm::vec4(cr0, 1)) * w0 + glm::vec3(m1 * glm::vec4(cr1, 1)) * w1;
                *updateNormal = rot_mat * *normal;

                 */
                const weight0 = matricesWeightsData[matWeightIdx + 0];
                const weight1 = matricesWeightsData[matWeightIdx + 1];

                Matrix.FromArrayToRef(skeletonMatrices, Math.floor(matricesIndicesData[matWeightIdx + 0] * 16), transformMatrix0);
                Matrix.FromArrayToRef(skeletonMatrices, Math.floor(matricesIndicesData[matWeightIdx + 1] * 16), transformMatrix1);

                Quaternion.FromRotationMatrixToRef(transformMatrix0, tempQuaternion0);
                Quaternion.FromRotationMatrixToRef(transformMatrix1, tempQuaternion1);

                Matrix.FromQuaternionToRef(Quaternion.SlerpToRef(tempQuaternion0, tempQuaternion1, weight1, tempQuaternion0), tempMatrix);

                // glm::mat3(rot_mat) * (pos - center)
                Vector3.TransformCoordinatesFromFloatsToRef(
                    sourcePositions![index] - sdefC0Data![index],
                    sourcePositions![index + 1] - sdefC0Data![index + 1],
                    sourcePositions![index + 2] - sdefC0Data![index + 2],
                    tempMatrix,
                    finalVector
                );

                // + glm::vec3(m0 * glm::vec4(cr0, 1)) * w0
                Vector3.TransformCoordinatesFromFloatsToRef(
                    sdefRW0Data![index], sdefRW0Data![index + 1], sdefRW0Data![index + 2], transformMatrix0, tempVector3
                ).scaleAndAddToRef(weight0, finalVector);

                // + glm::vec3(m1 * glm::vec4(cr1, 1)) * w1
                Vector3.TransformCoordinatesFromFloatsToRef(
                    sdefRW1Data![index], sdefRW1Data![index + 1], sdefRW1Data![index + 2], transformMatrix1, tempVector3
                ).scaleAndAddToRef(weight1, finalVector);

                finalVector.toArray(positionsData, index);

                if (hasNormals) {
                    // rot_mat * *normal
                    Vector3.TransformNormalFromFloatsToRef(
                        sourceNormals![index], sourceNormals![index + 1], sourceNormals![index + 2],
                        tempMatrix, finalVector
                    );

                    finalVector.toArray(normalsData!, index);
                }
            }
        }

        this.updateVerticesData(VertexBuffer.PositionKind, positionsData);
        if (hasNormals) {
            this.updateVerticesData(VertexBuffer.NormalKind, normalsData!);
        }

        return this;
    }

    /**
     * Gets the class name
     * @returns the string "SdefMesh".
     */
    public override getClassName(): string {
        return "SdefMesh";
    }

    // NOTE: clone method is just a copy of the original method with a different return type. becareful to babylon.js internal changes
    /**
     * Returns a new Mesh object generated from the current mesh properties.
     * This method must not get confused with createInstance()
     * @param name is a string, the name given to the new mesh
     * @param newParent can be any Node object (default `null`)
     * @param doNotCloneChildren allows/denies the recursive cloning of the original mesh children if any (default `false`)
     * @param clonePhysicsImpostor allows/denies the cloning in the same time of the original mesh `body` used by the physics engine, if any (default `true`)
     * @returns a new mesh
     */
    public override clone(name: string = "", newParent: Nullable<Node> = null, doNotCloneChildren?: boolean, clonePhysicsImpostor: boolean = true): Mesh {
        return new SdefMesh(name, this.getScene(), newParent, this, doNotCloneChildren, clonePhysicsImpostor);
    }

    // NOTE: currently there is no way to override Mesh.Parse method
}

RegisterClass("BABYLON.SdefMesh", SdefMesh);
