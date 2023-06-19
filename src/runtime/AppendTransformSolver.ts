import { Quaternion } from "@babylonjs/core";

import type { MmdBone, MmdSkeleton } from "./MmdMesh";

export class AppendTransformSolver {
    private readonly _skeleton: MmdSkeleton;

    public constructor(skeleton: MmdSkeleton) {
        this._skeleton = skeleton;
    }

    public update(bone: MmdBone): void {
        const appendTransformMetadata = bone.metadata.appendTransform;

        appendTransformMetadata;
        this._skeleton;
        Quaternion;

        // if (appendTransformMetadata === undefined) return;

        // if (appendTransformMetadata.affectRotation) {
        // 	glm::quat appendRotate;
        // 	if (appendTransformMetadata.isLocal) {
        // 		appendRotate = appendTransformMetadata.
        // 	} else {
        // 		if (m_appendNode->GetAppendNode() != nullptr)
        // 		{
        // 			appendRotate = m_appendNode->GetAppendRotate();
        // 		}
        // 		else
        // 		{
        // 			appendRotate = m_appendNode->AnimateRotate();
        // 		}
        // 	}

        // 	if (m_appendNode->m_enableIK)
        // 	{
        // 		appendRotate = m_appendNode->GetIKRotate() * appendRotate;
        // 	}

        // 	glm::quat appendQ = Quaternion.SlerpToRef(
        // 		glm::quat(1, 0, 0, 0),
        // 		appendRotate,
        //         appendTransformMetadata.ratio
        // 	);
        // 	m_appendRotate = appendQ;
        // }

        // if (appendTransformMetadata.affectPosition) {
        // 	glm::vec3 appendTranslate(0.0f);
        // 	if (m_isAppendLocal)
        // 	{
        // 		appendTranslate = m_appendNode->GetTranslate() - m_appendNode->GetInitialTranslate();
        // 	}
        // 	else
        // 	{
        // 		if (m_appendNode->GetAppendNode() != nullptr)
        // 		{
        // 			appendTranslate = m_appendNode->GetAppendTranslate();
        // 		}
        // 		else
        // 		{
        // 			appendTranslate = m_appendNode->GetTranslate() - m_appendNode->GetInitialTranslate();
        // 		}
        // 	}

        // 	m_appendTranslate = appendTranslate * GetAppendWeight();
        // }

        // UpdateLocalTransform();
    }
}
