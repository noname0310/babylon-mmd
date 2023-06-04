import type { FloatArray, Material, MeshLODLevel, Nullable, Observable, Observer, Scene, Skeleton, SubMesh } from "@babylonjs/core";
import { Quaternion } from "@babylonjs/core";
import { Matrix, Mesh, Vector3, VertexBuffer } from "@babylonjs/core";

import { SdefBufferKind } from "./SdefBufferKind";

/**
 * IMPORTANT NOTE:
 * if original _InternalMeshDataInfo represents or applySkeleton implementation is changed, this implementation must be updated.
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

        if (this.geometry._softwareSkinningFrameId == this.getScene().getFrameId()) {
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

        const hasSdefParams = this.isVerticesDataPresent(SdefBufferKind.matricesSdefC0Kind);
        let sdefC0Data: Nullable<FloatArray> = null;
        let sdefRW0Data: Nullable<FloatArray> = null;
        let sdefRW1Data: Nullable<FloatArray> = null;
        if (hasSdefParams) {
            sdefC0Data = this.getVerticesData(SdefBufferKind.matricesSdefC0Kind);
            sdefRW0Data = this.getVerticesData(SdefBufferKind.matricesSdefRW0Kind);
            sdefRW1Data = this.getVerticesData(SdefBufferKind.matricesSdefRW1Kind);
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
        const localMatrix0 = Matrix.Identity();
        const localMatrix1 = Matrix.Identity();
        const transformMatrix0 = new Matrix();
        const transformMatrix1 = new Matrix();

        const tempVector = Vector3.Zero();
        const tnVector = Vector3.Zero();
        const tcVector = Vector3.Zero();

        const tempQuaternion0 = new Quaternion();
        const tempQuaternion1 = new Quaternion();

        const resultPosition = new Vector3();
        const resultNormal = new Vector3();
        // end sdef temp variables

        let matWeightIdx = 0;
        let inf: number;
        for (let index = 0; index < positionsData.length; index += 3, matWeightIdx += 4) {
            let c0x = 0;
            let c0y = 0;
            let c0z = 0;
            if (hasSdefParams) {
                c0x = sdefC0Data![index];
                c0y = sdefC0Data![index + 1];
                c0z = sdefC0Data![index + 2];
            }

            if (c0x === 0 || c0y === 0 || c0z === 0) { // Linear transform
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
                    internalDataInfo._sourcePositions![index],
                    internalDataInfo._sourcePositions![index + 1],
                    internalDataInfo._sourcePositions![index + 2],
                    finalMatrix,
                    tempVector3
                );
                tempVector3.toArray(positionsData, index);

                if (hasNormals) {
                    Vector3.TransformNormalFromFloatsToRef(
                        internalDataInfo._sourceNormals![index],
                        internalDataInfo._sourceNormals![index + 1],
                        internalDataInfo._sourceNormals![index + 2],
                        finalMatrix,
                        tempVector3
                    );
                    tempVector3.toArray(normalsData!, index);
                }

                finalMatrix.reset();
            } else { // SDEF transform
                const weight0 = matricesWeightsData[matWeightIdx + 0];
                const weight1 = matricesWeightsData[matWeightIdx + 1];

                Matrix.FromFloat32ArrayToRefScaled(skeletonMatrices, Math.floor(matricesIndicesData[matWeightIdx + 0] * 16), 1.0, transformMatrix0);
                Matrix.FromFloat32ArrayToRefScaled(skeletonMatrices, Math.floor(matricesIndicesData[matWeightIdx + 1] * 16), 1.0, transformMatrix1);

                // equivalent to Vector3.TransformNormalToRef(rw0, localMatrix0, tcVector).scaleInPlace(0.5);
                Vector3.TransformNormalFromFloatsToRef(
                    sdefRW0Data![index],
                    sdefRW0Data![index + 1],
                    sdefRW0Data![index + 2],
                    localMatrix0,
                    tcVector
                ).scaleInPlace(0.5);
                // equivalent to Vector3.TransformCoordinatesToRef(c0, transformMatrix0, tcVector).subtractInPlace(c0);
                Vector3.TransformCoordinatesFromFloatsToRef(c0x, c0y, c0z, transformMatrix0, tcVector).addInPlaceFromFloats(-c0x, -c0y, -c0z);
                tempVector.copyFrom(tcVector.addInPlace(tnVector).scaleInPlace(weight0));

                // equivalent to Vector3.TransformNormalToRef(rw1, localMatrix1, tnVector).scaleInPlace(0.5);
                Vector3.TransformNormalFromFloatsToRef(
                    sdefRW1Data![index],
                    sdefRW1Data![index + 1],
                    sdefRW1Data![index + 2],
                    localMatrix1,
                    tnVector
                ).scaleInPlace(0.5);
                // equivalent to Vector3.TransformCoordinatesToRef(c0, transformMatrix1, tcVector).subtractInPlace(c0);
                Vector3.TransformCoordinatesFromFloatsToRef(c0x, c0y, c0z, transformMatrix1, tcVector).addInPlaceFromFloats(-c0x, -c0y, -c0z);
                tempVector.addInPlace(tcVector.addInPlace(tnVector).scaleInPlace(weight1));

                // equivalent to tempVector.addInPlace(c0);
                tempVector.addInPlaceFromFloats(c0x, c0y, c0z);

                Quaternion.FromRotationMatrixToRef(localMatrix0, tempQuaternion0);
                Quaternion.FromRotationMatrixToRef(localMatrix1, tempQuaternion1);
                Matrix.FromQuaternionToRef(Quaternion.SlerpToRef(tempQuaternion0, tempQuaternion1, weight1, tempQuaternion0), tempMatrix);

                // equivalent to Vector3.TransformNormalToRef(outPosition.copyFrom(inPosition).subtractInPlace(c0), tempMatrix, outPosition).addInPlace(tempVector);
                Vector3.TransformNormalFromFloatsToRef(
                    internalDataInfo._sourcePositions![index] - c0x,
                    internalDataInfo._sourcePositions![index + 1] - c0y,
                    internalDataInfo._sourcePositions![index + 2] - c0z,
                    tempMatrix,
                    resultPosition
                ).addInPlace(tempVector);
                resultPosition.toArray(positionsData, index);

                if (hasNormals) {
                    Vector3.TransformNormalFromFloatsToRef(
                        internalDataInfo._sourceNormals![index],
                        internalDataInfo._sourceNormals![index + 1],
                        internalDataInfo._sourceNormals![index + 2],
                        tempMatrix,
                        resultNormal
                    );
                    resultNormal.toArray(normalsData!, index);
                }
            }
        }

        this.updateVerticesData(VertexBuffer.PositionKind, positionsData);
        if (hasNormals) {
            this.updateVerticesData(VertexBuffer.NormalKind, normalsData!);
        }

        return this;
    }

    /*
    private static TransformPositionSDEF(
        weight0: number,
        weight1: number,
        c0: DeepImmutable<Vector3>,
        rw0: DeepImmutable<Vector3>,
        rw1: DeepImmutable<Vector3>,
        localMatrix0: DeepImmutable<Matrix>,
        localMatrix1: DeepImmutable<Matrix>,
        transformMatrix0: DeepImmutable<Matrix>,
        transformMatrix1: DeepImmutable<Matrix>,
        inPosition: DeepImmutable<Vector3>,
        inNormal: DeepImmutable<Vector3>,

        outPosition: Vector3,
        outNormal: Vector3
    ): void {
        const tnVector = Vector3.Zero();
        const tcVector = Vector3.Zero();

        const tempVector = new Vector3();

        const tempQuaternion0 = new Quaternion();
        const tempQuaternion1 = new Quaternion();

        const tempMatrix = new Matrix();

        Vector3.TransformNormalToRef(rw0, localMatrix0, tcVector).scaleInPlace(0.5);
        Vector3.TransformCoordinatesToRef(c0, transformMatrix0, tcVector).subtractInPlace(c0);
        tempVector.copyFrom(tcVector.addInPlace(tnVector).scaleInPlace(weight0));

        Vector3.TransformNormalToRef(rw1, localMatrix1, tnVector).scaleInPlace(0.5);
        Vector3.TransformCoordinatesToRef(c0, transformMatrix1, tcVector).subtractInPlace(c0);
        tempVector.addInPlace(tcVector.addInPlace(tnVector).scaleInPlace(weight1));

        tempVector.addInPlace(c0);

        Quaternion.FromRotationMatrixToRef(localMatrix0, tempQuaternion0);
        Quaternion.FromRotationMatrixToRef(localMatrix1, tempQuaternion1);
        Matrix.FromQuaternionToRef(Quaternion.SlerpToRef(tempQuaternion0, tempQuaternion1, weight1, tempQuaternion0), tempMatrix);

        Vector3.TransformNormalToRef(outPosition.copyFrom(inPosition).subtractInPlace(c0), tempMatrix, outPosition).addInPlace(tempVector);
        Vector3.TransformNormalToRef(inNormal, tempMatrix, outNormal);
    }
    */
}
