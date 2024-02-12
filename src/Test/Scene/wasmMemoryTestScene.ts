import "@babylonjs/core/Loading/loadingScreen";
import "@/Loader/Optimized/bpmxLoader";
import "@/Runtime/Animation/mmdRuntimeCameraAnimation";
import "@/Runtime/Animation/mmdRuntimeModelAnimation";

import type { Engine } from "@babylonjs/core/Engines/engine";
import { SceneLoader } from "@babylonjs/core/Loading/sceneLoader";
import { ImageProcessingConfiguration } from "@babylonjs/core/Materials/imageProcessingConfiguration";
import { Color4 } from "@babylonjs/core/Maths/math.color";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { DefaultRenderingPipeline } from "@babylonjs/core/PostProcesses/RenderPipeline/Pipelines/defaultRenderingPipeline";
import { Scene } from "@babylonjs/core/scene";

import type { MmdAnimation } from "@/Loader/Animation/mmdAnimation";
import type { MmdStandardMaterialBuilder } from "@/Loader/mmdStandardMaterialBuilder";
import type { BpmxLoader } from "@/Loader/Optimized/bpmxLoader";
import { BvmdLoader } from "@/Loader/Optimized/bvmdLoader";
import { SdefInjector } from "@/Loader/sdefInjector";
import { StreamAudioPlayer } from "@/Runtime/Audio/streamAudioPlayer";
import type { MmdMesh } from "@/Runtime/mmdMesh";
import { MmdWasmInstanceTypeMD } from "@/Runtime/Optimized/InstanceType/multiDebug";
import type { MmdWasmInstance } from "@/Runtime/Optimized/mmdWasmInstance";
import { getMmdWasmInstance } from "@/Runtime/Optimized/mmdWasmInstance";
import { MmdWasmRuntime } from "@/Runtime/Optimized/mmdWasmRuntime";

import type { ISceneBuilder } from "../baseRuntime";
import { createDefaultArcRotateCamera } from "../Util/createDefaultArcRotateCamera";
import { createLightComponents } from "../Util/createLightComponents";
import { parallelLoadAsync } from "../Util/parallelLoadAsync";

export class SceneBuilder implements ISceneBuilder {
    public async build(_canvas: HTMLCanvasElement, engine: Engine): Promise<Scene> {
        SdefInjector.OverrideEngineCreateEffect(engine);
        const pmxLoader = SceneLoader.GetPluginForExtension(".bpmx") as BpmxLoader;
        pmxLoader.loggingEnabled = true;
        const materialBuilder = pmxLoader.materialBuilder as MmdStandardMaterialBuilder;
        materialBuilder.loadOutlineRenderingProperties = (): void => { /* do nothing */ };

        const scene = new Scene(engine);
        scene.clearColor = new Color4(0.95, 0.95, 0.95, 1.0);
        const mmdRoot = new TransformNode("mmdRoot", scene);
        createDefaultArcRotateCamera(scene);
        const { shadowGenerator } = createLightComponents(scene);

        const audioPlayer = new StreamAudioPlayer(scene);
        audioPlayer.preservesPitch = false;
        audioPlayer.source = "res/private_test/motion/flos/flos - R Sound Design (Piano Cover).mp3";

        const [
            mmdWasmInstance,
            mmdAnimation,
            modelMesh
        ] = await parallelLoadAsync(scene, [
            ["runtime", async(updateProgress): Promise<MmdWasmInstance> => {
                updateProgress({ lengthComputable: true, loaded: 0, total: 1 });
                const mmdWasmInstance = await getMmdWasmInstance(new MmdWasmInstanceTypeMD());
                updateProgress({ lengthComputable: true, loaded: 1, total: 1 });
                return mmdWasmInstance;
            }],
            ["motion", (updateProgress): Promise<MmdAnimation> => {
                const bvmdLoader = new BvmdLoader(scene);
                bvmdLoader.loggingEnabled = true;
                return bvmdLoader.loadAsync("motion", "res/private_test/motion/flos/motion.bvmd", updateProgress);
            }],
            ["model", (updateProgress): Promise<MmdMesh> => {
                pmxLoader.boundingBoxMargin = 60;
                return SceneLoader.ImportMeshAsync(
                    undefined,
                    "res/private_test/model/",
                    "yyb_deep_canyons_miku.bpmx",
                    scene,
                    updateProgress
                ).then(result => result.meshes[0] as MmdMesh);
            }]
        ]);

        for (const mesh of modelMesh.metadata.meshes) mesh.receiveShadows = true;
        shadowGenerator.addShadowCaster(modelMesh);
        modelMesh.parent = mmdRoot;

        const mmdMetadata = modelMesh.metadata;

        const allocate100 = (): void => {
            for (let i = 0; i < 100; i++) {
                const mmdRuntime = new MmdWasmRuntime(mmdWasmInstance);
                mmdRuntime.loggingEnabled = true;
                mmdRuntime.setAudioPlayer(audioPlayer);

                modelMesh.metadata = mmdMetadata;
                const mmdModel = mmdRuntime.createMmdModel(modelMesh, {
                    buildPhysics: true
                });
                mmdModel.addAnimation(mmdAnimation);
                mmdModel.setAnimation("motion");

                mmdRuntime.register(scene);
                mmdRuntime.playAnimation();

                mmdRuntime.dispose(scene);
            }
        };
        (globalThis as any).allocate100 = allocate100;

        const defaultPipeline = new DefaultRenderingPipeline("default", true, scene);
        defaultPipeline.samples = 4;
        defaultPipeline.bloomEnabled = true;
        defaultPipeline.chromaticAberrationEnabled = true;
        defaultPipeline.chromaticAberration.aberrationAmount = 1;
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
