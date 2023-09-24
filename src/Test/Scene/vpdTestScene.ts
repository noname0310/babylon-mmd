import "@babylonjs/core/Loading/loadingScreen";
import "@/Loader/Optimized/bpmxLoader";
import "@/Runtime/Animation/mmdRuntimeModelAnimation";

import type { Engine } from "@babylonjs/core/Engines/engine";
import { SceneLoader } from "@babylonjs/core/Loading/sceneLoader";
import { ImageProcessingConfiguration } from "@babylonjs/core/Materials/imageProcessingConfiguration";
import { Color4 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { Mesh } from "@babylonjs/core/Meshes/mesh";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { HavokPlugin } from "@babylonjs/core/Physics/v2/Plugins/havokPlugin";
import { DefaultRenderingPipeline } from "@babylonjs/core/PostProcesses/RenderPipeline/Pipelines/defaultRenderingPipeline";
import { Scene } from "@babylonjs/core/scene";
import HavokPhysics from "@babylonjs/havok";

import type { MmdAnimation } from "@/Loader/Animation/mmdAnimation";
import type { MmdStandardMaterialBuilder } from "@/Loader/mmdStandardMaterialBuilder";
import type { BpmxLoader } from "@/Loader/Optimized/bpmxLoader";
import { SdefInjector } from "@/Loader/sdefInjector";
import { VpdLoader } from "@/Loader/vpdLoader";
import { MmdPhysics } from "@/Runtime/mmdPhysics";
import { MmdRuntime } from "@/Runtime/mmdRuntime";

import type { ISceneBuilder } from "../baseRuntime";
import { createDefaultArcRotateCamera } from "../Util/createDefaultArcRotateCamera";
import { createDefaultGround } from "../Util/createDefaultGround";
import { createLightComponents } from "../Util/createLightComponents";
import { attachToBone } from "../Util/attachToBone";
import { optimizeScene } from "../Util/optimizeScene";

export class SceneBuilder implements ISceneBuilder {
    public async build(_canvas: HTMLCanvasElement, engine: Engine): Promise<Scene> {
        SdefInjector.OverrideEngineCreateEffect(engine);
        const pmxLoader = SceneLoader.GetPluginForExtension(".bpmx") as BpmxLoader;
        pmxLoader.loggingEnabled = true;
        const materialBuilder = pmxLoader.materialBuilder as MmdStandardMaterialBuilder;
        materialBuilder.loadOutlineRenderingProperties = (): void => { /* do nothing */ };

        const scene = new Scene(engine);
        scene.clearColor = new Color4(0.95, 0.95, 0.95, 1.0);
        scene.autoClearDepthAndStencil = false;

        const worldScale = 1;

        const mmdRoot = new TransformNode("mmdRoot", scene);
        mmdRoot.scaling.scaleInPlace(worldScale);
        const camera = createDefaultArcRotateCamera(scene);
        camera.parent = mmdRoot;
        const { directionalLight, shadowGenerator } = createLightComponents(scene, { worldScale });
        const ground = createDefaultGround(scene);
        ground.parent = mmdRoot;

        const mmdRuntime = new MmdRuntime(new MmdPhysics(scene));
        mmdRuntime.loggingEnabled = true;

        mmdRuntime.register(scene);

        engine.displayLoadingUI();

        let loadingTexts: string[] = [];
        const updateLoadingText = (updateIndex: number, text: string): void => {
            loadingTexts[updateIndex] = text;
            engine.loadingUIText = "<br/><br/><br/><br/>" + loadingTexts.join("<br/><br/>");
        };

        const promises: Promise<any>[] = [];

        const vpdLoader = new VpdLoader(scene);
        vpdLoader.loggingEnabled = true;

        promises.push(vpdLoader.loadAsync("motion", "res/private_test/motion/test_pose1.vpd",
            (event) => updateLoadingText(0, `Loading motion... ${event.loaded}/${event.total} (${Math.floor(event.loaded * 100 / event.total)}%)`))
        );

        pmxLoader.boundingBoxMargin = 60;
        promises.push(SceneLoader.ImportMeshAsync(
            undefined,
            "res/private_test/model/",
            "YYB Hatsune Miku_10th.bpmx",
            scene,
            (event) => updateLoadingText(1, `Loading model... ${event.loaded}/${event.total} (${Math.floor(event.loaded * 100 / event.total)}%)`)
        ));

        promises.push((async(): Promise<HavokPlugin> => {
            updateLoadingText(2, "Loading physics engine...");
            const havokInstance = await HavokPhysics();
            const havokPlugin = new HavokPlugin(true, havokInstance);
            scene.enablePhysics(new Vector3(0, -9.8 * 10 * worldScale, 0), havokPlugin);
            updateLoadingText(2, "Loading physics engine... Done");
            return havokPlugin;
        })());

        loadingTexts = new Array(promises.length).fill("");
        const loadResults = await Promise.all(promises);

        scene.onAfterRenderObservable.addOnce(() => engine.hideLoadingUI());

        const modelMesh = loadResults[1].meshes[0] as Mesh;
        shadowGenerator.addShadowCaster(modelMesh);
        modelMesh.receiveShadows = true;
        modelMesh.parent = mmdRoot;

        const mmdModel = mmdRuntime.createMmdModel(modelMesh, {
            buildPhysics: true
        });
        mmdModel.addAnimation(loadResults[0] as MmdAnimation);
        mmdModel.setAnimation("motion");
        mmdModel.currentAnimation!.animate(0);
        mmdModel.initializePhysics();
        
        attachToBone(scene, modelMesh, directionalLight.position, camera.target);
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
            (loadResults[2] as HavokPlugin).dispose();
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
