import "@babylonjs/core/Loading/loadingScreen";
import "@babylonjs/core/Lights/Shadows/shadowGeneratorSceneComponent";
import "@/Loader/pmxLoader";

import type { AbstractEngine } from "@babylonjs/core/Engines/abstractEngine";
import { SceneLoader } from "@babylonjs/core/Loading/sceneLoader";
import { Color4 } from "@babylonjs/core/Maths/math.color";
import { Scene } from "@babylonjs/core/scene";
import { Inspector } from "@babylonjs/inspector";

import { type MmdStandardMaterialBuilder, MmdStandardMaterialRenderMethod } from "@/Loader/mmdStandardMaterialBuilder";
import type { PmxLoader } from "@/Loader/pmxLoader";
import { SdefInjector } from "@/Loader/sdefInjector";
import { TextureAlphaChecker } from "@/Loader/textureAlphaChecker";
import type { MmdMesh } from "@/Runtime/mmdMesh";

import type { ISceneBuilder } from "../baseRuntime";
import { createDefaultArcRotateCamera } from "../Util/createDefaultArcRotateCamera";
import { createDefaultGround } from "../Util/createDefaultGround";
import { createLightComponents } from "../Util/createLightComponents";

export class SceneBuilder implements ISceneBuilder {
    public async build(_canvas: HTMLCanvasElement, engine: AbstractEngine): Promise<Scene> {
        SdefInjector.OverrideEngineCreateEffect(engine);
        const pmxLoader = SceneLoader.GetPluginForExtension(".pmx") as PmxLoader;
        pmxLoader.loggingEnabled = true;
        const materialBuilder = pmxLoader.materialBuilder as MmdStandardMaterialBuilder;
        materialBuilder.renderMethod = MmdStandardMaterialRenderMethod.AlphaEvaluation;
        // materialBuilder.alphaEvaluationResolution = 2048;
        materialBuilder.loadOutlineRenderingProperties = (): void => { /* do nothing */ };

        const scene = new Scene(engine);
        scene.clearColor = new Color4(0.95, 0.95, 0.95, 1.0);
        createDefaultArcRotateCamera(scene);
        const { shadowGenerator } = createLightComponents(scene);
        createDefaultGround(scene);

        pmxLoader.buildSkeleton = false;
        pmxLoader.buildMorph = false;
        const mmdMesh = await SceneLoader.ImportMeshAsync(
            undefined,
            "res/private_test/model/YYB 元气少女/",
            "Miku.pmx",
            scene
        ).then(result => result.meshes[0] as MmdMesh);
        for (const mesh of mmdMesh.metadata.meshes) {
            mesh.receiveShadows = true;
            shadowGenerator.addShadowCaster(mesh, false);
        }

        TextureAlphaChecker.DisposeShader(scene);

        Inspector.Show(scene, { });

        return scene;
    }
}
