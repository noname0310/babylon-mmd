import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { PhysicsMotionType, PhysicsShapeType } from "@babylonjs/core/Physics/v2/IPhysicsEnginePlugin";
import { PhysicsBody } from "@babylonjs/core/Physics/v2/physicsBody";
import { PhysicsShape } from "@babylonjs/core/Physics/v2/physicsShape";
import type { Scene } from "@babylonjs/core/scene";

export function CreateGroundCollider(scene: Scene): void {
    const transformNode = new TransformNode("ground", scene);
    const groundRigidBody = new PhysicsBody(transformNode, PhysicsMotionType.STATIC, true, scene);
    const height = 0;
    groundRigidBody.shape = new PhysicsShape(
        {
            type: PhysicsShapeType.HEIGHTFIELD,
            parameters: {
                heightFieldSizeX: 100,
                heightFieldSizeZ: 100,
                numHeightFieldSamplesX: 2,
                numHeightFieldSamplesZ: 2,
                heightFieldData: new Float32Array([height, height, height, height])
            }
        },
        scene
    );
}
