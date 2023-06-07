import type {
    AbstractMesh,
    BaseTexture,
    Engine,
    IAnimatable,
    Mesh,
    Nullable,
    Scene,
    StandardMaterial,
    SubMesh,
    Texture,
    UniformBuffer} from "@babylonjs/core";
import {
    Constants,
    MaterialDefines,
    MaterialPluginBase
} from "@babylonjs/core";

import { SdefBufferKind } from "./SdefBufferKind";

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

// spherical environment mapping reference:
// https://learn.microsoft.com/en-us/windows/win32/direct3d9/spherical-environment-mapping

export class MmdPluginMererialDefines extends MaterialDefines {
    /* eslint-disable @typescript-eslint/naming-convention */
    public SPHERE_TEXTURE = false;
    public SPHERE_TEXTURE_BLEND_MODE_MULTIPLY = false;
    public SPHERE_TEXTURE_BLEND_MODE_ADD = false;
    public TOON_TEXTURE = false;
    public IGNORE_DIFFUSE_WHEN_TOON_TEXTURE_DISABLED = false;
    public SDEF = false;
    /* eslint-enable @typescript-eslint/naming-convention */
}

export enum MmdPluginMaterialSphereTextureBlendMode {
    Multiply = 1,
    Add = 2
}

export class MmdPluginMaterial extends MaterialPluginBase {
    private _sphereTexture: Texture | null = null;
    private _sphereTextureBlendMode = MmdPluginMaterialSphereTextureBlendMode.Add;

    private _toonTexture: Texture | null = null;
    private _ignoreDiffuseWhenToonTextureIsNull = false;

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

    public get sphereTexture(): Texture | null {
        return this._sphereTexture;
    }

    public set sphereTexture(value: Texture | null) {
        if (this._sphereTexture === value) return;
        this._sphereTexture = value;
        this._markAllSubMeshesAsTexturesDirty();
    }

    public get sphereTextureBlendMode(): MmdPluginMaterialSphereTextureBlendMode {
        return this._sphereTextureBlendMode;
    }

    public set sphereTextureBlendMode(value: MmdPluginMaterialSphereTextureBlendMode) {
        if (this._sphereTextureBlendMode === value) return;
        this._sphereTextureBlendMode = value;
        this.markAllDefinesAsDirty();
    }

    public get toonTexture(): Texture | null {
        return this._toonTexture;
    }

    public set toonTexture(value: Texture | null) {
        if (this._toonTexture === value) return;
        this._toonTexture = value;
        this._markAllSubMeshesAsTexturesDirty();
    }

    public get ignoreDiffuseWhenToonTextureIsNull(): boolean {
        return this._ignoreDiffuseWhenToonTextureIsNull;
    }

    public set ignoreDiffuseWhenToonTextureIsNull(value: boolean) {
        if (this._ignoreDiffuseWhenToonTextureIsNull === value) return;
        this._ignoreDiffuseWhenToonTextureIsNull = value;
        this.markAllDefinesAsDirty();
    }

    private readonly _markAllSubMeshesAsTexturesDirty: () => void;

    public constructor(material: StandardMaterial, addtoPluginList = true) {
        super(material, "MmdMaterial", 100, new MmdPluginMererialDefines(), addtoPluginList);

        this._markAllSubMeshesAsTexturesDirty = material._dirtyCallbacks[Constants.MATERIAL_TextureDirtyFlag];
    }

    public override isReadyForSubMesh(defines: MaterialDefines, scene: Scene): boolean {
        if (!this._isEnabled) return true;

        if (defines._areTexturesDirty && scene.texturesEnabled) {
            if (this._sphereTexture && !this._sphereTexture.isReadyOrNotBlocking()) {
                return false;
            }
        }

        return true;
    }

    public override bindForSubMesh(uniformBuffer: UniformBuffer, scene: Scene, _engine: Engine, _subMesh: SubMesh): void {
        if (!this._isEnabled) return;

        if (scene.texturesEnabled) {
            if (this._sphereTexture) uniformBuffer.setTexture("sphereSampler", this._sphereTexture);

            if (this._toonTexture) uniformBuffer.setTexture("toonSampler", this._toonTexture);
        }
    }

