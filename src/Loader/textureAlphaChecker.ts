import { Constants } from "@babylonjs/core/Engines/constants";
import { Material } from "@babylonjs/core/Materials/material";
import { ShaderLanguage } from "@babylonjs/core/Materials/shaderLanguage";
import { ShaderMaterial } from "@babylonjs/core/Materials/shaderMaterial";
import { RenderTargetTexture } from "@babylonjs/core/Materials/Textures/renderTargetTexture";
import type { Texture } from "@babylonjs/core/Materials/Textures/texture";
import { Color4 } from "@babylonjs/core/Maths/math.color";
import type { Mesh } from "@babylonjs/core/Meshes/mesh";
import type { Scene } from "@babylonjs/core/scene";
import type { Nullable } from "@babylonjs/core/types";

declare module "@babylonjs/core/scene" {
    export interface Scene {
        /** @internal */
        _textureAlphaCheckerShader: Nullable<ShaderMaterial>;
    }
}

declare module "@babylonjs/core/Materials/Textures/renderTargetTexture" {
    export interface RenderTargetTexture {
        /**
         * Gets or sets a boolean indicating that the prepass renderer should not be used with this render target
         */
        noPrePassRenderer: boolean;
    }
}

/**
 * Material transparency mode
 *
 * Constants are same as Babylon.js MaterialTransparencyMode
 */
export enum TransparencyMode {
    Opaque = Material.MATERIAL_OPAQUE,
    AlphaTest = Material.MATERIAL_ALPHATEST,
    AlphaBlend = Material.MATERIAL_ALPHABLEND
}

/**
 * Texture alpha checker
 *
 * This class is used to check if the texture has alpha on geometry
 */
export class TextureAlphaChecker {
    private readonly _scene: Scene;
    private readonly _renderTargetTexture: RenderTargetTexture;
    private readonly _resultPixelsBuffer: Uint8Array;

    /**
     * Create a texture alpha checker
     * @param scene Scene
     * @param resolution Resolution of the canvas used to check the texture
     */
    public constructor(scene: Scene, resolution = 512) {
        this._scene = scene;

        const engine = scene.getEngine();
        const renderTargetTexture = this._renderTargetTexture = new RenderTargetTexture(
            "texture_alpha_checker",
            resolution,
            scene,
            {
                generateDepthBuffer: false,
                generateStencilBuffer: false,
                generateMipMaps: false,
                type: Constants.TEXTURETYPE_UNSIGNED_BYTE,
                format: engine.isWebGPU || engine.webGLVersion > 1 ? Constants.TEXTUREFORMAT_RED : Constants.TEXTUREFORMAT_RGBA,
                doNotChangeAspectRatio: true
            }
        );
        renderTargetTexture.noPrePassRenderer = true;
        renderTargetTexture.anisotropicFilteringLevel = 1;
        renderTargetTexture.renderParticles = false;
        renderTargetTexture.optimizeUVAllocation = true;
        renderTargetTexture.ignoreCameraViewport = true;
        renderTargetTexture.clearColor = new Color4(0, 0, 0, 1);

        this._resultPixelsBuffer = new Uint8Array(resolution * resolution * 4);
    }

    private _blockRendering = false;
    private readonly _taskQueue: (() => void)[] = [];

