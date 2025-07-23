# Multiple Cameras

Add one or more cameras to your scene.

Let's put in a user-manipulated camera, one of the simple forms of user-interactive content.

## Create ArcRotateCamera

```typescript title="src/sceneBuilder.ts"
const arcRotateCamera = new ArcRotateCamera("arcRotateCamera", 0, 0, 45, new Vector3(0, 10, 0), scene);
arcRotateCamera.maxZ = 5000;
arcRotateCamera.setPosition(new Vector3(0, 10, -45));
arcRotateCamera.attachControl(canvas, false);
arcRotateCamera.inertia = 0.8;
arcRotateCamera.speed = 10;
```

- [Camera Introduction | Babylon.js Documentation](https://doc.babylonjs.com/features/featuresDeepDive/cameras/camera_introduction#arc-rotate-camera)

## Make ArcRotateCamera Follow Model

```typescript title="src/sceneBuilder.ts"
const bodyBone = modelMesh.skeleton!.bones.find((bone) => bone.name === "センター");
const meshWorldMatrix = modelMesh.getWorldMatrix();
const boneWorldMatrix = new Matrix();
scene.onBeforeRenderObservable.add(() => {
    boneWorldMatrix.copyFrom(bodyBone!.getFinalMatrix()).multiplyToRef(meshWorldMatrix, boneWorldMatrix);
    boneWorldMatrix.getTranslationToRef(directionalLight.position);
    directionalLight.position.y -= 10;

    // highlight-start
    arcRotateCamera.target.copyFrom(directionalLight.position);
    arcRotateCamera.target.y += 13;
    // highlight-end
});
```

- Set the target of the camera to the position of the directional light(= the position of the model).

## Add Camera to PostProcess Render Pipeline

```typescript title="src/sceneBuilder.ts"
const ssrRenderingPipeline = new SSRRenderingPipeline(
    "ssr",
    scene,
    // highlight-next-line
    [mmdCamera, arcRotateCamera],
    false,
    Constants.TEXTURETYPE_UNSIGNED_BYTE
);

// ...
// highlight-next-line
const defaultPipeline = new DefaultRenderingPipeline("default", true, scene, [mmdCamera, arcRotateCamera]);
```

- Add the `arcRotateCamera` to the constructor of the post-process render pipeline for applying the post-process to the camera.

## Camera Switching

```typescript title="src/sceneBuilder.ts"
let lastClickTime = -Infinity;
canvas.onclick = (): void => {
    const currentTime = performance.now();
    if (500 < currentTime - lastClickTime) {
        lastClickTime = currentTime;
        return;
    }

    lastClickTime = -Infinity;

    if (scene.activeCamera === mmdCamera) {
        defaultPipeline.depthOfFieldEnabled = false;
        scene.activeCamera = arcRotateCamera;
    } else {
        defaultPipeline.depthOfFieldEnabled = true;
        scene.activeCamera = mmdCamera;
    }
};
```

- Switch the active camera when the user double-clicks the canvas.

import ReactPlayer from "react-player";
import ResultVideo from "./2023-07-29 20-13-24.mp4";

<ReactPlayer
    url={ResultVideo}
    controls={true}
    width="100%"
    height="100%"/>

## Full Code at this Point

**Thank you for your efforts. This is the end of the tutorial!**

For detailed explanation, please check jsdoc and source code. For questions and requests, please make an issue on GitHub.

```typescript title="src/sceneBuilder.ts"
import "babylon-mmd/esm/Loader/Optimized/bpmxLoader";
import "babylon-mmd/esm/Runtime/Animation/mmdRuntimeCameraAnimation";
import "babylon-mmd/esm/Runtime/Animation/mmdRuntimeModelAnimation";
import "@babylonjs/core/Lights/Shadows/shadowGeneratorSceneComponent";
import "@babylonjs/core/Loading/loadingScreen";
import "@babylonjs/core/Rendering/prePassRendererSceneComponent";
import "@babylonjs/core/Rendering/depthRendererSceneComponent";
import "@babylonjs/core/Rendering/geometryBufferRendererSceneComponent";

import { ArcRotateCamera } from "@babylonjs/core/Cameras/arcRotateCamera";
import { Constants } from "@babylonjs/core/Engines/constants";
import type { Engine } from "@babylonjs/core/Engines/engine";
import { DirectionalLight } from "@babylonjs/core/Lights/directionalLight";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { ShadowGenerator } from "@babylonjs/core/Lights/Shadows/shadowGenerator";
import { loadAssetContainerAsync, appendSceneAsync } from "@babylonjs/core/Loading/sceneLoader";
import { ImageProcessingConfiguration } from "@babylonjs/core/Materials/imageProcessingConfiguration";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Color3, Color4 } from "@babylonjs/core/Maths/math.color";
import { Matrix, Vector3 } from "@babylonjs/core/Maths/math.vector";
import { CreateGround } from "@babylonjs/core/Meshes/Builders/groundBuilder";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { DepthOfFieldEffectBlurLevel } from "@babylonjs/core/PostProcesses/depthOfFieldEffect";
import { DefaultRenderingPipeline } from "@babylonjs/core/PostProcesses/RenderPipeline/Pipelines/defaultRenderingPipeline";
import { SSRRenderingPipeline } from "@babylonjs/core/PostProcesses/RenderPipeline/Pipelines/ssrRenderingPipeline";
import { Scene } from "@babylonjs/core/scene";
import { MmdStandardMaterialBuilder } from "babylon-mmd/esm/Loader/mmdStandardMaterialBuilder";
import { BvmdLoader } from "babylon-mmd/esm/Loader/Optimized/bvmdLoader";
import { SdefInjector } from "babylon-mmd/esm/Loader/sdefInjector";
import { StreamAudioPlayer } from "babylon-mmd/esm/Runtime/Audio/streamAudioPlayer";
import { MmdCamera } from "babylon-mmd/esm/Runtime/mmdCamera";
import type { MmdMesh } from "babylon-mmd/esm/Runtime/mmdMesh";
import { MmdRuntime } from "babylon-mmd/esm/Runtime/mmdRuntime";
import { MmdPlayerControl } from "babylon-mmd/esm/Runtime/Util/mmdPlayerControl";

import type { ISceneBuilder } from "./baseRuntime";

export class SceneBuilder implements ISceneBuilder {
    public async build(canvas: HTMLCanvasElement, engine: Engine): Promise<Scene> {
        SdefInjector.OverrideEngineCreateEffect(engine);

        const materialBuilder = new MmdStandardMaterialBuilder();
        materialBuilder.loadOutlineRenderingProperties = (): void => { /* do nothing */ };

        const scene = new Scene(engine);
        scene.ambientColor = new Color3(0.5, 0.5, 0.5);
        scene.clearColor = new Color4(0.95, 0.95, 0.95, 1.0);

        const mmdRoot = new TransformNode("mmdRoot", scene);
        mmdRoot.position.z -= 50;

        const mmdCamera = new MmdCamera("mmdCamera", new Vector3(0, 10, 0), scene);
        mmdCamera.maxZ = 5000;
        mmdCamera.parent = mmdRoot;

        const arcRotateCamera = new ArcRotateCamera("arcRotateCamera", 0, 0, 45, new Vector3(0, 10, 0), scene);
        arcRotateCamera.maxZ = 5000;
        arcRotateCamera.setPosition(new Vector3(0, 10, -45));
        arcRotateCamera.attachControl(canvas, false);
        arcRotateCamera.inertia = 0.8;
        arcRotateCamera.speed = 10;

        const hemisphericLight = new HemisphericLight("hemisphericLight", new Vector3(0, 1, 0), scene);
        hemisphericLight.intensity = 0.3;
        hemisphericLight.specular.set(0, 0, 0);
        hemisphericLight.groundColor.set(1, 1, 1);

        const directionalLight = new DirectionalLight("directionalLight", new Vector3(0.5, -1, 1), scene);
        directionalLight.intensity = 0.7;
        directionalLight.autoCalcShadowZBounds = false;
        directionalLight.autoUpdateExtends = false;
        directionalLight.shadowMaxZ = 20;
        directionalLight.shadowMinZ = -20;
        directionalLight.orthoTop = 18;
        directionalLight.orthoBottom = -3;
        directionalLight.orthoLeft = -10;
        directionalLight.orthoRight = 10;
        directionalLight.shadowOrthoScale = 0;

        const shadowGenerator = new ShadowGenerator(1024, directionalLight, true);
        shadowGenerator.transparencyShadow = true;
        shadowGenerator.usePercentageCloserFiltering = true;
        shadowGenerator.forceBackFacesOnly = false;
        shadowGenerator.bias = 0.01;
        shadowGenerator.filteringQuality = ShadowGenerator.QUALITY_MEDIUM;
        shadowGenerator.frustumEdgeFalloff = 0.1;

        const ground = CreateGround("ground1", { width: 120, height: 120, subdivisions: 2, updatable: false }, scene);
        const groundMaterial = ground.material = new StandardMaterial("groundMaterial", scene);
        groundMaterial.diffuseColor = new Color3(1.02, 1.02, 1.02);
        ground.receiveShadows = true;

        // create mmd runtime
        const mmdRuntime = new MmdRuntime(scene);
        mmdRuntime.loggingEnabled = true;
        mmdRuntime.register(scene);

        mmdRuntime.playAnimation();

        // add audio player
        const audioPlayer = new StreamAudioPlayer(scene);
        audioPlayer.preservesPitch = false;
        audioPlayer.source = "res/pizzicato_drops.mp3";
        mmdRuntime.setAudioPlayer(audioPlayer);

        // create player control
        new MmdPlayerControl(scene, mmdRuntime, audioPlayer);

        engine.displayLoadingUI();

        let loadingTexts: string[] = [];
        const updateLoadingText = (updateIndex: number, text: string): void => {
            loadingTexts[updateIndex] = text;
            engine.loadingUIText = "<br/><br/><br/><br/>" + loadingTexts.join("<br/><br/>");
        };
        
        const bvmdLoader = new BvmdLoader(scene);
        bvmdLoader.loggingEnabled = true;

        const [modelMesh, , mmdAnimation] = await Promise.all([
            loadAssetContainerAsync(
                "res/YYB Piano dress Miku.bpmx",
                scene,
                {
                    onProgress: (event) => updateLoadingText(0, `Loading model... ${event.loaded}/${event.total} (${Math.floor(event.loaded * 100 / event.total)}%)`),
                    pluginOptions: {
                        mmdmodel: {
                            materialBuilder: materialBuilder,
                            boundingBoxMargin: 60,
                            loggingEnabled: true
                        }
                    }
                }
            ).then((result) => {
                result.addAllToScene();
                return result.meshes[0] as MmdMesh;
            }),
            appendSceneAsync(
                "res/ガラス片ドームB.bpmx",
                scene,
                {
                    onProgress: (event) => updateLoadingText(1, `Loading stage... ${event.loaded}/${event.total} (${Math.floor(event.loaded * 100 / event.total)}%)`),
                    pluginOptions: {
                        mmdmodel: {
                            materialBuilder: materialBuilder,
                            buildSkeleton: false,
                            buildMorph: false,
                            boundingBoxMargin: 0,
                            loggingEnabled: true
                        }
                    }
                }
            ),
            bvmdLoader.loadAsync("motion_1", "res/pizzicato_drops_yyb_piano_miku.bvmd",
                (event) => updateLoadingText(2, `Loading motion... ${event.loaded}/${event.total} (${Math.floor(event.loaded * 100 / event.total)}%)`))
        ]);

        scene.onAfterRenderObservable.addOnce(() => engine.hideLoadingUI());

        mmdRuntime.setCamera(mmdCamera);
        mmdCamera.addAnimation(mmdAnimation);
        mmdCamera.setAnimation("motion_1");

        modelMesh.parent = mmdRoot;
        for (const mesh of modelMesh.metadata.meshes) mesh.receiveShadows = true;
        shadowGenerator.addShadowCaster(modelMesh);

        const bodyBone = modelMesh.skeleton!.bones.find((bone) => bone.name === "センター");
        const meshWorldMatrix = modelMesh.getWorldMatrix();
        const boneWorldMatrix = new Matrix();
        scene.onBeforeRenderObservable.add(() => {
            boneWorldMatrix.copyFrom(bodyBone!.getFinalMatrix()).multiplyToRef(meshWorldMatrix, boneWorldMatrix);
            boneWorldMatrix.getTranslationToRef(directionalLight.position);
            directionalLight.position.y -= 10;

            arcRotateCamera.target.copyFrom(directionalLight.position);
            arcRotateCamera.target.y += 13;
        });

        const mmdModel = mmdRuntime.createMmdModel(modelMesh);
        mmdModel.addAnimation(mmdAnimation);
        mmdModel.setAnimation("motion_1");

        const ssrRenderingPipeline = new SSRRenderingPipeline(
            "ssr",
            scene,
            [mmdCamera, arcRotateCamera],
            false,
            Constants.TEXTURETYPE_UNSIGNED_BYTE
        );
        ssrRenderingPipeline.step = 32;
        ssrRenderingPipeline.maxSteps = 128;
        ssrRenderingPipeline.maxDistance = 500;
        ssrRenderingPipeline.enableSmoothReflections = false;
        ssrRenderingPipeline.enableAutomaticThicknessComputation = false;
        ssrRenderingPipeline.blurDownsample = 2;
        ssrRenderingPipeline.ssrDownsample = 2;
        ssrRenderingPipeline.thickness = 0.1;
        ssrRenderingPipeline.selfCollisionNumSkip = 2;
        ssrRenderingPipeline.blurDispersionStrength = 0;
        ssrRenderingPipeline.roughnessFactor = 0.1;
        ssrRenderingPipeline.reflectivityThreshold = 0.9;
        ssrRenderingPipeline.samples = 4;

        const defaultPipeline = new DefaultRenderingPipeline("default", true, scene, [mmdCamera, arcRotateCamera]);
        defaultPipeline.samples = 4;
        defaultPipeline.bloomEnabled = true;
        defaultPipeline.chromaticAberrationEnabled = true;
        defaultPipeline.chromaticAberration.aberrationAmount = 1;
        defaultPipeline.depthOfFieldEnabled = true;
        defaultPipeline.depthOfFieldBlurLevel = DepthOfFieldEffectBlurLevel.High;
        defaultPipeline.fxaaEnabled = true;
        defaultPipeline.imageProcessingEnabled = true;
        defaultPipeline.imageProcessing.toneMappingEnabled = true;
        defaultPipeline.imageProcessing.toneMappingType = ImageProcessingConfiguration.TONEMAPPING_ACES;
        defaultPipeline.imageProcessing.vignetteWeight = 0.5;
        defaultPipeline.imageProcessing.vignetteStretch = 0.5;
        defaultPipeline.imageProcessing.vignetteColor = new Color4(0, 0, 0, 0);
        defaultPipeline.imageProcessing.vignetteEnabled = true;

        defaultPipeline.depthOfField.fStop = 0.05;
        defaultPipeline.depthOfField.focalLength = 20;

        for (const depthRenderer of Object.values(scene._depthRenderer)) {
            depthRenderer.forceDepthWriteTransparentMeshes = true;
        }

        const headBone = modelMesh.skeleton!.bones.find((bone) => bone.name === "頭");

        const rotationMatrix = new Matrix();
        const cameraNormal = new Vector3();
        const cameraEyePosition = new Vector3();
        const headRelativePosition = new Vector3();

        scene.onBeforeRenderObservable.add(() => {
            const cameraRotation = mmdCamera.rotation;
            Matrix.RotationYawPitchRollToRef(-cameraRotation.y, -cameraRotation.x, -cameraRotation.z, rotationMatrix);

            Vector3.TransformNormalFromFloatsToRef(0, 0, 1, rotationMatrix, cameraNormal);

            mmdCamera.position.addToRef(
                Vector3.TransformCoordinatesFromFloatsToRef(0, 0, mmdCamera.distance, rotationMatrix, cameraEyePosition),
                cameraEyePosition
            );

            headBone!.getFinalMatrix().getTranslationToRef(headRelativePosition)
                .subtractToRef(cameraEyePosition, headRelativePosition);

            defaultPipeline.depthOfField.focusDistance = (Vector3.Dot(headRelativePosition, cameraNormal) / Vector3.Dot(cameraNormal, cameraNormal)) * 1000;
        });

        let lastClickTime = -Infinity;
        canvas.onclick = (): void => {
            const currentTime = performance.now();
            if (500 < currentTime - lastClickTime) {
                lastClickTime = currentTime;
                return;
            }

            lastClickTime = -Infinity;

            if (scene.activeCamera === mmdCamera) {
                defaultPipeline.depthOfFieldEnabled = false;
                scene.activeCamera = arcRotateCamera;
            } else {
                defaultPipeline.depthOfFieldEnabled = true;
                scene.activeCamera = mmdCamera;
            }
        };

        return scene;
    }
}
```
