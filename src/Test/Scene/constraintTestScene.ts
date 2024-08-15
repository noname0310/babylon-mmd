import "@babylonjs/core/Loading/loadingScreen";
import "@/Loader/pmxLoader";
import "@/Loader/mmdOutlineRenderer";

import { PhysicsViewer } from "@babylonjs/core/Debug/physicsViewer";
import { SkeletonViewer } from "@babylonjs/core/Debug/skeletonViewer";
import type { AbstractEngine } from "@babylonjs/core/Engines/abstractEngine";
import { loadAssetContainerAsync } from "@babylonjs/core/Loading/sceneLoader";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { Mesh } from "@babylonjs/core/Meshes/mesh";
import type { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { HavokPlugin } from "@babylonjs/core/Physics/v2/Plugins/havokPlugin";
import { Scene } from "@babylonjs/core/scene";
import havokPhysics from "@babylonjs/havok";
import { Inspector } from "@babylonjs/inspector";

import { MmdStandardMaterialBuilder } from "@/Loader/mmdStandardMaterialBuilder";
import { SdefInjector } from "@/Loader/sdefInjector";
import { MmdRuntime } from "@/Runtime/mmdRuntime";
import { MmdPhysics } from "@/Runtime/Physics/mmdPhysics";

import type { ISceneBuilder } from "../baseRuntime";
import { createDefaultArcRotateCamera } from "../Util/createDefaultArcRotateCamera";
import { createDefaultGround } from "../Util/createDefaultGround";
import { createLightComponents } from "../Util/createLightComponents";

export class SceneBuilder implements ISceneBuilder {
    public async build(_canvas: HTMLCanvasElement, engine: AbstractEngine): Promise<Scene> {
        SdefInjector.OverrideEngineCreateEffect(engine);

        // materialBuilder.alphaEvaluationResolution = 2048;
        const scene = new Scene(engine);
        createDefaultArcRotateCamera(scene);
        const { shadowGenerator } = createLightComponents(scene);
        createDefaultGround(scene);

        const materialBuilder = new MmdStandardMaterialBuilder();
        materialBuilder.forceDisableAlphaEvaluation = false;

        const mmdMesh = await loadAssetContainerAsync(
            "res/private_test/model/ふわミクさんセット20230901/F_Miku_202309/ふわミクさんver250.pmx",
            scene,
            {
                pluginOptions: {
                    pmxmodel: {
                        materialBuilder: materialBuilder,
                        loggingEnabled: true
                    }
                }
            }
        ).then(result => {
            result.addAllToScene();
            return result.meshes[0] as Mesh;
        });
        mmdMesh.scaling.scaleInPlace(5);
        for (const mesh of mmdMesh.metadata.meshes) {
            mesh.receiveShadows = true;
            shadowGenerator.addShadowCaster(mesh, false);
        }

        const havokInstance = await havokPhysics();
        const havokPlugin = new HavokPlugin(true, havokInstance);
        scene.enablePhysics(new Vector3(0, -98, 0), havokPlugin);

        const mmdRuntime = new MmdRuntime(scene, new MmdPhysics(scene));
        mmdRuntime.register(scene);
        mmdRuntime.createMmdModel(mmdMesh);

        Inspector.Show(scene, { });

        {
            const physicsViewer = new PhysicsViewer(scene);
            for (const node of mmdMesh.getChildren()) {
                if ((node as TransformNode).physicsBody) {
                    physicsViewer.showBody((node as TransformNode).physicsBody!);
                }
            }
        }

        const skeletionViewer = new SkeletonViewer(mmdMesh.metadata.skeleton, mmdMesh, scene, false, 3, {
            displayMode: SkeletonViewer.DISPLAY_SPHERE_AND_SPURS
        });
        skeletionViewer.isEnabled = true;

        return scene;
    }
}
