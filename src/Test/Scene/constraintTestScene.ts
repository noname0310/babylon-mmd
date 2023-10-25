import "@babylonjs/core/Loading/loadingScreen";
import "@/Loader/pmxLoader";

import { PhysicsViewer } from "@babylonjs/core/Debug/physicsViewer";
import { SkeletonViewer } from "@babylonjs/core/Debug/skeletonViewer";
import type { Engine } from "@babylonjs/core/Engines/engine";
import { SceneLoader } from "@babylonjs/core/Loading/sceneLoader";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { Mesh } from "@babylonjs/core/Meshes/mesh";
import { HavokPlugin } from "@babylonjs/core/Physics/v2/Plugins/havokPlugin";
import { Scene } from "@babylonjs/core/scene";
import havokPhysics from "@babylonjs/havok";
import { Inspector } from "@babylonjs/inspector";

import type { MmdStandardMaterialBuilder } from "@/Loader/mmdStandardMaterialBuilder";
import type { PmxLoader } from "@/Loader/pmxLoader";
import { SdefInjector } from "@/Loader/sdefInjector";
import { MmdPhysics } from "@/Runtime/mmdPhysics";
import { MmdRuntime } from "@/Runtime/mmdRuntime";

import type { ISceneBuilder } from "../baseRuntime";
import { createDefaultArcRotateCamera } from "../Util/createDefaultArcRotateCamera";
import { createDefaultGround } from "../Util/createDefaultGround";
import { createLightComponents } from "../Util/createLightComponents";

export class SceneBuilder implements ISceneBuilder {
    public async build(_canvas: HTMLCanvasElement, engine: Engine): Promise<Scene> {
        SdefInjector.OverrideEngineCreateEffect(engine);
        const pmxLoader = SceneLoader.GetPluginForExtension(".pmx") as PmxLoader;
        pmxLoader.loggingEnabled = true;
        const materialBuilder = pmxLoader.materialBuilder as MmdStandardMaterialBuilder;
        materialBuilder.useAlphaEvaluation = true;
        // materialBuilder.alphaEvaluationResolution = 2048;
        materialBuilder.loadOutlineRenderingProperties = (): void => { /* do nothing */ };
        const scene = new Scene(engine);
        createDefaultArcRotateCamera(scene);
        const { shadowGenerator } = createLightComponents(scene);
        createDefaultGround(scene);

        const mmdMesh = await SceneLoader.ImportMeshAsync(
            undefined,
            "res/private_test/model/ふわミクさんセット20230901/F_Miku_202309/",
            "ふわミクさんver250.pmx",
            scene
        ).then(result => result.meshes[0]) as Mesh;
        mmdMesh.scaling.scaleInPlace(5);
        mmdMesh.receiveShadows = true;
        shadowGenerator.addShadowCaster(mmdMesh);

        const havokInstance = await havokPhysics();
        const havokPlugin = new HavokPlugin(true, havokInstance);
        scene.enablePhysics(new Vector3(0, -98, 0), havokPlugin);

        const mmdRuntime = new MmdRuntime(new MmdPhysics(scene));
        mmdRuntime.register(scene);
        mmdRuntime.createMmdModel(mmdMesh);

        Inspector.Show(scene, { });

        {
            const physicsViewer = new PhysicsViewer(scene);
            for (const node of mmdMesh.getChildren()) {
                if ((node as any).physicsBody) {
                    physicsViewer.showBody((node as any).physicsBody);
                }
            }
        }

        const skeletionViewer = new SkeletonViewer(mmdMesh.skeleton!, mmdMesh, scene, false, 3, {
            displayMode: SkeletonViewer.DISPLAY_SPHERE_AND_SPURS
        });
        skeletionViewer.isEnabled = true;

        return scene;
    }
}
