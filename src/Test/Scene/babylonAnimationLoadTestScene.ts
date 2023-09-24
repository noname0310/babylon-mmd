import "@babylonjs/core/Animations/animatable";
import "@babylonjs/core/Loading/loadingScreen";
import "@babylonjs/core/Rendering/depthRendererSceneComponent";
import "@babylonjs/loaders/glTF/2.0/glTFLoader";
import "@/Loader/Optimized/bpmxLoader";
import "@/Runtime/Animation/mmdRuntimeCameraAnimation";
import "@/Runtime/Animation/mmdRuntimeModelAnimation";

import { AnimationGroup } from "@babylonjs/core/Animations/animationGroup";
import { SkeletonViewer } from "@babylonjs/core/Debug/skeletonViewer";
import type { Engine } from "@babylonjs/core/Engines/engine";
import { SceneLoader } from "@babylonjs/core/Loading/sceneLoader";
import { ImageProcessingConfiguration } from "@babylonjs/core/Materials/imageProcessingConfiguration";
import { Color4 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { Mesh } from "@babylonjs/core/Meshes/mesh";
import { Tools } from "@babylonjs/core/Misc/tools";
import { HavokPlugin } from "@babylonjs/core/Physics/v2/Plugins/havokPlugin";
import { DefaultRenderingPipeline } from "@babylonjs/core/PostProcesses/RenderPipeline/Pipelines/defaultRenderingPipeline";
import { Scene } from "@babylonjs/core/scene";
import HavokPhysics from "@babylonjs/havok";

// import { Inspector } from "@babylonjs/inspector";
import type { MmdStandardMaterialBuilder } from "@/Loader/mmdStandardMaterialBuilder";
import type { BpmxLoader } from "@/Loader/Optimized/bpmxLoader";
import { SdefInjector } from "@/Loader/sdefInjector";
import { MmdPhysics } from "@/Runtime/mmdPhysics";
import { MmdRuntime } from "@/Runtime/mmdRuntime";

import type { ISceneBuilder } from "../baseRuntime";
import { createDefaultArcRotateCamera } from "../Util/createDefaultArcRotateCamera";
import { createDefaultGround } from "../Util/createDefaultGround";
import { createLightComponents } from "../Util/createLightComponents";
import { attachToBone } from "../Util/attachToBone";

export class SceneBuilder implements ISceneBuilder {
    public async build(_canvas: HTMLCanvasElement, engine: Engine): Promise<Scene> {
        SdefInjector.OverrideEngineCreateEffect(engine);
        const pmxLoader = SceneLoader.GetPluginForExtension(".bpmx") as BpmxLoader;
        pmxLoader.loggingEnabled = true;
        const materialBuilder = pmxLoader.materialBuilder as MmdStandardMaterialBuilder;
        materialBuilder.loadOutlineRenderingProperties = (): void => { /* do nothing */ };

        const scene = new Scene(engine);
        scene.clearColor = new Color4(0.95, 0.95, 0.95, 1.0);
        const camera = createDefaultArcRotateCamera(scene);
        const { directionalLight, shadowGenerator } = createLightComponents(scene);
        createDefaultGround(scene);

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

        pmxLoader.boundingBoxMargin = 60;
        promises.push(SceneLoader.ImportMeshAsync(
            undefined,
            "res/private_test/model/",
            "YYB Hatsune Miku_10th.bpmx",
            scene,
            (event) => updateLoadingText(1, `Loading model... ${event.loaded}/${event.total} (${Math.floor(event.loaded * 100 / event.total)}%)`)
        ));

        promises.push((async(): Promise<void> => {
            updateLoadingText(2, "Loading physics engine...");
            const havokInstance = await HavokPhysics();
            const havokPlugin = new HavokPlugin(true, havokInstance);
            scene.enablePhysics(new Vector3(0, -9.8 * 10, 0), havokPlugin);
            updateLoadingText(2, "Loading physics engine... Done");
        })());

        loadingTexts = new Array(promises.length).fill("");

        const loadResults = await Promise.all(promises);
        scene.onAfterRenderObservable.addOnce(() => engine.hideLoadingUI());

        {
            const animationJson = await Tools.LoadFileAsync("res/motion/walk_in_circle.babylonanim", false)
                .then((data) => JSON.parse(data as string));
            const animation = AnimationGroup.Parse(animationJson, scene);
            animation.play(true);
        }

        {
            const modelMesh = loadResults[0].meshes[0] as Mesh;

            shadowGenerator.addShadowCaster(modelMesh);
            modelMesh.receiveShadows = true;

            const mmdModel = mmdRuntime.createMmdModel(modelMesh, {
                buildPhysics: true
            });

            const runtimeBones = mmdModel.sortedRuntimeBones;
            for (let i = 0; i < runtimeBones.length; ++i) {
                const ikSolver = runtimeBones[i].ikSolver;
                if (ikSolver !== null) ikSolver.enabled = false;
            }

            attachToBone(scene, modelMesh, directionalLight.position, camera.target);

            const viewer = new SkeletonViewer(modelMesh.skeleton!, modelMesh, scene, false, 3, {
                displayMode: SkeletonViewer.DISPLAY_SPHERE_AND_SPURS
            });
            viewer.isEnabled = false;
        }

        const defaultPipeline = new DefaultRenderingPipeline("default", true, scene);
        defaultPipeline.samples = 4;
        defaultPipeline.bloomEnabled = true;
        defaultPipeline.fxaaEnabled = true;
        defaultPipeline.imageProcessingEnabled = true;
        defaultPipeline.imageProcessing.toneMappingEnabled = true;
        defaultPipeline.imageProcessing.toneMappingType = ImageProcessingConfiguration.TONEMAPPING_ACES;
        defaultPipeline.imageProcessing.vignetteWeight = 0.5;
        defaultPipeline.imageProcessing.vignetteStretch = 0.5;
        defaultPipeline.imageProcessing.vignetteColor = new Color4(0, 0, 0, 0);
        defaultPipeline.imageProcessing.vignetteEnabled = true;

        // Inspector.Show(scene, { });

        return scene;
    }
}
