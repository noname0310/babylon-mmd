import "@babylonjs/core/Loading/loadingScreen";
import "@/Loader/pmxLoader";

import type { AbstractEngine } from "@babylonjs/core/Engines/abstractEngine";
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
import { createDefaultArcRotateCamera } from "../Util/createDefaultArcRotateCamera";
import { createDefaultGround } from "../Util/createDefaultGround";
import { createLightComponents } from "../Util/createLightComponents";

export class SceneBuilder implements ISceneBuilder {
    public async build(_canvas: HTMLCanvasElement, engine: AbstractEngine): Promise<Scene> {
        SdefInjector.OverrideEngineCreateEffect(engine);

        const scene = new Scene(engine);
        scene.ambientColor = new Color3(0.5, 0.5, 0.5);
        createDefaultArcRotateCamera(scene);
        const { shadowGenerator } = createLightComponents(scene, {
            orthoLeftOffset: -10,
            orthoRightOffset: 10,
            orthoTopOffset: 2,
            shadowMaxZOffset: 5
        });
        shadowGenerator.transparencyShadow = true;
        createDefaultGround(scene);

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
                mmdMesh.position.x = -8;
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
                mmdMesh.position.x = 8;
            })()
        ]);

        scene.createDefaultEnvironment({
            createGround: false
        });

        Inspector.Show(scene, { enablePopup: false });

        return scene;
    }
}
