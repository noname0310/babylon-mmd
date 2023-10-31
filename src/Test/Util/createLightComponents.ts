import "@babylonjs/core/Lights/Shadows/shadowGeneratorSceneComponent";

// import { DirectionalLightFrustumViewer } from "@babylonjs/core/Debug/directionalLightFrustumViewer";
import { DirectionalLight } from "@babylonjs/core/Lights/directionalLight";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { ShadowGenerator } from "@babylonjs/core/Lights/Shadows/shadowGenerator";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { Scene } from "@babylonjs/core/scene";

export interface ICreateLightComponentOptions {
    worldScale?: number;
    hemisphericLightIntensity?: number;
    directionalLightIntensity?: number;
    shadowMaxZOffset?: number;
    shadowMinZOffset?: number;
    orthoTopOffset?: number;
    orthoBottomOffset?: number;
    orthoLeftOffset?: number;
    orthoRightOffset?: number;
}

export interface ICreateLightComponentsResult {
    hemisphericLight: HemisphericLight;
    directionalLight: DirectionalLight;
    shadowGenerator: ShadowGenerator;
}

export function createLightComponents(scene: Scene, options: ICreateLightComponentOptions = {}): ICreateLightComponentsResult {
    const {
        worldScale = 1,
        hemisphericLightIntensity = 0.5,
        directionalLightIntensity = 0.5,
        shadowMaxZOffset = 0,
        shadowMinZOffset = 0,
        orthoTopOffset = 0,
        orthoBottomOffset = 0,
        orthoLeftOffset = 0,
        orthoRightOffset = 0
    } = options;

    const hemisphericLight = new HemisphericLight("hemisphericLight", new Vector3(0, 1, 0).scaleInPlace(worldScale), scene);
    hemisphericLight.intensity = hemisphericLightIntensity;
    hemisphericLight.specular = new Color3(0, 0, 0);
    hemisphericLight.groundColor = new Color3(1, 1, 1);

    const directionalLight = new DirectionalLight("directionalLight", new Vector3(0.5, -1, 1).scaleInPlace(worldScale), scene);
    directionalLight.intensity = directionalLightIntensity;
    directionalLight.autoCalcShadowZBounds = false;
    directionalLight.autoUpdateExtends = false;
    directionalLight.shadowMaxZ = (20 + shadowMaxZOffset) * worldScale;
    directionalLight.shadowMinZ = (-20 + shadowMinZOffset) * worldScale;
    directionalLight.orthoTop = (18 + orthoTopOffset) * worldScale;
    directionalLight.orthoBottom = (-3 + orthoBottomOffset) * worldScale;
    directionalLight.orthoLeft = (-10 + orthoLeftOffset) * worldScale;
    directionalLight.orthoRight = (10 + orthoRightOffset) * worldScale;
    directionalLight.shadowOrthoScale = 0;

    // const directionalLightFrustumViewer = new DirectionalLightFrustumViewer(directionalLight, scene.cameras[0]);
    // scene.onBeforeRenderObservable.add(() => directionalLightFrustumViewer.update());

    const shadowGenerator = new ShadowGenerator(1024, directionalLight, true);
    shadowGenerator.usePercentageCloserFiltering = true;
    shadowGenerator.forceBackFacesOnly = false;
    shadowGenerator.bias = 0.01;
    shadowGenerator.filteringQuality = ShadowGenerator.QUALITY_MEDIUM;
    shadowGenerator.frustumEdgeFalloff = 0.1;

    return {
        hemisphericLight,
        directionalLight,
        shadowGenerator
    };
}
