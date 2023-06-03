import type { Material, MeshLODLevel, Nullable, Observable, Observer, Scene, Skeleton, SubMesh} from "@babylonjs/core";
import {Matrix, Mesh, Vector3, VertexBuffer } from "@babylonjs/core";

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

        let matWeightIdx = 0;
        let inf: number;
        for (let index = 0; index < positionsData.length; index += 3, matWeightIdx += 4) {
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
        }

        this.updateVerticesData(VertexBuffer.PositionKind, positionsData);
        if (hasNormals) {
            this.updateVerticesData(VertexBuffer.NormalKind, normalsData!);
        }

        return this;
    }
}