    /**
     * Check if the texture has alpha on geometry
     *
     * "Does the textures on the geometry have alpha" is simply to make sure that a portion of the textures (the part that is rendered) have alpha
     * @param texture Texture to check (must be ready)
     * @param mesh Mesh to check
     * @param alphaThreshold alpha threshold
     * @param alphaBlendThreshold alpha blend threshold
     * @returns Transparency mode
     * @throws If the texture is not ready
     */
    public async textureHasAlphaOnGeometry(
        texture: Texture,
        mesh: Mesh,
        alphaThreshold: number,
        alphaBlendThreshold: number
    ): Promise<TransparencyMode> {
        if (!texture.isReady()) throw new Error("Texture is not ready");

        if (this._blockRendering) {
            await new Promise<void>(resolve => {
                this._taskQueue.push(resolve);
            });
        }

        const shader = TextureAlphaChecker._GetShader(this._scene);
        shader.setTexture("textureSampler", texture);

        const renderTargetTexture = this._renderTargetTexture;
        renderTargetTexture.renderList = [mesh];
        renderTargetTexture.setMaterialForRendering(mesh, shader);

        // NOTE: there is too much internal api access here, becareful to babylon.js internal changes
        const currentLODIsUpToDate = mesh._internalAbstractMeshDataInfo._currentLODIsUpToDate;
        const currentLOD = mesh._internalAbstractMeshDataInfo._currentLOD;
        mesh._internalAbstractMeshDataInfo._currentLODIsUpToDate = true;
        mesh._internalAbstractMeshDataInfo._currentLOD = mesh;

        const isEnabled = (mesh as any)._nodeDataStorage._isEnabled;
        const isParentEnabled = (mesh as any)._nodeDataStorage._isParentEnabled;
        (mesh as any)._nodeDataStorage._isEnabled = true;
        (mesh as any)._nodeDataStorage._isParentEnabled = true;

        renderTargetTexture.render(false, false);

        (mesh as any)._nodeDataStorage._isParentEnabled = isParentEnabled;
        (mesh as any)._nodeDataStorage._isEnabled = isEnabled;

        mesh._internalAbstractMeshDataInfo._currentLOD = currentLOD;
        mesh._internalAbstractMeshDataInfo._currentLODIsUpToDate = currentLODIsUpToDate;

        const effect = shader.getEffect();
        mesh.geometry!._releaseVertexArrayObject(effect);
        const subMeshes = mesh.subMeshes;
        for (let i = 0, len = subMeshes.length; i < len; ++i) {
            subMeshes[i]._removeDrawWrapper(renderTargetTexture.renderPassId, true);
        }

        const resultPixelsBuffer = this._resultPixelsBuffer;
        this._blockRendering = true;
        await renderTargetTexture.readPixels(
            undefined, // faceIndex
            undefined, // level
            resultPixelsBuffer // buffer
        );
        this._blockRendering = false;

        const nextTask = this._taskQueue.shift();
        if (nextTask !== undefined) nextTask();

        let maxValue = 0;
        let averageMidddleAlpha = 0;
        let averageMidddleAlphaCount = 0;

        const width = renderTargetTexture.getRenderWidth();
        const height = renderTargetTexture.getRenderHeight();
        for (let i = 0; i < width; ++i) {
            for (let j = 0; j < height; ++j) {
                const index = (i * width + j) * 4;
                const r = resultPixelsBuffer[index];
                maxValue = Math.max(maxValue, r);
                if (0 < r && r < 255) {
                    averageMidddleAlpha += r;
                    averageMidddleAlphaCount += 1;
                }
            }
        }

        if (averageMidddleAlphaCount !== 0) {
            averageMidddleAlpha /= averageMidddleAlphaCount;
        }

        if (maxValue < alphaThreshold) {
            return TransparencyMode.Opaque;
        }

        if (averageMidddleAlpha + alphaBlendThreshold < maxValue) {
            return TransparencyMode.AlphaTest;
        } else {
            return TransparencyMode.AlphaBlend;
        }
    }

    /**
     * Dispose this object
     */
    public dispose(): void {
        this._renderTargetTexture.dispose();
    }

    private static _GetShader(scene: Scene): ShaderMaterial {
        if (!scene._textureAlphaCheckerShader) {
            const shader = new ShaderMaterial(
                "textureAlphaCheckerShader",
                scene,
                {
                    vertexSource: /* glsl */`
                        precision highp float;
                        attribute vec2 uv;
                        varying vec2 vUv;

                        void main() {
                            vUv = uv;
                            gl_Position = vec4(uv * 2.0 - 1.0, 0.0, 1.0);
                        }
                    `,
                    fragmentSource: /* glsl */`
                        precision highp float;
                        uniform sampler2D textureSampler;
                        varying vec2 vUv;

                        void main() {
                            gl_FragColor = vec4(vec3(1.0) - vec3(texture2D(textureSampler, vUv).a), 1.0);
                        }
                    `
                },
                {
                    needAlphaBlending: false,
                    needAlphaTesting: false,
                    attributes: ["uv"],
                    uniforms: [],
                    samplers: ["textureSampler"],
                    shaderLanguage: ShaderLanguage.GLSL
                }
            );
            shader.backFaceCulling = false;
            shader.alphaMode = Constants.ALPHA_DISABLE;

            scene.onDisposeObservable.add(() => {
                scene._textureAlphaCheckerShader?.dispose();
                scene._textureAlphaCheckerShader = null;
            });

            scene._textureAlphaCheckerShader = shader;
        }

        return scene._textureAlphaCheckerShader;
    }

    public static DisposeShader(scene: Scene): void {
        scene._textureAlphaCheckerShader?.dispose();
        scene._textureAlphaCheckerShader = null;
    }
}
