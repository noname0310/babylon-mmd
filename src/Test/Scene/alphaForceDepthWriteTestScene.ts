import "@babylonjs/core/Loading/loadingScreen";
import "@babylonjs/core/Lights/Shadows/shadowGeneratorSceneComponent";
import "@/Loader/pmxLoader";
import "@/Loader/pmdLoader";
import "@/Loader/mmdOutlineRenderer";

import type { AbstractEngine } from "@babylonjs/core/Engines/abstractEngine";
import { LoadAssetContainerAsync } from "@babylonjs/core/Loading/sceneLoader";
import { ImageProcessingConfiguration } from "@babylonjs/core/Materials/imageProcessingConfiguration";
import { Material } from "@babylonjs/core/Materials/material";
import { Color3, Color4 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { DefaultRenderingPipeline } from "@babylonjs/core/PostProcesses/RenderPipeline/Pipelines/defaultRenderingPipeline";
import { Scene } from "@babylonjs/core/scene";
import { Inspector } from "@babylonjs/inspector";

import { MmdStandardMaterialBuilder } from "@/Loader/mmdStandardMaterialBuilder";
import { SdefInjector } from "@/Loader/sdefInjector";
import type { MmdMesh } from "@/Runtime/mmdMesh";

import type { ISceneBuilder } from "../baseRuntime";
import { createDefaultArcRotateCamera } from "../Util/createDefaultArcRotateCamera";
import { createDefaultGround } from "../Util/createDefaultGround";
import { createLightComponents } from "../Util/createLightComponents";

export class SceneBuilder implements ISceneBuilder {
    public async build(_canvas: HTMLCanvasElement, engine: AbstractEngine): Promise<Scene> {
        SdefInjector.OverrideEngineCreateEffect(engine);

        const scene = new Scene(engine);
        scene.ambientColor = new Color3(0.5, 0.5, 0.5);
        scene.clearColor = new Color4(0.95, 0.95, 0.95, 1.0);
        const arcRotateCamera = createDefaultArcRotateCamera(scene);
        arcRotateCamera.setPosition(new Vector3(2, 19, -10));
        arcRotateCamera.setTarget(new Vector3(0, 17, 0));
        arcRotateCamera.fov = 0.4;
        const { shadowGenerator } = createLightComponents(scene);
        shadowGenerator.transparencyShadow = true;
        createDefaultGround(scene);

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

        Inspector.Show(scene, { });

        const defaultPipeline = new DefaultRenderingPipeline("default", true, scene);
        defaultPipeline.samples = 4;
        defaultPipeline.fxaaEnabled = true;

        defaultPipeline.imageProcessingEnabled = true;
        defaultPipeline.imageProcessing.toneMappingEnabled = false;
        defaultPipeline.imageProcessing.toneMappingType = ImageProcessingConfiguration.TONEMAPPING_ACES;

        return scene;
    }
}
