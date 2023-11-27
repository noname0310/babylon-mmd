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
import { Color3, Color4 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { Mesh } from "@babylonjs/core/Meshes/mesh";
import { Tools } from "@babylonjs/core/Misc/tools";
import { HavokPlugin } from "@babylonjs/core/Physics/v2/Plugins/havokPlugin";
import { DefaultRenderingPipeline } from "@babylonjs/core/PostProcesses/RenderPipeline/Pipelines/defaultRenderingPipeline";
import { Scene } from "@babylonjs/core/scene";
import havokPhysics from "@babylonjs/havok";

// import { Inspector } from "@babylonjs/inspector";
import type { MmdStandardMaterialBuilder } from "@/Loader/mmdStandardMaterialBuilder";
import type { BpmxLoader } from "@/Loader/Optimized/bpmxLoader";
import { SdefInjector } from "@/Loader/sdefInjector";
import { MmdPhysics } from "@/Runtime/mmdPhysics";
import { MmdRuntime } from "@/Runtime/mmdRuntime";

import type { ISceneBuilder } from "../baseRuntime";
import { attachToBone } from "../Util/attachToBone";
import { createDefaultArcRotateCamera } from "../Util/createDefaultArcRotateCamera";
import { createDefaultGround } from "../Util/createDefaultGround";
import { createLightComponents } from "../Util/createLightComponents";
import { optimizeScene } from "../Util/optimizeScene";
import { parallelLoadAsync } from "../Util/parallelLoadAsync";

export class SceneBuilder implements ISceneBuilder {
    public async build(_canvas: HTMLCanvasElement, engine: Engine): Promise<Scene> {
        SdefInjector.OverrideEngineCreateEffect(engine);
        const pmxLoader = SceneLoader.GetPluginForExtension(".bpmx") as BpmxLoader;
        pmxLoader.loggingEnabled = true;
        const materialBuilder = pmxLoader.materialBuilder as MmdStandardMaterialBuilder;
        materialBuilder.loadOutlineRenderingProperties = (): void => { /* do nothing */ };

        const scene = new Scene(engine);
        scene.ambientColor = new Color3(1, 1, 1);
        scene.clearColor = new Color4(0.95, 0.95, 0.95, 1.0);
        const camera = createDefaultArcRotateCamera(scene);
        const { directionalLight, shadowGenerator } = createLightComponents(scene);
        createDefaultGround(scene);

        const mmdRuntime = new MmdRuntime(new MmdPhysics(scene));
        mmdRuntime.loggingEnabled = true;
        mmdRuntime.register(scene);

        const [ modelMesh ] = await parallelLoadAsync(scene, [
            ["model", (updateProgress): Promise<Mesh> => {
                pmxLoader.boundingBoxMargin = 60;
                return SceneLoader.ImportMeshAsync(
                    undefined,
                    "res/private_test/model/",
                    "YYB Hatsune Miku_10th.bpmx",
                    scene,
                    updateProgress
                ).then(result => result.meshes[0] as Mesh);
            }],
            ["physics", async(updateProgress): Promise<void> => {
                updateProgress({ lengthComputable: true, loaded: 0, total: 1 });
                const havokInstance = await havokPhysics();
                const havokPlugin = new HavokPlugin(true, havokInstance);
                scene.enablePhysics(new Vector3(0, -9.8 * 10, 0), havokPlugin);
                updateProgress({ lengthComputable: true, loaded: 1, total: 1 });
            }]
        ]);

        {
            const animationJson = await Tools.LoadFileAsync("res/motion/walk_in_circle.babylonanim", false)
                .then((data) => JSON.parse(data as string));
            const animation = AnimationGroup.Parse(animationJson, scene);
            animation.play(true);
        }

        {
            shadowGenerator.addShadowCaster(modelMesh);
            modelMesh.receiveShadows = true;

            const mmdModel = mmdRuntime.createMmdModel(modelMesh, {
                buildPhysics: true
            });
            mmdModel.ikSolverStates.fill(0); // disable ik

            attachToBone(scene, mmdModel, {
                directionalLightPosition: directionalLight.position,
                cameraTargetPosition: camera.target
            });
            scene.onAfterRenderObservable.addOnce(() => optimizeScene(scene));

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
