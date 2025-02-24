import "@babylonjs/core/Loading/loadingScreen";
import "@/Loader/Optimized/bpmxLoader";
import "@/Runtime/Animation/mmdRuntimeModelAnimation";

import type { AbstractEngine } from "@babylonjs/core/Engines/abstractEngine";
import { LoadAssetContainerAsync } from "@babylonjs/core/Loading/sceneLoader";
import { ImageProcessingConfiguration } from "@babylonjs/core/Materials/imageProcessingConfiguration";
import { Color4 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { HavokPlugin } from "@babylonjs/core/Physics/v2/Plugins/havokPlugin";
import { DefaultRenderingPipeline } from "@babylonjs/core/PostProcesses/RenderPipeline/Pipelines/defaultRenderingPipeline";
import { Scene } from "@babylonjs/core/scene";
import havokPhysics from "@babylonjs/havok";

import type { MmdAnimation } from "@/Loader/Animation/mmdAnimation";
import { MmdStandardMaterialBuilder } from "@/Loader/mmdStandardMaterialBuilder";
import { SdefInjector } from "@/Loader/sdefInjector";
import { VpdLoader } from "@/Loader/vpdLoader";
import type { MmdMesh } from "@/Runtime/mmdMesh";
import { MmdRuntime } from "@/Runtime/mmdRuntime";
import { MmdPhysics } from "@/Runtime/Physics/mmdPhysics";

import type { ISceneBuilder } from "../baseRuntime";
import { attachToBone } from "../Util/attachToBone";
import { createDefaultArcRotateCamera } from "../Util/createDefaultArcRotateCamera";
import { createDefaultGround } from "../Util/createDefaultGround";
import { createLightComponents } from "../Util/createLightComponents";
import { optimizeScene } from "../Util/optimizeScene";
import { parallelLoadAsync } from "../Util/parallelLoadAsync";

export class SceneBuilder implements ISceneBuilder {
    public async build(_canvas: HTMLCanvasElement, engine: AbstractEngine): Promise<Scene> {
        SdefInjector.OverrideEngineCreateEffect(engine);
        engine.compatibilityMode = false;
        engine.snapshotRendering = true;

        const scene = new Scene(engine);
        scene.clearColor = new Color4(0.95, 0.95, 0.95, 1.0);
        scene.autoClearDepthAndStencil = false;

        const worldScale = 1;

        const mmdRoot = new TransformNode("mmdRoot", scene);
        mmdRoot.scaling.scaleInPlace(worldScale);
        const camera = createDefaultArcRotateCamera(scene);
        camera.parent = mmdRoot;
        const { directionalLight, shadowGenerator } = createLightComponents(scene, { worldScale });
        shadowGenerator.transparencyShadow = true;
        const ground = createDefaultGround(scene);
        ground.parent = mmdRoot;

        const mmdRuntime = new MmdRuntime(scene, new MmdPhysics(scene));
        mmdRuntime.loggingEnabled = true;

        mmdRuntime.register(scene);

        const materialBuilder = new MmdStandardMaterialBuilder();
        materialBuilder.loadOutlineRenderingProperties = (): void => { /* do nothing */ };

        const [
            mmdAnimation,
            modelMesh,
            havokPlugin
        ] = await parallelLoadAsync(scene, [
            ["motion", (updateProgress): Promise<MmdAnimation> => {
                const vpdLoader = new VpdLoader(scene);
                vpdLoader.loggingEnabled = true;
                return vpdLoader.loadAsync("motion", "res/private_test/motion/test_pose1.vpd", updateProgress);
            }],
            ["model", (updateProgress): Promise<MmdMesh> => LoadAssetContainerAsync(
                "res/private_test/model/YYB Hatsune Miku_10th.bpmx",
                scene,
                {
                    onProgress: updateProgress,
                    pluginOptions: {
                        bpmxmodel: {
                            materialBuilder: materialBuilder,
                            loggingEnabled: true
                        }
                    }
                }
            ).then(result => {
                result.addAllToScene();
                return result.meshes[0] as MmdMesh;
            })],
            ["physics", async(updateProgress): Promise<HavokPlugin> => {
                updateProgress({ lengthComputable: true, loaded: 0, total: 1 });
                const havokInstance = await havokPhysics();
                const havokPlugin = new HavokPlugin(true, havokInstance);
                scene.enablePhysics(new Vector3(0, -9.8 * 10 * worldScale, 0), havokPlugin);
                updateProgress({ lengthComputable: true, loaded: 1, total: 1 });
                return havokPlugin;
            }]
        ]);

        for (const mesh of modelMesh.metadata.meshes) {
            mesh.receiveShadows = true;
            shadowGenerator.addShadowCaster(mesh, false);
        }
        modelMesh.parent = mmdRoot;

        const mmdModel = mmdRuntime.createMmdModel(modelMesh, {
            buildPhysics: true
        });
        mmdModel.addAnimation(mmdAnimation);
        mmdModel.setAnimation("motion");
        mmdModel.currentAnimation!.animate(0);
        mmdRuntime.initializeMmdModelPhysics(mmdModel);

        attachToBone(scene, mmdModel, {
            directionalLightPosition: directionalLight.position,
            cameraTargetPosition: camera.target
        });
        scene.onAfterRenderObservable.addOnce(() => optimizeScene(scene));

        let computedFrames = 0;
        const delayedDispose = (): void => {
            computedFrames += 1;

            if (computedFrames < 180) {
                return;
            }

            scene.onAfterRenderObservable.removeCallback(delayedDispose);
            mmdRuntime.destroyMmdModel(mmdModel);

            scene.physicsEnabled = false;
            havokPlugin.dispose();
        };

        scene.onAfterRenderObservable.add(delayedDispose);

        const defaultPipeline = new DefaultRenderingPipeline("default", true, scene);
        defaultPipeline.samples = 4;
        defaultPipeline.bloomEnabled = true;
        defaultPipeline.chromaticAberrationEnabled = true;
        defaultPipeline.chromaticAberration.aberrationAmount = 1;
        defaultPipeline.depthOfFieldEnabled = false;
        defaultPipeline.fxaaEnabled = true;
        defaultPipeline.imageProcessingEnabled = true;
        defaultPipeline.imageProcessing.toneMappingEnabled = true;
        defaultPipeline.imageProcessing.toneMappingType = ImageProcessingConfiguration.TONEMAPPING_ACES;
        defaultPipeline.imageProcessing.vignetteWeight = 0.5;
        defaultPipeline.imageProcessing.vignetteStretch = 0.5;
        defaultPipeline.imageProcessing.vignetteColor = new Color4(0, 0, 0, 0);
        defaultPipeline.imageProcessing.vignetteEnabled = true;

        return scene;
    }
}
