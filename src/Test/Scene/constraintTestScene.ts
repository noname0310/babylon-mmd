import "@babylonjs/core/Loading/loadingScreen";
import "@/Loader/pmxLoader";
import "@/Loader/mmdOutlineRenderer";

import { PhysicsViewer } from "@babylonjs/core/Debug/physicsViewer";
import { SkeletonViewer } from "@babylonjs/core/Debug/skeletonViewer";
import type { AbstractEngine } from "@babylonjs/core/Engines/abstractEngine";
import { LoadAssetContainerAsync } from "@babylonjs/core/Loading/sceneLoader";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { Mesh } from "@babylonjs/core/Meshes/mesh";
import type { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { Scene } from "@babylonjs/core/scene";
import { Inspector } from "@babylonjs/inspector";

import { MmdStandardMaterialBuilder } from "@/Loader/mmdStandardMaterialBuilder";
import { SdefInjector } from "@/Loader/sdefInjector";
import { MmdWasmInstanceTypeMPD } from "@/Runtime/Optimized/InstanceType/multiPhysicsDebug";
import { getMmdWasmInstance } from "@/Runtime/Optimized/mmdWasmInstance";
import { MmdWasmRuntime } from "@/Runtime/Optimized/mmdWasmRuntime";
import ammo from "@/Runtime/Physics/External/ammo.wasm";
import { MmdAmmoJSPlugin } from "@/Runtime/Physics/mmdAmmoJSPlugin";
import { MmdAmmoPhysics } from "@/Runtime/Physics/mmdAmmoPhysics";

import type { ISceneBuilder } from "../baseRuntime";
import { createDefaultArcRotateCamera } from "../Util/createDefaultArcRotateCamera";
import { createDefaultGround } from "../Util/createDefaultGround";
import { createLightComponents } from "../Util/createLightComponents";

export class SceneBuilder implements ISceneBuilder {
    public async build(_canvas: HTMLCanvasElement, engine: AbstractEngine): Promise<Scene> {
        SdefInjector.OverrideEngineCreateEffect(engine);

        // materialBuilder.alphaEvaluationResolution = 2048;
        const scene = new Scene(engine);
        scene.ambientColor = new Color3(0.5, 0.5, 0.5);
        const camera = createDefaultArcRotateCamera(scene);
        camera.target.set(-0.817, 15.373, -0.859);
        camera.alpha = -0.0552;
        camera.beta = 1.3703;
        camera.radius = 11.7531;
        const { shadowGenerator } = createLightComponents(scene);
        createDefaultGround(scene);

        const materialBuilder = new MmdStandardMaterialBuilder();
        materialBuilder.forceDisableAlphaEvaluation = false;

        const mmdMesh = await LoadAssetContainerAsync(
            "res/private_test/model/Hades/Hades.pmx",
            scene,
            {
                pluginOptions: {
                    pmxmodel: {
                        materialBuilder: materialBuilder,
                        loggingEnabled: true
                    }
                }
            }
        ).then(result => {
            result.addAllToScene();
            return result.meshes[0] as Mesh;
        });
        // mmdMesh.scaling.scaleInPlace(5);
        for (const mesh of mmdMesh.metadata.meshes) {
            mesh.receiveShadows = true;
            shadowGenerator.addShadowCaster(mesh, false);
        }

        const mmdMesh2 = await LoadAssetContainerAsync(
            "res/private_test/model/yyb_deep_canyons_miku/yyb_deep_canyons_miku_face_forward_bakebone.pmx",
            scene,
            {
                pluginOptions: {
                    pmxmodel: {
                        materialBuilder: materialBuilder,
                        loggingEnabled: true
                    }
                }
            }
        ).then(result => {
            result.addAllToScene();
            return result.meshes[0] as Mesh;
        });
        mmdMesh2.position.set(10, 0, 0);
        for (const mesh of mmdMesh2.metadata.meshes) {
            mesh.receiveShadows = true;
            shadowGenerator.addShadowCaster(mesh, false);
        }

        const physicsInstance = await ammo();
        const physicsPlugin = new MmdAmmoJSPlugin(true, physicsInstance);
        physicsPlugin.forceDisableOffsetForConstraintFrame = true;
        scene.enablePhysics(new Vector3(0, -98, 0), physicsPlugin);

        const mmdWasmInstance = await getMmdWasmInstance(new MmdWasmInstanceTypeMPD());
        const mmdRuntime = new MmdWasmRuntime(mmdWasmInstance, scene, new MmdAmmoPhysics(scene));
        mmdRuntime.loggingEnabled = true;
        mmdRuntime.register(scene);
        mmdRuntime.createMmdModel(mmdMesh);
        mmdRuntime.createMmdModel(mmdMesh2);

        Inspector.Show(scene, { });

        {
            const physicsViewer = new PhysicsViewer(scene);
            for (const node of mmdMesh.getChildren()) {
                if ((node as TransformNode).physicsBody) {
                    physicsViewer.showBody((node as TransformNode).physicsBody!);
                }
            }
        }

        const skeletionViewer = new SkeletonViewer(mmdMesh.metadata.skeleton, mmdMesh, scene, false, 3, {
            displayMode: SkeletonViewer.DISPLAY_SPHERE_AND_SPURS
        });
        skeletionViewer.isEnabled = false;

        return scene;
    }
}