    public override dispose(forceDisposeTextures?: boolean | undefined): void {
        if (forceDisposeTextures) {
            this._sphereTexture?.dispose();
            this._toonTexture?.dispose();
        }
    }

    public override getCustomCode(shaderType: string): Nullable<{ [pointName: string]: string; }> {
        if (shaderType === "vertex") {
            const codes: { [pointName: string]: string; } = {};

            codes["CUSTOM_VERTEX_DEFINITIONS"] = /* glsl */`
                #if defined(SDEF)
                    attribute vec3 matricesSdefC;
                    attribute vec3 matricesSdefR0;
                    attribute vec3 matricesSdefR1;

                    vec4 rotationMatrixToQuaternion(mat3 matrix) {
                        float trace = matrix[0][0] + matrix[1][1] + matrix[2][2];
                        float s;

                        if (trace > 0.0) {
                            s = 0.5 / sqrt(trace + 1.0);

                            return vec4(
                                (matrix[1][2] - matrix[2][1]) * s,
                                (matrix[2][0] - matrix[0][2]) * s,
                                (matrix[0][1] - matrix[1][0]) * s,
                                0.25 / s
                            );
                        } else if (matrix[0][0] > matrix[1][1] && matrix[0][0] > matrix[2][2]) {
                            s = 2.0 * sqrt(1.0 + matrix[0][0] - matrix[1][1] - matrix[2][2]);

                            return vec4(
                                0.25 * s,
                                (matrix[0][1] + matrix[1][0]) / s,
                                (matrix[2][0] + matrix[0][2]) / s,
                                (matrix[1][2] - matrix[2][1]) / s
                            );
                        } else if (matrix[1][1] > matrix[2][2]) {
                            s = 2.0 * sqrt(1.0 + matrix[1][1] - matrix[0][0] - matrix[2][2]);
                            
                            return vec4(
                                (matrix[0][1] + matrix[1][0]) / s,
                                0.25 * s,
                                (matrix[1][2] + matrix[2][1]) / s,
                                (matrix[2][0] - matrix[0][2]) / s
                            );
                        } else {
                            s = 2.0 * sqrt(1.0 + matrix[2][2] - matrix[0][0] - matrix[1][1]);

                            return vec4(
                                (matrix[2][0] + matrix[0][2]) / s,
                                (matrix[1][2] + matrix[2][1]) / s,
                                0.25 * s,
                                (matrix[0][1] - matrix[1][0]) / s
                            );
                        }
                    }

                    mat3 quaternionToRotationMatrix(vec4 q) {
                        float xx = q.x * q.x;
                        float yy = q.y * q.y;
                        float zz = q.z * q.z;
                        float xy = q.x * q.y;
                        float zw = q.z * q.w;
                        float zx = q.z * q.x;
                        float yw = q.y * q.w;
                        float yz = q.y * q.z;
                        float xw = q.x * q.w;

                        return mat3(
                            1.0 - 2.0 * (yy + zz), 2.0 * (xy + zw), 2.0 * (zx - yw),
                            2.0 * (xy - zw), 1.0 - 2.0 * (zz + xx), 2.0 * (yz + xw),
                            2.0 * (zx + yw), 2.0 * (yz - xw), 1.0 - 2.0 * (yy + xx)
                        );
                    }

                    vec4 slerp(vec4 q0, vec4 q1, float t) {
                        float cosTheta = dot(q0, q1);

                        if (cosTheta < 0.0) {
                            q1 = -q1;
                            cosTheta = -cosTheta;
                        }
                        
                        if (cosTheta > 0.999999) {
                            return normalize(mix(q0, q1, t));
                        }

                        float theta = acos(cosTheta);
                        float sinTheta = sin(theta);

                        float w0 = sin((1.0 - t) * theta) / sinTheta;
                        float w1 = sin(t * theta) / sinTheta;

                        return q0 * w0 + q1 * w1;
                    }
                #endif
            `;

            codes[`!${this.escapeRegExp("finalWorld=finalWorld*influence;")}`] = /* glsl */`
                #if defined(SDEF)
                {
                    float weight0 = matricesWeights[0];
                    float weight1 = matricesWeights[1];

                    #ifdef BONETEXTURE
                        mat4 transformMatrix0 = readMatrixFromRawSampler(boneSampler, matricesIndices[0]);
                        mat4 transformMatrix1 = readMatrixFromRawSampler(boneSampler, matricesIndices[1]);
                    #else
                        mat4 transformMatrix0 = mBones[int(matricesIndices[0])];
                        mat4 transformMatrix1 = mBones[int(matricesIndices[1])];
                    #endif

                    mat3 slerpedRotationMatrix = quaternionToRotationMatrix(slerp(
                        rotationMatrixToQuaternion(mat3(transformMatrix0)), 
                        rotationMatrixToQuaternion(mat3(transformMatrix1)),
                        weight1
                    ));

                    // -center transform
                    mat4 sdefInflunce = mat4(
                        vec4(1.0, 0.0, 0.0, 0.0),
                        vec4(0.0, 1.0, 0.0, 0.0),
                        vec4(0.0, 0.0, 1.0, 0.0),
                        vec4(-matricesSdefC, 1.0)
                    );

                    // rotation
                    mat4 rotationMatrix = mat4(
                        vec4(slerpedRotationMatrix[0], 0.0),
                        vec4(slerpedRotationMatrix[1], 0.0),
                        vec4(slerpedRotationMatrix[2], 0.0),
                        vec4(0.0, 0.0, 0.0, 1.0)
                    );
                    sdefInflunce = rotationMatrix * sdefInflunce;

                    // add position offset
                    vec3 positionOffset =
                        vec3(transformMatrix0 * vec4(matricesSdefR0, 1)) * weight0 +
                        vec3(transformMatrix1 * vec4(matricesSdefR1, 1)) * weight1;

                    sdefInflunce[3] += vec4(positionOffset, 0.0);
                    
                    float useLinearDeform = step(0.0, -abs(matricesSdefR0.x));

                    influence = mat4(
                        mix(sdefInflunce[0], influence[0], useLinearDeform),
                        mix(sdefInflunce[1], influence[1], useLinearDeform),
                        mix(sdefInflunce[2], influence[2], useLinearDeform),
                        mix(sdefInflunce[3], influence[3], useLinearDeform)
                    );
                }
                #endif
                
                finalWorld = finalWorld * influence;
            `;

            return codes;
        }

        if (shaderType === "fragment") {
            const codes: { [pointName: string]: string; } = {};

            codes["CUSTOM_FRAGMENT_DEFINITIONS"] = /* glsl */`
                #if defined(SPHERE_TEXTURE) && defined(NORMAL)
                    uniform sampler2D sphereSampler;
                #endif
                #ifdef TOON_TEXTURE
                    uniform sampler2D toonSampler;
                #endif
            `;

            codes["CUSTOM_FRAGMENT_MAIN_BEGIN"] = /* glsl */`
                #ifdef TOON_TEXTURE
                    vec3 clampedInfoDiffuse;
                    float infoToonDiffuseR;
                    float infoToonDiffuseG;
                    float infoToonDiffuseB;

                    vec3 infoToonDiffuse;
                #endif
            `;

            codes[`!${this.escapeRegExp("diffuseBase+=info.diffuse*shadow;")}`] = /* glsl */`
                #ifdef TOON_TEXTURE
                    clampedInfoDiffuse = clamp(info.diffuse, 0.0, 1.0);
                    infoToonDiffuseR = texture2D(toonSampler, vec2(0.5, clampedInfoDiffuse.r)).r;
                    infoToonDiffuseG = texture2D(toonSampler, vec2(0.5, clampedInfoDiffuse.g)).g;
                    infoToonDiffuseB = texture2D(toonSampler, vec2(0.5, clampedInfoDiffuse.b)).b;
                    
                    infoToonDiffuse = vec3(infoToonDiffuseR, infoToonDiffuseG, infoToonDiffuseB);

                    diffuseBase += infoToonDiffuse * shadow;
                #elif defined(IGNORE_DIFFUSE_WHEN_TOON_TEXTURE_DISABLED)
                    diffuseBase += vec3(1.0, 1.0, 1.0) * shadow;
                #else
                    diffuseBase += info.diffuse * shadow;
                #endif
            `;

            codes["CUSTOM_FRAGMENT_BEFORE_FOG"] = /* glsl */`
                #if defined(SPHERE_TEXTURE) && defined(NORMAL)
                    vec3 viewSpaceNormal = normalize(mat3(view) * vNormalW);

                    vec2 sphereUV = viewSpaceNormal.xy * 0.5 + 0.5;

                    vec4 sphereReflectionColor = texture2D(sphereSampler, sphereUV);

                    #ifdef SPHERE_TEXTURE_BLEND_MODE_MULTIPLY
                        color *= sphereReflectionColor;
                    #elif defined(SPHERE_TEXTURE_BLEND_MODE_ADD)
                        color += vec4(sphereReflectionColor.rgb, sphereReflectionColor.a * alpha);
                    #endif
                #endif
            `;

            return codes;
        }
        return null;
    }

