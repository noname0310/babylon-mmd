import "@babylonjs/core/Loading/loadingScreen";
import "@/Loader/Optimized/bpmxLoader";
import "@/Loader/mmdOutlineRenderer";
import "@/Runtime/Optimized/Animation/mmdWasmRuntimeModelAnimation";

import type { AbstractEngine } from "@babylonjs/core/Engines/abstractEngine";
import { LoadAssetContainerAsync } from "@babylonjs/core/Loading/sceneLoader";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { Mesh } from "@babylonjs/core/Meshes/mesh";
import { Scene } from "@babylonjs/core/scene";
import { Inspector } from "@babylonjs/inspector";

import { SdefInjector } from "@/Loader/sdefInjector";
import { VmdLoader } from "@/Loader/vmdLoader";
import { MmdWasmAnimation } from "@/Runtime/Optimized/Animation/mmdWasmAnimation";
import { MmdWasmInstanceTypeMPD } from "@/Runtime/Optimized/InstanceType/multiPhysicsDebug";
import { getMmdWasmInstance } from "@/Runtime/Optimized/mmdWasmInstance";
import { MmdWasmRuntime, MmdWasmRuntimeAnimationEvaluationType } from "@/Runtime/Optimized/mmdWasmRuntime";
import { MmdWasmPhysics } from "@/Runtime/Optimized/Physics/mmdWasmPhysics";

import type { ISceneBuilder } from "../baseRuntime";
import { createDefaultArcRotateCamera } from "../Util/createDefaultArcRotateCamera";
import { createDefaultGround } from "../Util/createDefaultGround";
import { createLightComponents } from "../Util/createLightComponents";

export class SceneBuilder implements ISceneBuilder {
    public async build(_canvas: HTMLCanvasElement, engine: AbstractEngine): Promise<Scene> {
        SdefInjector.OverrideEngineCreateEffect(engine);

        const scene = new Scene(engine);
        scene.ambientColor = new Color3(0.5, 0.5, 0.5);
        const camera = createDefaultArcRotateCamera(scene);
        camera.setTarget(new Vector3(-1.3261749447410947, 11.691760759222726, -0.31660869989471035));
        camera.alpha = -0.9561;
        camera.beta = 1.0432;
        camera.radius = 12.3586;
        const { shadowGenerator } = createLightComponents(scene);
        shadowGenerator.transparencyShadow = true;
        createDefaultGround(scene);

        const mmdMesh = await LoadAssetContainerAsync(
            "res/private_test/model/YYB Hatsune Miku_10th.bpmx",
            scene,
            {
                pluginOptions: {
                    mmdmodel: {
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

        const mmdWasmInstance = await getMmdWasmInstance(new MmdWasmInstanceTypeMPD());
        const mmdRuntime = new MmdWasmRuntime(mmdWasmInstance, scene, new MmdWasmPhysics(scene));
        mmdRuntime.loggingEnabled = true;
        mmdRuntime.register(scene);
        mmdRuntime.evaluationType = MmdWasmRuntimeAnimationEvaluationType.Buffered;

        const mmdModel = mmdRuntime.createMmdModel(mmdMesh, {
            buildPhysics: false //{ disableOffsetForConstraintFrame: true }
        });

        const vmdLoader = new VmdLoader(scene);
        vmdLoader.loggingEnabled = true;
        const animation = await vmdLoader.loadAsync("motion", "res/motion/physics_toggle_test_yyb10th.vmd");
        const wasmAnimation = new MmdWasmAnimation(animation, mmdWasmInstance, scene);
        mmdModel.addAnimation(wasmAnimation);
        mmdModel.setAnimation("motion");

        mmdRuntime.playAnimation();
        mmdRuntime.onPauseAnimationObservable.add(() => {
            if (mmdRuntime.animationFrameTimeDuration === mmdRuntime.currentFrameTime) {
                mmdRuntime.seekAnimation(0);
                mmdRuntime.playAnimation().then(() => {
                    mmdRuntime.initializeAllMmdModelsPhysics(true);
                });
            }
        });

        Inspector.Show(scene, { });

        return scene;
    }
}
