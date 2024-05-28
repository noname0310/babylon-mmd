import "@babylonjs/core/Loading/loadingScreen";
import "@/Loader/pmxLoader";
import "@/Runtime/Animation/mmdRuntimeCameraAnimation";
import "@/Runtime/Animation/mmdRuntimeModelAnimation";
import "@/Loader/mmdOutlineRenderer";

// import { PhysicsViewer } from "@babylonjs/core/Debug/physicsViewer";
import type { AbstractEngine } from "@babylonjs/core/Engines/abstractEngine";
import { SceneLoader } from "@babylonjs/core/Loading/sceneLoader";
import { ImageProcessingConfiguration } from "@babylonjs/core/Materials/imageProcessingConfiguration";
import { Color4 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
// import { CreateBox } from "@babylonjs/core/Meshes/Builders/boxBuilder";
import type { Mesh } from "@babylonjs/core/Meshes/mesh";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
// import { HavokPlugin } from "@babylonjs/core/Physics/v2/Plugins/havokPlugin";
// import { PhysicsImpostor } from "@babylonjs/core/Physics/v1/physicsImpostor";
import { DefaultRenderingPipeline } from "@babylonjs/core/PostProcesses/RenderPipeline/Pipelines/defaultRenderingPipeline";
import { Scene } from "@babylonjs/core/scene";

// import havok from "@babylonjs/havok";
import type { MmdAnimation } from "@/Loader/Animation/mmdAnimation";
import type { PmxLoader } from "@/Loader/pmxLoader";
import { SdefInjector } from "@/Loader/sdefInjector";
import { VmdLoader } from "@/Loader/vmdLoader";
import { StreamAudioPlayer } from "@/Runtime/Audio/streamAudioPlayer";
import { MmdCamera } from "@/Runtime/mmdCamera";
import type { MmdMesh } from "@/Runtime/mmdMesh";
import { MmdRuntime } from "@/Runtime/mmdRuntime";
import { MmdAmmoJSPlugin } from "@/Runtime/Physics/mmdAmmoJSPlugin";
import { MmdAmmoPhysics } from "@/Runtime/Physics/mmdAmmoPhysics";
// import { MmdPhysics } from "@/Runtime/Physics/mmdPhysics";
import { MmdPlayerControl } from "@/Runtime/Util/mmdPlayerControl";

import type { ISceneBuilder } from "../baseRuntime";
import ammo from "../External/ammo.wasm";
import { createCameraSwitch } from "../Util/createCameraSwitch";
import { createDefaultArcRotateCamera } from "../Util/createDefaultArcRotateCamera";
import { createDefaultGround } from "../Util/createDefaultGround";
import { createLightComponents } from "../Util/createLightComponents";
import { parallelLoadAsync } from "../Util/parallelLoadAsync";

// eslint-disable-next-line @typescript-eslint/naming-convention
declare const FPSMeter: any;

export class SceneBuilder implements ISceneBuilder {
    public async build(canvas: HTMLCanvasElement, engine: AbstractEngine): Promise<Scene> {
        SdefInjector.OverrideEngineCreateEffect(engine);
        const pmxLoader = SceneLoader.GetPluginForExtension(".pmx") as PmxLoader;
        pmxLoader.loggingEnabled = true;
        // const materialBuilder = pmxLoader.materialBuilder as MmdStandardMaterialBuilder;
        // materialBuilder.loadOutlineRenderingProperties = (): void => { /* do nothing */ };

        const scene = new Scene(engine);
        scene.clearColor = new Color4(0.95, 0.95, 0.95, 1.0);
        const mmdRoot = new TransformNode("mmdRoot", scene);
        const mmdCamera = new MmdCamera("mmdCamera", new Vector3(0, 10, 0), scene);
        mmdCamera.maxZ = 5000;
        mmdCamera.parent = mmdRoot;
        const camera = createDefaultArcRotateCamera(scene);
        createCameraSwitch(scene, canvas, mmdCamera, camera);
        const { shadowGenerator } = createLightComponents(scene, {
            shadowMaxZOffset: 25,
            shadowMinZOffset: -20,
            orthoTopOffset: 20,
            orthoBottomOffset: -20,
            orthoLeftOffset: -20,
            orthoRightOffset: 50
        });
        shadowGenerator.transparencyShadow = true;
        createDefaultGround(scene);

        const mmdRuntime = new MmdRuntime(scene, new MmdAmmoPhysics(scene));
        mmdRuntime.loggingEnabled = true;

        mmdRuntime.register(scene);

        const audioPlayer = new StreamAudioPlayer(scene);
        audioPlayer.preservesPitch = false;
        audioPlayer.source = "res/private_test/motion/new_jeans/NewJeans - New Jeans.wav";
        mmdRuntime.setAudioPlayer(audioPlayer);

        const mmdPlayerControl = new MmdPlayerControl(scene, mmdRuntime, audioPlayer);
        mmdPlayerControl.showPlayerControl();

        const [
            mmdAnimations,
            modelMeshes
        ] = await parallelLoadAsync(scene, [
            ["motion", (updateProgress): Promise<MmdAnimation[]> => {
                const vmdLoader = new VmdLoader(scene);
                vmdLoader.loggingEnabled = true;
                const filePaths = [
                    "res/private_test/motion/new_jeans/Danielle part.vmd",
                    "res/private_test/motion/new_jeans/Haerin part.vmd",
                    "res/private_test/motion/new_jeans/Hanni part.vmd",
                    "res/private_test/motion/new_jeans/Hyein part.vmd",
                    "res/private_test/motion/new_jeans/Minji part.vmd",
                    "res/private_test/motion/new_jeans/Camera.vmd"
                ];
                return Promise.all(filePaths.map((filePath) => vmdLoader.loadAsync("motion", filePath, updateProgress)));
            }],
            ["model", (updateProgress): Promise<Mesh[]> => {
                pmxLoader.boundingBoxMargin = 60;

                const modelMeshes: Promise<Mesh>[] = [];
                for (let i = 0; i < 5; ++i) {
                    modelMeshes.push(SceneLoader.ImportMeshAsync(
                        undefined,
                        "res/private_test/model/YYB Hatsune Miku_10th - faceforward - newjeans/",
                        "YYB Hatsune Miku_10th_v1.02 - faceforward - ng.pmx",
                        scene,
                        updateProgress
                    ).then((result) => result.meshes[0] as MmdMesh));
                }
                return Promise.all(modelMeshes);
            }],
            ["physics", async(updateProgress): Promise<void> => {
                updateProgress({ lengthComputable: true, loaded: 0, total: 1 });
                const physicsInstance = await ammo();
                const physicsPlugin = new MmdAmmoJSPlugin(true, physicsInstance);
                scene.enablePhysics(new Vector3(0, -9.8 * 10, 0), physicsPlugin);
                updateProgress({ lengthComputable: true, loaded: 1, total: 1 });
            }]
        ]);

        mmdRuntime.setCamera(mmdCamera);
        mmdCamera.addAnimation(mmdAnimations[5]);
        mmdCamera.setAnimation("motion");

        for (let i = 0; i < modelMeshes.length; ++i) {
            const modelMesh = modelMeshes[i];

            for (const mesh of modelMesh.metadata.meshes) {
                mesh.receiveShadows = true;
                shadowGenerator.addShadowCaster(mesh, false);
            }
            modelMesh.parent = mmdRoot;

            const mmdModel = mmdRuntime.createMmdModel(modelMesh, {
                buildPhysics: true
            });
            mmdModel.addAnimation(mmdAnimations[i]);
            mmdModel.setAnimation("motion");

            mmdRuntime.playAnimation();
        }

        // const viewer = new SkeletonViewer(modelMesh.metadata.skeleton, modelMesh, scene, false, 3, {
        //     displayMode: SkeletonViewer.DISPLAY_SPHERE_AND_SPURS
        // });

        // const plane = CreateBox("plane", { width: 100, height: 100 }, scene);
        // plane.rotation.x = Math.PI / 2;
        // plane.isVisible = false;
        // const planeImpostor = plane.physicsImpostor = new PhysicsImpostor(plane, PhysicsImpostor.BoxImpostor, { mass: 0 }, scene);
        // {
        //     const physicsViewer = new PhysicsViewer(scene);
        //     for (const node of modelMesh.getChildMeshes(true)) {
        //         if (node.physicsImpostor) {
        //             physicsViewer.showImpostor(node.physicsImpostor);
        //         }
        //     }
        //     physicsViewer.showImpostor(planeImpostor);
        // }

        const defaultPipeline = new DefaultRenderingPipeline("default", true, scene);
        defaultPipeline.samples = 4;
        defaultPipeline.bloomEnabled = true;
        defaultPipeline.chromaticAberrationEnabled = true;
        defaultPipeline.chromaticAberration.aberrationAmount = 1;
        defaultPipeline.depthOfFieldEnabled = false;
        defaultPipeline.fxaaEnabled = true;
        defaultPipeline.imageProcessingEnabled = true;
        defaultPipeline.imageProcessing.toneMappingEnabled = true;
        defaultPipeline.imageProcessing.toneMappingType = ImageProcessingConfiguration.TONEMAPPING_KHR_PBR_NEUTRAL;
        defaultPipeline.imageProcessing.vignetteWeight = 0.5;
        defaultPipeline.imageProcessing.vignetteStretch = 0.5;
        defaultPipeline.imageProcessing.vignetteColor = new Color4(0, 0, 0, 0);
        defaultPipeline.imageProcessing.vignetteEnabled = true;

        return scene;
    }
}
