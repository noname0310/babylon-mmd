import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial.pure";
import { Color3 } from "@babylonjs/core/Maths/math.color.pure";
import { CreateGround } from "@babylonjs/core/Meshes/Builders/groundBuilder.pure";
import type { Mesh } from "@babylonjs/core/Meshes/mesh.pure";
import type { Scene } from "@babylonjs/core/scene.pure";

export interface ICreateDefaultGroundOptions {
    useLogarithmicDepth?: boolean;
}

export function CreateDefaultGround(scene: Scene, options: ICreateDefaultGroundOptions = {}): Mesh {
    const useLogarithmicDepth = options.useLogarithmicDepth ?? false;

    const ground = CreateGround("ground1", { width: 120, height: 120, subdivisions: 2, updatable: false }, scene);
    const groundMaterial = ground.material = new StandardMaterial("groundMaterial", scene);
    groundMaterial.diffuseColor = new Color3(1.02, 1.02, 1.02);
    groundMaterial.useLogarithmicDepth = useLogarithmicDepth;
    ground.receiveShadows = true;

    return ground;
}
