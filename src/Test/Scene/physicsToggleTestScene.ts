import "@babylonjs/core/Loading/loadingScreen";
import "@/Loader/Optimized/bpmxLoader";
import "@/Loader/mmdOutlineRenderer";
import "@/Runtime/Optimized/Animation/mmdWasmRuntimeModelAnimation";
import "@/Runtime/Animation/mmdRuntimeModelAnimation";

import { PhysicsViewer } from "@babylonjs/core/Debug/physicsViewer";
import type { AbstractEngine } from "@babylonjs/core/Engines/abstractEngine";
import { LoadAssetContainerAsync } from "@babylonjs/core/Loading/sceneLoader";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { Mesh } from "@babylonjs/core/Meshes/mesh";
import type { TransformNode } from "@babylonjs/core/Meshes/transformNode";
// import { HavokPlugin } from "@babylonjs/core/Physics/v2/Plugins/havokPlugin";
import { Scene } from "@babylonjs/core/scene";
// import { MmdWasmRuntime, MmdWasmRuntimeAnimationEvaluationType } from "@/Runtime/Optimized/mmdWasmRuntime";
// import ammo from "@/Runtime/Physics/External/ammo.wasm";
// import havok from "@babylonjs/havok";
import { Inspector } from "@babylonjs/inspector";

import { SdefInjector } from "@/Loader/sdefInjector";
import { VmdLoader } from "@/Loader/vmdLoader";
import { MmdRuntime } from "@/Runtime/mmdRuntime";
// import { MmdRuntime } from "@/Runtime/mmdRuntime";
import { MmdWasmAnimation } from "@/Runtime/Optimized/Animation/mmdWasmAnimation";
import { MmdWasmInstanceTypeMPD } from "@/Runtime/Optimized/InstanceType/multiPhysicsDebug";
import { GetMmdWasmInstance } from "@/Runtime/Optimized/mmdWasmInstance";
// import { MmdWasmRuntime, MmdWasmRuntimeAnimationEvaluationType } from "@/Runtime/Optimized/mmdWasmRuntime";
import { MultiPhysicsRuntime } from "@/Runtime/Optimized/Physics/Bind/Impl/multiPhysicsRuntime";
import { PhysicsRuntimeEvaluationType } from "@/Runtime/Optimized/Physics/Bind/Impl/physicsRuntimeEvaluationType";
import { MmdBulletPhysics } from "@/Runtime/Optimized/Physics/mmdBulletPhysics";

// import { MmdAmmoJSPlugin } from "@/Runtime/Physics/mmdAmmoJSPlugin";
// import { MmdAmmoPhysics } from "@/Runtime/Physics/mmdAmmoPhysics";
// import { MmdPhysics } from "@/Runtime/Physics/mmdPhysics";
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
        camera.setTarget(new Vector3(-2.407, 12.693, -3.052));
        camera.alpha = 0.1949;
        camera.beta = 1.1959;
        camera.radius = 8.1936;
        const { shadowGenerator } = CreateLightComponents(scene);
        shadowGenerator.transparencyShadow = true;
        CreateDefaultGround(scene);

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

        // const physicsInstance = await havok();
        // const physicsPlugin = new HavokPlugin(true, physicsInstance);
        // scene.enablePhysics(new Vector3(0, -9.8 * 10, 0), physicsPlugin);

        const mmdWasmInstance = await GetMmdWasmInstance(new MmdWasmInstanceTypeMPD());
        const physicsRuntime = new MultiPhysicsRuntime(mmdWasmInstance);
        physicsRuntime.evaluationType = PhysicsRuntimeEvaluationType.Immediate;
        physicsRuntime.setGravity(new Vector3(0, -9.8 * 10, 0));
        physicsRuntime.register(scene);
        const mmdRuntime = new MmdRuntime(scene, new MmdBulletPhysics(physicsRuntime));
        // mmdRuntime.evaluationType = MmdWasmRuntimeAnimationEvaluationType.Immediate;
        mmdRuntime.loggingEnabled = true;
        mmdRuntime.register(scene);
        // mmdRuntime.evaluationType = MmdWasmRuntimeAnimationEvaluationType.Buffered;

        // mmdMesh.position.x = 10;
        const mmdModel = mmdRuntime.createMmdModel(mmdMesh, {
            buildPhysics: true
        });

        const vmdLoader = new VmdLoader(scene);
        vmdLoader.loggingEnabled = true;
        const animation = await vmdLoader.loadAsync("motion", [
            "res/motion/physics_toggle_test_yyb10th.vmd"
        ]);
        const wasmAnimation = new MmdWasmAnimation(animation, mmdWasmInstance, scene);
        wasmAnimation;
        mmdModel.addAnimation(wasmAnimation);
        mmdModel.setAnimation("motion");

        mmdRuntime.playAnimation();
        mmdRuntime.onPauseAnimationObservable.add(() => {
            if (mmdRuntime.animationFrameTimeDuration === mmdRuntime.currentFrameTime) {
                mmdRuntime.seekAnimation(0);
                mmdRuntime.playAnimation();
            }
        });
        // mmdRuntime.seekAnimation(80, true);

        {
            const physicsViewer = new PhysicsViewer(scene);
            for (const node of mmdMesh.getChildren()) {
                if ((node as TransformNode).physicsBody) {
                    physicsViewer.showBody((node as TransformNode).physicsBody!);
                }
                if ((node as Mesh).physicsImpostor) {
                    physicsViewer.showImpostor((node as Mesh).physicsImpostor!);
                }
            }
        }

        Inspector.Show(scene, { });

        return scene;
    }
}
