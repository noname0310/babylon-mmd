import "@babylonjs/core/Loading/loadingScreen";
import "@/Loader/pmxLoader";

import type { AbstractEngine } from "@babylonjs/core/Engines/abstractEngine";
import { Constants } from "@babylonjs/core/Engines/constants";
import { LoadAssetContainerAsync } from "@babylonjs/core/Loading/sceneLoader";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import type { Mesh } from "@babylonjs/core/Meshes/mesh";
import { Scene } from "@babylonjs/core/scene";
import { Inspector } from "@babylonjs/inspector";

import { MmdStandardMaterialBuilder } from "@/Loader/mmdStandardMaterialBuilder";
import { PBRMaterialBuilder } from "@/Loader/pbrMaterialBuilder";
import { SdefInjector } from "@/Loader/sdefInjector";
import { StandardMaterialBuilder } from "@/Loader/standardMaterialBuilder";

import type { ISceneBuilder } from "../baseRuntime";
import { CreateDefaultArcRotateCamera } from "../Util/createDefaultArcRotateCamera";
import { CreateDefaultGround } from "../Util/createDefaultGround";
import { CreateLightComponents } from "../Util/createLightComponents";

export class SceneBuilder implements ISceneBuilder {
    public async buildAsync(_canvas: HTMLCanvasElement, engine: AbstractEngine): Promise<Scene> {
        SdefInjector.OverrideEngineCreateEffect(engine);

        const scene = new Scene(engine);
        scene.ambientColor = new Color3(0.5, 0.5, 0.5);
        const camera = CreateDefaultArcRotateCamera(scene);
        camera.radius = 314;
        camera.fov = 0.1;
        camera.minZ = 200;
        camera.alpha = -1.4113;
        camera.beta = 1.3955;
        const { shadowGenerator } = CreateLightComponents(scene, {
            orthoLeftOffset: -18,
            orthoRightOffset: 18,
            orthoTopOffset: 4,
            orthoBottomOffset: -2,
            shadowMaxZOffset: 5
        });
        shadowGenerator.mapSize = 4096;
        shadowGenerator.transparencyShadow = true;
        CreateDefaultGround(scene);

        await Promise.all([
            (async(): Promise<void> => {
                const materialBuilder = new MmdStandardMaterialBuilder();
                materialBuilder.forceDisableAlphaEvaluation = false;
                materialBuilder.loadOutlineRenderingProperties = (): void => { /* do nothing */ };

                const mmdMesh = await LoadAssetContainerAsync(
                    // "res/private_test/model/YYB Delta_M Miku_2.1/delta_M2.0.pmx", // uv morph test model
                    "res/private_test/model/YYB Hatsune Miku_10th/YYB Hatsune Miku_10th_v1.02 - faceforward.pmx",
                    scene,
                    {
                        pluginOptions: {
                            mmdmodel: {
                                materialBuilder: materialBuilder,
                                loggingEnabled: true
                            }
                        }
                    }
                ).then(result => {
                    result.addAllToScene();
                    return result.meshes[0] as Mesh;
                });
                for (const mesh of mmdMesh.metadata.meshes) {
                    mesh.receiveShadows = true;
                    shadowGenerator.addShadowCaster(mesh, false);
                }
                mmdMesh.position.x = -13;
            })(),
            (async(): Promise<void> => {
                const materialBuilder = new StandardMaterialBuilder();

                const mmdMesh = await LoadAssetContainerAsync(
                    "res/private_test/model/YYB Hatsune Miku_10th/YYB Hatsune Miku_10th_v1.02 - faceforward.pmx",
                    scene,
                    {
                        pluginOptions: {
                            mmdmodel: {
                                materialBuilder: materialBuilder,
                                loggingEnabled: true
                            }
                        }
                    }
                ).then(result => {
                    result.addAllToScene();
                    return result.meshes[0] as Mesh;
                });
                for (const mesh of mmdMesh.metadata.meshes) {
                    mesh.receiveShadows = true;
                    shadowGenerator.addShadowCaster(mesh, false);
                }
                mmdMesh.position.x = 0;
            })(),
            (async(): Promise<void> => {
                const materialBuilder = new PBRMaterialBuilder();
                materialBuilder.afterBuildSingleMaterial = (material): void => {
                    material.brdf.dielectricSpecularModel = Constants.MATERIAL_DIELECTRIC_SPECULAR_MODEL_GLTF;
                    material.brdf.conductorSpecularModel = Constants.MATERIAL_CONDUCTOR_SPECULAR_MODEL_GLTF;
                    material.brdf.useLegacySpecularEnergyConservation = true;
                };

                const mmdMesh = await LoadAssetContainerAsync(
                    "res/private_test/model/YYB Hatsune Miku_10th/YYB Hatsune Miku_10th_v1.02 - faceforward.pmx",
                    scene,
                    {
                        pluginOptions: {
                            mmdmodel: {
                                materialBuilder: materialBuilder,
                                loggingEnabled: true
                            }
                        }
                    }
                ).then(result => {
                    result.addAllToScene();
                    return result.meshes[0] as Mesh;
                });
                for (const mesh of mmdMesh.metadata.meshes) {
                    mesh.receiveShadows = true;
                    shadowGenerator.addShadowCaster(mesh, false);
                }
                mmdMesh.position.x = 13;
            })(),
            (async(): Promise<void> => {
                const materialBuilder = new PBRMaterialBuilder();
                materialBuilder.afterBuildSingleMaterial = (material): void => {
                    material.brdf.dielectricSpecularModel = Constants.MATERIAL_DIELECTRIC_SPECULAR_MODEL_OPENPBR;
                    material.brdf.conductorSpecularModel = Constants.MATERIAL_CONDUCTOR_SPECULAR_MODEL_OPENPBR;
                    material.brdf.useLegacySpecularEnergyConservation = false;
                };

                const mmdMesh = await LoadAssetContainerAsync(
                    "res/private_test/model/YYB Hatsune Miku_10th/YYB Hatsune Miku_10th_v1.02 - faceforward.pmx",
                    scene,
                    {
                        pluginOptions: {
                            mmdmodel: {
                                materialBuilder: materialBuilder,
                                loggingEnabled: true
                            }
                        }
                    }
                ).then(result => {
                    result.addAllToScene();
                    return result.meshes[0] as Mesh;
                });
                for (const mesh of mmdMesh.metadata.meshes) {
                    mesh.receiveShadows = true;
                    shadowGenerator.addShadowCaster(mesh, false);
                }
                mmdMesh.position.x = 13 * 2;
            })()
        ]);

        scene.createDefaultEnvironment({
            createGround: false
        });

        Inspector.Show(scene, { enablePopup: false });

        return scene;
    }
}