    public override prepareDefines(defines: MmdPluginMererialDefines, scene: Scene, mesh: Mesh): void {
        if (this._isEnabled) {
            const texturesEnabled = scene.texturesEnabled;
            defines.SPHERE_TEXTURE = this._sphereTexture !== null && texturesEnabled;
            defines.SPHERE_TEXTURE_BLEND_MODE_MULTIPLY = this._sphereTextureBlendMode === MmdPluginMaterialSphereTextureBlendMode.Multiply;
            defines.SPHERE_TEXTURE_BLEND_MODE_ADD = this._sphereTextureBlendMode === MmdPluginMaterialSphereTextureBlendMode.Add;
            defines.TOON_TEXTURE = this._toonTexture !== null && texturesEnabled;
            defines.IGNORE_DIFFUSE_WHEN_TOON_TEXTURE_DISABLED = this._ignoreDiffuseWhenToonTextureIsNull;
            defines.SDEF = mesh.isVerticesDataPresent(SdefBufferKind.matricesSdefCKind) && 1 < mesh.numBoneInfluencers;
        } else {
            defines.SPHERE_TEXTURE = false;
            defines.SPHERE_TEXTURE_BLEND_MODE_MULTIPLY = false;
            defines.SPHERE_TEXTURE_BLEND_MODE_ADD = false;
            defines.TOON_TEXTURE = false;
            defines.IGNORE_DIFFUSE_WHEN_TOON_TEXTURE_DISABLED = false;
            defines.SDEF = false;
        }
    }

