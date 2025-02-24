import "@babylonjs/core/Loading/loadingScreen";
import "@babylonjs/core/Lights/Shadows/shadowGeneratorSceneComponent";
import "@/Loader/pmxLoader";
import "@/Loader/mmdOutlineRenderer";

import type { AbstractEngine } from "@babylonjs/core/Engines/abstractEngine";
import { LoadAssetContainerAsync } from "@babylonjs/core/Loading/sceneLoader";
import { Color4 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Scene } from "@babylonjs/core/scene";
import { Inspector } from "@babylonjs/inspector";

import { MmdStandardMaterial } from "@/Loader/mmdStandardMaterial";
import { MmdStandardMaterialBuilder, MmdStandardMaterialRenderMethod } from "@/Loader/mmdStandardMaterialBuilder";
import { SdefInjector } from "@/Loader/sdefInjector";
import { SdefMesh } from "@/Loader/sdefMesh";
import { TextureAlphaChecker } from "@/Loader/textureAlphaChecker";
import { BezierAnimation } from "@/Runtime/Animation/bezierAnimation";
import { MmdCamera } from "@/Runtime/mmdCamera";
import type { MmdMesh } from "@/Runtime/mmdMesh";

import type { ISceneBuilder } from "../baseRuntime";
import { createDefaultArcRotateCamera } from "../Util/createDefaultArcRotateCamera";
import { createDefaultGround } from "../Util/createDefaultGround";
import { createLightComponents } from "../Util/createLightComponents";

export class SceneBuilder implements ISceneBuilder {
    public async build(_canvas: HTMLCanvasElement, engine: AbstractEngine): Promise<Scene> {
        SdefInjector.OverrideEngineCreateEffect(engine);

        const scene = new Scene(engine);
        scene.clearColor = new Color4(0.95, 0.95, 0.95, 1.0);
        createDefaultArcRotateCamera(scene);
        const { shadowGenerator } = createLightComponents(scene);
        shadowGenerator.transparencyShadow = true;
        createDefaultGround(scene);

        const mmdCamera = new MmdCamera("mmdCamera", new Vector3(4, 10, 0), scene);
        mmdCamera.clone("clonedMmdCamera");
        MmdCamera.Parse(mmdCamera.serialize(), scene);

        const sdefMesh = new SdefMesh("sdefMesh", scene);
        sdefMesh.clone();
        // SdefMesh.Parse(sdefMesh.serialize(), scene, "rootUrl");

        const bezierAnimation = new BezierAnimation("bezierAnimation", "x", 30, BezierAnimation.ANIMATIONTYPE_FLOAT);
        bezierAnimation.clone();

        const materialBuilder = new MmdStandardMaterialBuilder();
        materialBuilder.renderMethod = MmdStandardMaterialRenderMethod.DepthWriteAlphaBlendingWithEvaluation;
        // materialBuilder.alphaEvaluationResolution = 2048;
        // materialBuilder.loadOutlineRenderingProperties = (): void => { /* do nothing */ };

        const assetContainer = await LoadAssetContainerAsync(
            "res/private_test/model/YYB Hatsune Miku_10th/YYB Hatsune Miku_10th_v1.02 - faceforward.pmx",
            scene,
            {
                pluginOptions: {
                    mmdmodel: {
                        materialBuilder: materialBuilder,
                        buildSkeleton: true,
                        buildMorph: true,
                        loggingEnabled: true
                    }
                }
            }
        );
        assetContainer.addAllToScene();
        assetContainer.instantiateModelsToScene(undefined, true);
        // const mmdMesh = assetContainer(undefined, true).rootNodes[0] as MmdMesh;
        const mmdMesh = scene.rootNodes[scene.rootNodes.length - 1] as MmdMesh;
        mmdMesh.position.z = 10;
        for (const mesh of mmdMesh.getChildMeshes()) {
            mesh.receiveShadows = true;
            shadowGenerator.addShadowCaster(mesh, false);
        }
        MmdStandardMaterial;

        // const mmdMesh2 = await SceneLoader.ImportMeshAsync(
        //     undefined,
        //     "res/private_test/model/YYB Hatsune Miku_10th/",
        //     "YYB Hatsune Miku_10th_v1.02 - faceforward.pmx",
        //     scene
        // ).then((result) => result.meshes[0] as MmdMesh);
        // mmdMesh2.position.x = -10;
        // for (const mesh of mmdMesh2.getChildMeshes()) {
        //     mesh.receiveShadows = true;
        //     shadowGenerator.addShadowCaster(mesh, false);
        // }
        // mmdMesh2.getChildMeshes()[0].material = MmdStandardMaterial.Parse(mmdMesh2.getChildMeshes()[0].material!.serialize(), scene, "rootUrl");

        // const mmdMesh3 = await SceneLoader.ImportMeshAsync(
        //     undefined,
        //     "res/private_test/model/YYB Hatsune Miku_10th/",
        //     "YYB Hatsune Miku_10th_v1.02 - faceforward.pmx",
        //     scene
        // ).then((result) => result.meshes[0] as MmdMesh);
        // mmdMesh3.position.x = 10;

        TextureAlphaChecker.DisposeShader(scene);

        Inspector.Show(scene, { });

        return scene;
    }
}
