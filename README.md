# babylon-mmd

mmd loader and runtime for Babylon.js

**this project is still in very early stage.**

## Implementation status

**Parser**

- [x] PMX Parser
- [x] VMD Parser
- [ ] Optimized Custom PMX like format
- [ ] Optimized Custom VMD like format

**PMX Loader**

> Mesh
- [x] Vertex, Normal, UV, Face load
- [x] Bone weight load / Bone Structure build
- [x] Morph target load

> Material / Shading
- [x] Basic material parameters load
- [x] Toon texture support
- [x] Sphere texture support
- [x] Edge(outline) rendering support
- [x] Spherical Deformation support
- [x] WebGL 1.0 support
- [x] WebGL 2.0 support
- [ ] WebGPU support

> MMD runtime parameters
- [x] Transform order
- [x] Additional transform parameters load
- [x] IK parameters load
- [x] Rigid body / Joint parameters load

**VMD Loader**

- [ ] Basic animation load
- [ ] Support custom retargeting

**Animation Runtime**

- [ ] Basic animation load
- [x] MMD morph system support
- [x] Solve Append transform
- [x] Solve IK
- [ ] Play audio / sync with animation
- [ ] Basic animation player UI

**Physics Runtime**

- [ ] Solve Rigid body / Joint
- [ ] Support custom physics engine for parallel computing

## Not planned features

- PMX 2.1 support (because 2.1 spec not implemented in MMD)
- PMD format support
- Self shadow, Ground shadow spec support
- Additional UV support

## Screenshots

![screenshot](./docs/fig1.png)

Model: [YYB Hatsune Miku_10th](https://www.deviantart.com/sanmuyyb/art/YYB-Hatsune-Miku-10th-DL-702119716)

## How to use

Currently, what is possible is to load the model and see it, and try out simple poses.

Since there is no npm build uploaded yet, in order to use the loader, you will need to copy the source code directly from the src folder of this repository.

Here is the code to build a scene with a simple MMD model:
```typescript
async function build(canvas: HTMLCanvasElement, engine: Engine): Scene {
    // If you don't want full SDEF support on shadow / depth rendering, you can comment out this line as well. While using SDEF can provide similar results to MMD, it comes with a higher cost.
    SdefInjector.overrideEngineCreateEffect(engine);

    const pmxLoader = new PmxLoader();

    // If you don't want SDEF support, you can uncomment this line. This can save some performance.
    // pmxLoader.useSdef = false;
    
    // you can create your own material builder and override the default one for custom shading
    const materialBuilder = pmxLoader.materialBuilder as MmdStandardMaterialBuilder;

    // If you don't want sphere texture support, you can uncomment this line. This can save some performance.
    // materialBuilder.loadSphereTexture = (): void => { /* do nothing */ };

    // If you don't want toon texture support, you can uncomment this line. This can save some performance.
    // materialBuilder.loadToonTexture = (): void => { /* do nothing */ };

    // If you don't want outline rendering, you can uncomment this line. This rendering operation can be quite expensive.
    // materialBuilder.loadOutlineRenderingProperties = (): void => { /* do nothing */ };
    
    SceneLoader.RegisterPlugin(pmxLoader);

    const scene = new Scene(engine);
    scene.clearColor = new Color4(1, 1, 1, 1.0);

    const camera = new UniversalCamera("camera1", new Vector3(0, 15, -40), scene);
    camera.maxZ = 1000;
    camera.setTarget(new Vector3(0, 10, 0));
    camera.attachControl(canvas, false);
    camera.inertia = 0;
    camera.angularSensibility = 500;
    camera.speed = 10;

    const hemisphericLight = new HemisphericLight("light1", new Vector3(0, 1, 0), scene);
    hemisphericLight.intensity = 0.4;
    hemisphericLight.specular = new Color3(0, 0, 0);
    hemisphericLight.groundColor = new Color3(1, 1, 1);

    const directionalLight = new DirectionalLight("DirectionalLight", new Vector3(0.5, -1, 1), scene);
    directionalLight.intensity = 0.8;

    const csmShadowGenerator = new CascadedShadowGenerator(1024, directionalLight);
    csmShadowGenerator.forceBackFacesOnly = true;
    csmShadowGenerator.numCascades = 3;
    csmShadowGenerator.autoCalcDepthBounds = true;
    csmShadowGenerator.lambda = 1;
    csmShadowGenerator.depthClamp = true;
    csmShadowGenerator.filteringQuality = ShadowGenerator.QUALITY_HIGH;
    csmShadowGenerator.normalBias = 0.02;

    const model = await SceneLoader.ImportMeshAsync(undefined, "your_model_path.pmx", undefined, scene)
        .then((result) => result.meshes[0]); // importMeshAsync meshes always have length 1
    model.receiveShadows = true;
    csmShadowGenerator.addShadowCaster(model);

    const ground = MeshBuilder.CreateGround("ground1", { width: 60, height: 60, subdivisions: 2, updatable: false }, scene);
    ground.receiveShadows = true;
    csmShadowGenerator.addShadowCaster(ground);

    // for anti-aliasing
    const defaultPipeline = new DefaultRenderingPipeline("default", true, scene, [camera]);
    defaultPipeline.samples = 4;
    defaultPipeline.fxaaEnabled = true;

    return scene;
}
```

## References

[PMX (Polygon Model eXtended) 2.0, 2.1 File Format Specifications](https://gist.github.com/felixjones/f8a06bd48f9da9a4539f)

[blender_mmd_tools](https://github.com/powroupi/blender_mmd_tools)

[Saba: OpenGL Viewer (OBJ PMD PMX)](https://github.com/benikabocha/saba)

[three.js MMDLoader](https://threejs.org/docs/#examples/en/loaders/MMDLoader)
