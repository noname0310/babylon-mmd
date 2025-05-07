import "@babylonjs/core/Loading/loadingScreen";
import "@babylonjs/core/Lights/Shadows/shadowGeneratorSceneComponent";
import "@/Loader/pmxLoader";

import type { AbstractEngine } from "@babylonjs/core/Engines/abstractEngine";
import { LoadAssetContainerAsync } from "@babylonjs/core/Loading/sceneLoader";
import { Color4 } from "@babylonjs/core/Maths/math.color";
import { Scene } from "@babylonjs/core/scene";
import { Inspector } from "@babylonjs/inspector";

import { MmdMaterialRenderMethod } from "@/Loader/materialBuilderBase";
import { MmdStandardMaterialBuilder } from "@/Loader/mmdStandardMaterialBuilder";
import { RegisterDxBmpTextureLoader } from "@/Loader/registerDxBmpTextureLoader";
import { SdefInjector } from "@/Loader/sdefInjector";
import { TextureAlphaChecker } from "@/Loader/textureAlphaChecker";
import type { MmdMesh } from "@/Runtime/mmdMesh";

import type { ISceneBuilder } from "../baseRuntime";
import { CreateDefaultArcRotateCamera } from "../Util/createDefaultArcRotateCamera";
import { CreateDefaultGround } from "../Util/createDefaultGround";
import { CreateLightComponents } from "../Util/createLightComponents";

export class SceneBuilder implements ISceneBuilder {
    public async buildAsync(_canvas: HTMLCanvasElement, engine: AbstractEngine): Promise<Scene> {
        SdefInjector.OverrideEngineCreateEffect(engine);

        RegisterDxBmpTextureLoader();

        const scene = new Scene(engine);
        scene.clearColor = new Color4(0.95, 0.95, 0.95, 1.0);
        CreateDefaultArcRotateCamera(scene);
        const { shadowGenerator } = CreateLightComponents(scene);
        CreateDefaultGround(scene);

        const materialBuilder = new MmdStandardMaterialBuilder();
        materialBuilder.renderMethod = MmdMaterialRenderMethod.AlphaEvaluation;
        // materialBuilder.alphaEvaluationResolution = 2048;
        materialBuilder.loadOutlineRenderingProperties = (): void => { /* do nothing */ };

        const mmdMesh = await LoadAssetContainerAsync(
            "res/private_test/stage/MMD School Auditorium/Auditorium.pmx",
            scene,
            {
                pluginOptions: {
                    mmdmodel: {
                        materialBuilder: materialBuilder,
                        buildSkeleton: false,
                        buildMorph: false,
                        loggingEnabled: true
                    }
                }
            }
        ).then(result => {
            result.addAllToScene();
            return result.meshes[0] as MmdMesh;
        });
        for (const mesh of mmdMesh.metadata.meshes) {
            mesh.receiveShadows = true;
            shadowGenerator.addShadowCaster(mesh, false);
        }

        TextureAlphaChecker.DisposeShader(scene);

        Inspector.Show(scene, { });

        return scene;
    }
}
