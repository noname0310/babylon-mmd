import css from "./index.css";
css;

import * as BABYLON from "babylonjs";

// Get the canvas DOM element
const canvas = document.getElementById("render-canvas") as HTMLCanvasElement;

// Load the 3D engine
const engine = new BABYLON.WebGPUEngine(
    canvas,
    {
        powerPreference: "high-performance",
        antialias: true,
        stencil: true
    }
);

// CreateScene function that creates and return the scene
function createScene(): BABYLON.Scene {
    const scene = new BABYLON.Scene(engine);
    const camera = new BABYLON.FreeCamera("camera1", new BABYLON.Vector3(0, 5, -10), scene);
    camera.setTarget(BABYLON.Vector3.Zero());
    camera.attachControl(canvas, false);

    const light = new BABYLON.HemisphericLight("light1", new BABYLON.Vector3(0, 1, 0), scene);

    const sphere = BABYLON.MeshBuilder.CreateSphere("sphere1", {segments: 16, diameter: 2, sideOrientation: BABYLON.Mesh.FRONTSIDE}, scene);
    sphere.position.y = 1;

    const ground = BABYLON.MeshBuilder.CreateGround("ground1", { width: 6, height: 6, subdivisions: 2, updatable: false }, scene);

    light;
    ground;

    return scene;
}

// call the createScene function
const scene = createScene();

// run the render loop
engine.runRenderLoop(function() {
    scene.render();
});
// the canvas/window resize event handler
window.addEventListener("resize", function() {
    engine.resize();
});
