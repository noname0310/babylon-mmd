import "@babylonjs/core/Loading/loadingScreen";
import "@babylonjs/core/Lights/Shadows/shadowGeneratorSceneComponent";
import "@/Loader/pmxLoader";

import { ArcRotateCamera } from "@babylonjs/core/Cameras/arcRotateCamera";
import type { Engine } from "@babylonjs/core/Engines/engine";
import { SceneLoader } from "@babylonjs/core/Loading/sceneLoader";
import { Color4 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Scene } from "@babylonjs/core/scene";
import { Inspector } from "@babylonjs/inspector";

import type { MmdStandardMaterialBuilder } from "@/Loader/mmdStandardMaterialBuilder";
import type { PmxLoader } from "@/Loader/pmxLoader";
import { SdefInjector } from "@/Loader/sdefInjector";

import type { ISceneBuilder } from "../baseRuntime";
import { createDefaultGround } from "../Util/createDefaultGround";
import { createLightComponents } from "../Util/createLightComponents";

export class SceneBuilder implements ISceneBuilder {
    public async build(canvas: HTMLCanvasElement, engine: Engine): Promise<Scene> {
        SdefInjector.OverrideEngineCreateEffect(engine);
        const pmxLoader = SceneLoader.GetPluginForExtension(".pmx") as PmxLoader;
        pmxLoader.loggingEnabled = true;
        const materialBuilder = pmxLoader.materialBuilder as MmdStandardMaterialBuilder;
        materialBuilder.useAlphaEvaluation = true;
        // materialBuilder.alphaEvaluationResolution = 2048;
        // materialBuilder.loadDiffuseTexture = (): void => { /* do nothing */ };
        // materialBuilder.loadSphereTexture = (): void => { /* do nothing */ };
        // materialBuilder.loadToonTexture = (): void => { /* do nothing */ };
        materialBuilder.loadOutlineRenderingProperties = (): void => { /* do nothing */ };
        const scene = new Scene(engine);
        scene.clearColor = new Color4(0.95, 0.95, 0.95, 1.0);

        const camera = new ArcRotateCamera("arcRotateCamera", 0, 0, 45, new Vector3(0, 10, 0), scene);
        camera.maxZ = 5000;
        camera.setPosition(new Vector3(0, 10, -45));
        camera.attachControl(canvas, false);
        camera.inertia = 0.8;
        camera.speed = 10;

        const { shadowGenerator } = createLightComponents(scene);
        createDefaultGround(scene);

        pmxLoader.buildSkeleton = false;
        pmxLoader.buildMorph = false;
        const mmdMesh = await SceneLoader.ImportMeshAsync(
            undefined,
            "https://a-cdn.qbox.net/test/models/pmx/[MODELS]%20Lovesick%20girls%20ver.1/",
            "[LSG]%20Jennie%20(Miku)%20ver.1.pmx",
            scene
        ).then(result => result.meshes[0]);
        mmdMesh.receiveShadows = true;
        shadowGenerator.addShadowCaster(mmdMesh);

        Inspector.Show(scene, { });

        return scene;
    }
}
