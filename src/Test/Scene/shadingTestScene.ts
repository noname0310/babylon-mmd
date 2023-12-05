import "@babylonjs/core/Loading/loadingScreen";
import "@/Loader/pmxLoader";

import type { Engine } from "@babylonjs/core/Engines/engine";
import { SceneLoader } from "@babylonjs/core/Loading/sceneLoader";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import type { Mesh } from "@babylonjs/core/Meshes/mesh";
import { Scene } from "@babylonjs/core/scene";
import { Inspector } from "@babylonjs/inspector";

import type { MmdStandardMaterialBuilder } from "@/Loader/mmdStandardMaterialBuilder";
import type { PmxLoader } from "@/Loader/pmxLoader";
import { SdefInjector } from "@/Loader/sdefInjector";

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
        materialBuilder.loadOutlineRenderingProperties = (): void => { /* do nothing */ };
        const scene = new Scene(engine);
        scene.ambientColor = new Color3(1, 1, 1);
        createDefaultArcRotateCamera(scene);
        const { shadowGenerator } = createLightComponents(scene);
        createDefaultGround(scene);
        const mmdMesh = await SceneLoader.ImportMeshAsync(
            undefined,
            "res/private_test/model/Sour式初音ミクVer.1.02/",
            "Black.pmx",
            scene
        ).then(result => result.meshes[0]) as Mesh;
        shadowGenerator.addShadowCaster(mmdMesh);
        for (const mesh of mmdMesh.metadata.meshes) mesh.receiveShadows = true;

        Inspector.Show(scene, { enablePopup: false });

        return scene;
    }
}
