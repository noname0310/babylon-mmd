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
 * - sphereTexture: (custom implementation)
 * - toonTexture: (custom implementation)
 *
 * using options:
 *
 * useAlphaFromDiffuseTexture
 *
 * additinal implementation:
 *
 * spherical deformation
 */

// https://cyos.babylonjs.com/

export class MmdPluginMererialDefines extends BABYLON.MaterialDefines {
    /* eslint-disable @typescript-eslint/naming-convention */
    public SPHERE_MAP = false;
    /* eslint-enable @typescript-eslint/naming-convention */
}

export class MmdPluginMaterial extends BABYLON.MaterialPluginBase {
    public sphereMap: BABYLON.Texture | null = null;

    private _isEnabled = false;

    public get isEnabled(): boolean {
        return this._isEnabled;
    }

    public set isEnabled(value: boolean) {
        if (this._isEnabled === value) return;
        this._isEnabled = value;
        this.markAllDefinesAsDirty();
        this._enable(value);
    }

    public constructor(material: BABYLON.StandardMaterial, addtoPluginList = true) {
        super(material, "MmdMaterial", 100, new MmdPluginMererialDefines(), addtoPluginList);
    }

    public override isReadyForSubMesh(defines: BABYLON.MaterialDefines, scene: BABYLON.Scene): boolean {
        if (!this._isEnabled) return true;

        if (defines._areTexturesDirty && scene.texturesEnabled) {
            if (this.sphereMap && !this.sphereMap.isReadyOrNotBlocking()) {
                return false;
            }
        }

        return true;
    }

    public override bindForSubMesh(uniformBuffer: BABYLON.UniformBuffer, scene: BABYLON.Scene): void {
        if (!this._isEnabled) return;

        if (scene.texturesEnabled) {
            if (this.sphereMap) {
                uniformBuffer.setTexture("sphereSampler", this.sphereMap);
            }
        }
    }

    public override dispose(forceDisposeTextures?: boolean | undefined): void {
        if (forceDisposeTextures) {
            this.sphereMap?.dispose();
            this.sphereMap = null;
        }
    }

    public override getCustomCode(shaderType: string): BABYLON.Nullable<{ [pointName: string]: string; }> {
        if (shaderType === "fragment") return {
            /* eslint-disable @typescript-eslint/naming-convention */
            "CUSTOM_FRAGMENT_MAIN_END": `
                #ifdef SPHERE_MAP
                    vec3 reflectionVector = normalize(vPositionW - cameraPosition);
                    vec3 reflectionColor = textureCube(sphereSampler, reflectionVector).rgb;
                    diffuseColor.rgb = reflectionColor;
                #endif
            `
            /* eslint-enable @typescript-eslint/naming-convention */
        };
        return null;
    }

    public override prepareDefines(defines: MmdPluginMererialDefines): void {
        if (this._isEnabled) {
            defines.SPHERE_MAP = this.sphereMap !== null;
        } else {
            defines.SPHERE_MAP = false;
        }
    }

    public override hasTexture(texture: BABYLON.BaseTexture): boolean {
        return this.sphereMap === texture;
    }

    public override getActiveTextures(activeTextures: BABYLON.BaseTexture[]): void {
        if (this.sphereMap) {
            activeTextures.push(this.sphereMap);
        }
    }

    public override getAnimatables(animatables: BABYLON.IAnimatable[]): void {
        if (this.sphereMap && this.sphereMap.animations && 0 < this.sphereMap.animations.length) {
            animatables.push(this.sphereMap);
        }
    }

    public override getSamplers(samplers: string[]): void {
        if (this._isEnabled) {
            samplers.push("sphereSampler");
        }
    }

    public override getClassName(): string {
        return "MmdPluginMaterial";
    }
}
