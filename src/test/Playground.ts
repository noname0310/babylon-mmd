// async function createScene(): Promise<any> {
//     await new Promise((resolve) => {
//         const babylonScript = document.createElement("script");
//         babylonScript.src = "https://cdn.babylonjs.com/babylon.js";
//         document.head.appendChild(babylonScript);
//         babylonScript.onload = resolve;
//     });
//     const BABYLON = window.BABYLON as any;

//     await new Promise((resolve) => {
//         const babylonMmdScript = document.createElement("script");
//         babylonMmdScript.src = "https://cdn.jsdelivr.net/npm/babylon-mmd/dist/umd/babylon.mmd.min.js";
//         document.head.appendChild(babylonMmdScript);
//         babylonMmdScript.onload = resolve;
//     });
//     const BABYLONMMD = (window as any).BABYLONMMD as any;

//     const canvas = document.getElementById("render-canvas");
//     if (!(canvas instanceof HTMLCanvasElement)) throw new Error("Invalid canvas element");
//     canvas.width = 1920;
//     canvas.height = 1080;

//     const engine = new BABYLON.Engine(canvas, true, {
//         preserveDrawingBuffer: true,
//         stencil: true,
//         antialias: true
//     }, true);

//     const scene = new BABYLON.Scene(engine);
//     scene.clearColor = new BABYLON.Color4(1, 1, 1, 1.0);

//     BABYLON.SceneLoader.RegisterPlugin(new BABYLONMMD.PmxLoader());
//     const vmdLoader = new BABYLONMMD.VmdLoader(scene);

//     const camera = new BABYLONMMD.MmdCamera("mmdCamera", new BABYLON.Vector3(0, 10, 0), scene);
//     camera.maxZ = 5000;

//     const hemisphericLight = new BABYLON.HemisphericLight("light1", new BABYLON.Vector3(0, 1, 0), scene);
//     hemisphericLight.intensity = 0.4;
//     hemisphericLight.specular = new BABYLON.Color3(0, 0, 0);
//     hemisphericLight.groundColor = new BABYLON.Color3(1, 1, 1);

//     const directionalLight = new BABYLON.DirectionalLight("DirectionalLight", new BABYLON.Vector3(0.5, -1, 1), scene);
//     directionalLight.intensity = 0.8;
//     directionalLight.autoCalcShadowZBounds = false;
//     directionalLight.autoUpdateExtends = false;
//     directionalLight.shadowMaxZ = 20;
//     directionalLight.shadowMinZ = -15;
//     directionalLight.orthoTop = 19;
//     directionalLight.orthoBottom = -1;
//     directionalLight.orthoLeft = -9;
//     directionalLight.orthoRight = 9;
//     directionalLight.shadowOrthoScale = 0;

//     const shadowGenerator = new BABYLON.ShadowGenerator(1024, directionalLight, true, camera);
//     shadowGenerator.usePercentageCloserFiltering = true;
//     shadowGenerator.forceBackFacesOnly = true;
//     shadowGenerator.filteringQuality = BABYLON.ShadowGenerator.QUALITY_MEDIUM;
//     shadowGenerator.frustumEdgeFalloff = 0.1;

//     const ground = BABYLON.MeshBuilder.CreateGround("ground1", { width: 60, height: 60, subdivisions: 2, updatable: false }, scene);
//     ground.receiveShadows = true;
//     shadowGenerator.addShadowCaster(ground);

//     const defaultPipeline = new BABYLON.DefaultRenderingPipeline("default", true, scene, [camera]);
//     defaultPipeline.samples = 4;
//     defaultPipeline.fxaaEnabled = true;

//     engine.displayLoadingUI();

//     const model = await BABYLON.SceneLoader.ImportMeshAsync(
//         undefined,
//         "https://culdo.github.io/web-mmd/models/mmd/%E3%81%A4%E3%81%BF%E5%BC%8F%E3%83%9F%E3%82%AF%E3%81%95%E3%82%93v4/%E3%81%A4%E3%81%BF%E5%BC%8F%E3%83%9F%E3%82%AF%E3%81%95%E3%82%93v4.pmx",
//         undefined,
//         scene,
//         (event: any) => engine.loadingUIText = `Loading model... ${event.loaded}/${event.total} (${Math.floor(event.loaded * 100 / event.total)}%)`)
//         .then((result: any) => result.meshes[0]);

//     const cameraMotion = await vmdLoader.loadAsync("gimmegimme_camera", "https://culdo.github.io/web-mmd/models/mmd/cameras/GimmexGimme.vmd",
//         (event: any) => engine.loadingUIText = `Loading camera... ${event.loaded}/${event.total} (${Math.floor(event.loaded * 100 / event.total)}%)`);
//     const modelMotion = await vmdLoader.loadAsync("gimmegimme_model", "https://culdo.github.io/web-mmd/models/mmd/motions/GimmeGimme_with_emotion.vmd",
//         (event: any) => engine.loadingUIText = `Loading motion... ${event.loaded}/${event.total} (${Math.floor(event.loaded * 100 / event.total)}%)`);

//     setTimeout(() => engine.hideLoadingUI(), 0);

//     const mmdRuntime = new BABYLONMMD.MmdRuntime();

//     camera.addAnimation(cameraMotion);
//     camera.setAnimation("gimmegimme_camera");

//     const mmdModel = mmdRuntime.createMmdModel(model);
//     mmdModel.addAnimation(modelMotion);
//     mmdModel.setAnimation("gimmegimme_model");

//     mmdRuntime.register(scene);
//     mmdRuntime.playAnimation();

//     engine.runRenderLoop(() => {
//         scene.render();
//     });
// }

// createScene();

// async function createScene() {
//     await new Promise((resolve) => {
//         const babylonMmdScript = document.createElement('script');
//         babylonMmdScript.src = "https://cdn.jsdelivr.net/npm/babylon-mmd/dist/umd/babylon.mmd.min.js";
//         document.head.appendChild(babylonMmdScript);
//         babylonMmdScript.onload = resolve;
//     });

//     const scene = new BABYLON.Scene(engine);
//     scene.clearColor = new BABYLON.Color4(1, 1, 1, 1.0);

//     BABYLON.SceneLoader.RegisterPlugin(new BABYLONMMD.PmxLoader());

//     const camera = new BABYLON.FreeCamera("camera1", new BABYLON.Vector3(0, 15, -30), scene);
//     camera.setTarget(new BABYLON.Vector3(0, 10, 0));
//     camera.attachControl(canvas, true);

//     const hemisphericLight = new BABYLON.HemisphericLight("Light1", new BABYLON.Vector3(0, 1, 0), scene);
//     hemisphericLight.intensity = 0.4;
//     hemisphericLight.specular = new BABYLON.Color3(0, 0, 0);
//     hemisphericLight.groundColor = new BABYLON.Color3(1, 1, 1);

//     const directionalLight = new BABYLON.DirectionalLight("DirectionalLight", new BABYLON.Vector3(0.5, -1, 1), scene);
//     directionalLight.intensity = 0.8;

//     await BABYLON.SceneLoader.AppendAsync(
//         "https://culdo.github.io/web-mmd/models/mmd/%E3%81%A4%E3%81%BF%E5%BC%8F%E3%83%9F%E3%82%AF%E3%81%95%E3%82%93v4/%E3%81%A4%E3%81%BF%E5%BC%8F%E3%83%9F%E3%82%AF%E3%81%95%E3%82%93v4.pmx",
//         undefined,
//         scene);

//     return scene;
// };
