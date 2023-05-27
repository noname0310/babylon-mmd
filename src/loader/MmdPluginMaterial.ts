import * as BABYLON from "@babylonjs/core";

/**
 * for convert MMD material to Babylon material
 * 
 * use StandardMaterial as base class
 * 
 * propertiy mapping:
 * 
 * - diffuse[0..2]: diffuseColor
 * - specular: specularColor
 * - ambient: ambientColor
 * - diffuse[3](opaque): alpha
 * - shininess(reflect): specularPower
 * - isDoubleSided: backFaceCulling
 * - enabledToonEdge: (custom implementation)
 * - edgeColor: (custom implementation)
 * - edgeSize: (custom implementation)
 * - texture: diffuseTexture
 * - toonTexture: (custom implementation)
 * 
 * using options:
 * 
 * useAlphaFromDiffuseTexture
 */

export class MmdPluginMaterial extends BABYLON.MaterialPluginBase {

}
