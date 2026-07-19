import type { AbstractEngine } from "@babylonjs/core/Engines/abstractEngine.pure";
import { RegisterLoadingScreen } from "@babylonjs/core/Loading/loadingScreen.pure";
import { LoadAssetContainerAsync } from "@babylonjs/core/Loading/sceneLoader";
import { ImageProcessingConfiguration } from "@babylonjs/core/Materials/imageProcessingConfiguration.pure";
import { Material } from "@babylonjs/core/Materials/material.pure";
import { Color3, Color4 } from "@babylonjs/core/Maths/math.color.pure";
import { Vector3 } from "@babylonjs/core/Maths/math.vector.pure";
import { RegisterInstancedMesh } from "@babylonjs/core/Meshes/instancedMesh.pure";
import { SetMissingSideEffectWarningsEnabled } from "@babylonjs/core/Misc/devTools";
import { DefaultRenderingPipeline } from "@babylonjs/core/PostProcesses/RenderPipeline/Pipelines/defaultRenderingPipeline.pure";
import { Scene } from "@babylonjs/core/scene.pure";
import { ShowInspector } from "@babylonjs/inspector";

import { RegisterMmdOutlineRenderer } from "@/Loader/mmdOutlineRenderer.pure";
import { MmdStandardMaterialBuilder } from "@/Loader/mmdStandardMaterialBuilder";
import { RegisterPmdLoader } from "@/Loader/pmdLoader.pure";
import { RegisterPmxLoader } from "@/Loader/pmxLoader.pure";
import { SdefInjector } from "@/Loader/sdefInjector";
import type { MmdMesh } from "@/Runtime/mmdMesh";

import type { ISceneBuilder } from "../baseRuntime";
import { CreateDefaultArcRotateCamera } from "../Util/createDefaultArcRotateCamera";
import { CreateDefaultGround } from "../Util/createDefaultGround";
import { CreateLightComponents } from "../Util/createLightComponents";

export class SceneBuilder implements ISceneBuilder {
    public async buildAsync(_canvas: HTMLCanvasElement, engine: AbstractEngine): Promise<Scene> {
        SetMissingSideEffectWarningsEnabled(true);
        RegisterLoadingScreen();
        RegisterInstancedMesh();
        RegisterPmxLoader();
        RegisterPmdLoader();
        RegisterMmdOutlineRenderer();
        SdefInjector.OverrideEngineCreateEffect(engine);

        const scene = new Scene(engine);
        scene.ambientColor = new Color3(0.5, 0.5, 0.5);
        scene.clearColor = new Color4(0.95, 0.95, 0.95, 1.0);
        const arcRotateCamera = CreateDefaultArcRotateCamera(scene);
        arcRotateCamera.setPosition(new Vector3(2, 19, -10));
        arcRotateCamera.setTarget(new Vector3(0, 17, 0));
        arcRotateCamera.fov = 0.4;
        const { shadowGenerator } = CreateLightComponents(scene);
        shadowGenerator.transparencyShadow = true;
        CreateDefaultGround(scene);

        const materialBuilder = new MmdStandardMaterialBuilder();
        materialBuilder.forceDisableAlphaEvaluation = true;
        // materialBuilder.alphaEvaluationResolution = 2048;
        // materialBuilder.loadOutlineRenderingProperties = (): void => { /* do nothing */ };
        // materialBuilder.loadSphereTexture = (): void => { /* do nothing */ };

        materialBuilder.afterBuildSingleMaterial = (material): void => {
            if (material.diffuseTexture) {
                material.diffuseTexture.hasAlpha = true;
                material.useAlphaFromDiffuseTexture = true;
            }
            material.transparencyMode = Material.MATERIAL_ALPHABLEND;
            material.forceDepthWrite = true;

            material.useLogarithmicDepth = true;
        };

        const mmdMesh = await LoadAssetContainerAsync(
            "res/private_test/model/YYB Hatsune Miku_NT/YYB Hatsune Miku_NT_1.0ver.pmx",
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
        ).then(result => {
            result.addAllToScene();
            return result.meshes[0] as MmdMesh;
        });
        {
            const meshes = mmdMesh.metadata.meshes;
            for (let i = 0; i < meshes.length; i++) {
                console.log(meshes[i].getVerticesDataKinds());
                const instanced = meshes[i].createInstance(`instanced_${i}`);
                instanced.position.x += 10;
            }
        }

        const meshes = mmdMesh.metadata.meshes;
        for (let i = 0; i < meshes.length; i++) {
            const mesh = meshes[i];
            mesh.alphaIndex = i;
        }

        for (const mesh of mmdMesh.metadata.meshes) {
            mesh.receiveShadows = true;
            shadowGenerator.addShadowCaster(mesh, false);
        }

        ShowInspector(scene, { });

        const defaultPipeline = new DefaultRenderingPipeline("default", true, scene);
        defaultPipeline.samples = 4;
        defaultPipeline.fxaaEnabled = true;

        defaultPipeline.imageProcessingEnabled = true;
        defaultPipeline.imageProcessing.toneMappingEnabled = false;
        defaultPipeline.imageProcessing.toneMappingType = ImageProcessingConfiguration.TONEMAPPING_ACES;

        return scene;
    }
}