    public override hasTexture(texture: BaseTexture): boolean {
        return this._sphereTexture === texture || this._toonTexture === texture;
    }

    public override getActiveTextures(activeTextures: BaseTexture[]): void {
        if (this._sphereTexture) activeTextures.push(this._sphereTexture);

        if (this._toonTexture) activeTextures.push(this._toonTexture);
    }

    public override getAnimatables(animatables: IAnimatable[]): void {
        if (this._sphereTexture && this._sphereTexture.animations && 0 < this._sphereTexture.animations.length) {
            animatables.push(this._sphereTexture);
        }

        if (this._toonTexture && this._toonTexture.animations && 0 < this._toonTexture.animations.length) {
            animatables.push(this._toonTexture);
        }
    }

    public override getSamplers(samplers: string[]): void {
        if (this._isEnabled) {
            if (this._sphereTexture) samplers.push("sphereSampler");
            if (this._toonTexture) samplers.push("toonSampler");
        }
    }

    public override getAttributes(attributes: string[], _scene: Scene, mesh: AbstractMesh): void {
        if (this._isEnabled) {
            if (mesh.isVerticesDataPresent(SdefBufferKind.matricesSdefCKind) && 1 < mesh.numBoneInfluencers) {
                attributes.push(SdefBufferKind.matricesSdefCKind);
                attributes.push(SdefBufferKind.matricesSdefR0Kind);
                attributes.push(SdefBufferKind.matricesSdefR1Kind);
            }
        }
    }

    public override getClassName(): string {
        return "MmdPluginMaterial";
    }

    private escapeRegExp(string: string): string {
        return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    }
}
