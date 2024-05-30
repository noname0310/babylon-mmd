import type { Skeleton } from "@babylonjs/core/Bones/skeleton";
import type { Matrix } from "@babylonjs/core/Maths/math.vector";
import type { Nullable } from "@babylonjs/core/types";

/**
 * Order Independent Compute Transform Matrices Injector
 *
 * Inject order independent _computeTransformMatrices function into the skeleton
 */
export class OiComputeTransformInjector {
    /**
     * Override _computeTransformMatrices function
     *
     * Inject the code so that target skeleton support order independent _computeTransformMatrices
     *
     * if skeleton has looped bone structure, do not use this method
     *
     * @param skeleton Skeleton to override
     */
    public static OverrideComputeTransformMatrices(skeleton: Skeleton): void {
        (skeleton as any)._computeTransformMatrices = function(targetMatrix: Float32Array, initialSkinMatrix: Nullable<Matrix>): void {
            (this as Skeleton).onBeforeComputeObservable.notifyObservers(this);

            for (let index = 0; index < (this as Skeleton).bones.length; index++) {
                const rootBone = (this as Skeleton).bones[index];
                rootBone._childUpdateId += 1;

                if (!rootBone.getParent()) {
                    const stack = [rootBone];
                    while (stack.length > 0) {
                        const bone = stack.pop()!;
                        const parentBone = bone.getParent();

                        if (parentBone) {
                            bone.getLocalMatrix().multiplyToRef(parentBone.getFinalMatrix(), bone.getFinalMatrix());
                        } else {
                            if (initialSkinMatrix) {
                                bone.getLocalMatrix().multiplyToRef(initialSkinMatrix, bone.getFinalMatrix());
                            } else {
                                bone.getFinalMatrix().copyFrom(bone.getLocalMatrix());
                            }
                        }

                        if (bone._index !== -1) {
                            const mappedIndex = bone._index === null ? index : bone._index;
                            bone.getAbsoluteInverseBindMatrix().multiplyToArray(bone.getFinalMatrix(), targetMatrix, mappedIndex * 16);
                        }

                        const childrenBones = bone.getChildren();
                        for (const childrenBone of childrenBones) {
                            stack.push(childrenBone);
                        }
                    }
                }
            }

            this._identity.copyToArray(targetMatrix, this.bones.length * 16);
        };
    }
}
