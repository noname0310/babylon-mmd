import { Constants } from "@babylonjs/core/Engines/constants";
import { Material } from "@babylonjs/core/Materials/material";
import { ShaderLanguage } from "@babylonjs/core/Materials/shaderLanguage";
import { ShaderMaterial } from "@babylonjs/core/Materials/shaderMaterial";
import type { BaseTexture } from "@babylonjs/core/Materials/Textures/baseTexture";
import { RenderTargetTexture } from "@babylonjs/core/Materials/Textures/renderTargetTexture";
import { Color4 } from "@babylonjs/core/Maths/math.color";
import { VertexBuffer } from "@babylonjs/core/Meshes/buffer";
import type { Mesh } from "@babylonjs/core/Meshes/mesh";
import type { SubMesh } from "@babylonjs/core/Meshes/subMesh";
import type { Scene } from "@babylonjs/core/scene";
import type { Nullable } from "@babylonjs/core/types";

declare module "@babylonjs/core/scene" {
    export interface Scene {
        /** @internal */
        _textureAlphaCheckerTmeShader: Nullable<ShaderMaterial>;
        /** @internal */
        _textureAlphaCheckerOeShader: Nullable<ShaderMaterial>;
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

export enum TextureAlphaCheckerMode {
    TransparentModeEvaluation = 0,
    OpaqueEvaluation = 1
}

/**
 * Texture alpha checker
 *
 * This class is used to check if the texture has alpha on geometry
 */
export class TextureAlphaChecker {
    public readonly mode: TextureAlphaCheckerMode;
    private readonly _scene: Scene;
    private readonly _renderTargetTexture: RenderTargetTexture;
    private readonly _resultPixelsBuffer: Uint8Array;

    /**
     * Create a texture alpha checker
     * @param scene Scene
     * @param mode Mode
     * @param resolution Resolution of the canvas used to check the texture, if mode is OpaqueEvaluation, this value is ignored
     */
    public constructor(scene: Scene, mode: TextureAlphaCheckerMode, resolution = 512) {
        if (mode === TextureAlphaCheckerMode.OpaqueEvaluation) {
            resolution = 1000;
        }

        this.mode = mode;
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
                format: engine.isWebGPU || engine.version > 1 ? Constants.TEXTUREFORMAT_ALPHA : Constants.TEXTUREFORMAT_RGBA,
                doNotChangeAspectRatio: true
            }
        );
        renderTargetTexture.noPrePassRenderer = true;
        renderTargetTexture.anisotropicFilteringLevel = 1;
        renderTargetTexture.renderParticles = false;
        renderTargetTexture.optimizeUVAllocation = true;
        renderTargetTexture.ignoreCameraViewport = true;
        renderTargetTexture.clearColor = new Color4(0, 0, 0, 0);

        this._resultPixelsBuffer = new Uint8Array(resolution * resolution * 4);
    }

    private async _renderTexture(
        texture: BaseTexture,
        mesh: Mesh,
        subMeshIndex: number | null
    ): Promise<Uint8Array> {
        const shader = TextureAlphaChecker._GetShader(this._scene, this.mode);
        shader.setTexture("textureSampler", texture);

        let originalSubMeshes: Nullable<SubMesh[]> = null;
        if (subMeshIndex !== null) {
            originalSubMeshes = mesh.subMeshes;
            mesh.subMeshes = [mesh.subMeshes[subMeshIndex]];
        }

        if (this.mode === TextureAlphaCheckerMode.OpaqueEvaluation) {
            const geometry = mesh.geometry!;
            const oePosIndexBuffer = new Float32Array(geometry.getVerticesData(VertexBuffer.UVKind)!.length / 2);

            const indices = geometry.getIndices();
            if (indices === null) {
                for (let i = 0, len = oePosIndexBuffer.length; i < len; ++i) {
                    oePosIndexBuffer[i] = i;
                }
            } else {
                for (let i = 0, len = indices.length; i < len; i += 3) {
                    oePosIndexBuffer[indices[i]] = 0;
                    oePosIndexBuffer[indices[i + 1]] = 1;
                    oePosIndexBuffer[indices[i + 2]] = 2;
                }
            }

            geometry.setVerticesData("oePosIndex", oePosIndexBuffer, false, 1);
        }

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

        if (this.mode === TextureAlphaCheckerMode.OpaqueEvaluation) {
            mesh.geometry!.removeVerticesData("oePosIndex");
        }

        if (originalSubMeshes !== null) {
            mesh.subMeshes = originalSubMeshes;
        }

        const resultPixelsBuffer = this._resultPixelsBuffer;
        await renderTargetTexture.readPixels(
            undefined, // faceIndex
            undefined, // level
            resultPixelsBuffer // buffer
        );

        // // for debug
        {
            const debugCanvas = document.createElement("canvas");
            debugCanvas.style.width = "256px";
            debugCanvas.style.height = "256px";
            debugCanvas.width = debugCanvas.height = renderTargetTexture.getSize().width;
            const debugContext = debugCanvas.getContext("2d")!;
            const imageData = debugContext.createImageData(debugCanvas.width, debugCanvas.height);
            const data = imageData.data;
            for (let i = 0, len = resultPixelsBuffer.length; i < len; ++i) {
                data[i] = resultPixelsBuffer[i];
            }
            debugContext.putImageData(imageData, 0, 0);

            const div = document.createElement("div");
            document.body.appendChild(div);

            const text = document.createElement("p");
            text.textContent = "mesh: " + mesh.name;
            div.appendChild(text);

            const img = document.createElement("img");
            img.src = debugCanvas.toDataURL();
            img.style.width = "256px";
            img.style.height = "256px";
            img.style.imageRendering = "pixelated";
            div.appendChild(img);
        }

        return resultPixelsBuffer;
    }

    private _blockRendering = false;
    private readonly _taskQueue: (() => void)[] = [];

    /**
     * Check if the texture has translucent fragments on the geometry
     *
     * "Does the textures on the geometry have alpha" is simply to make sure that a portion of the textures (the part that is rendered) have alpha
     * @param texture Texture to check (must be ready)
     * @param mesh Mesh to check
     * @param subMeshIndices Sub mesh index to check (if null, all sub meshes are checked)
     * @param alphaThreshold alpha threshold
     * @param alphaBlendThreshold alpha blend threshold
     * @returns Transparency mode
     * @throws If the texture is not ready
     */
    public async hasTranslucentFragmentsOnGeometry(
        texture: BaseTexture,
        mesh: Mesh,
        subMeshIndex: number | null,
        alphaThreshold: number,
        alphaBlendThreshold: number
    ): Promise<TransparencyMode> {
        if (this.mode !== TextureAlphaCheckerMode.TransparentModeEvaluation) {
            throw new Error("This method can only be used in TransparentModeEvaluation mode");
        }
        if (!texture.isReady()) throw new Error("Texture is not ready");

        if (this._blockRendering) {
            await new Promise<void>(resolve => {
                this._taskQueue.push(resolve);
            });
        }

        this._blockRendering = true;
        const resultPixelsBuffer = await this._renderTexture(texture, mesh, subMeshIndex);

        let maxValue = 0;
        let averageMidddleAlpha = 0;
        let averageMidddleAlphaCount = 0;

        for (let index = 0; index < resultPixelsBuffer.length; index += 4) {
            const a = resultPixelsBuffer[index + 3];
            maxValue = Math.max(maxValue, a);
            if (0 < a && a < 255) {
                averageMidddleAlpha += a;
                averageMidddleAlphaCount += 1;
            }
        }

        if (averageMidddleAlphaCount !== 0) {
            averageMidddleAlpha /= averageMidddleAlphaCount;
        }

        this._blockRendering = false;
        const nextTask = this._taskQueue.shift();
        if (nextTask !== undefined) nextTask();

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
     * Check if texture fragments are completely opaque on the geometry
     * @param texture Texture to check (must be ready)
     * @param mesh Mesh to check
     * @param subMeshIndices Sub mesh index to check (if null, all sub meshes are checked)
     * @returns If the texture fragments are completely opaque in geometry
     */
    public async hasFragmentsOnlyOpaqueOnGeometry(
        texture: BaseTexture,
        mesh: Mesh,
        subMeshIndex: number | null
    ): Promise<boolean> {
        if (this.mode !== TextureAlphaCheckerMode.OpaqueEvaluation) {
            throw new Error("This method can only be used in OpaqueEvaluation mode");
        }
        if (!texture.isReady()) throw new Error("Texture is not ready");

        if (this._blockRendering) {
            await new Promise<void>(resolve => {
                this._taskQueue.push(resolve);
            });
        }

        this._blockRendering = true;
        const resultPixelsBuffer = await this._renderTexture(texture, mesh, subMeshIndex);

        for (let index = 0; index < resultPixelsBuffer.length; index += 4) {
            if (resultPixelsBuffer[index + 3] !== 0) {
                this._blockRendering = false;
                const nextTask = this._taskQueue.shift();
                if (nextTask !== undefined) nextTask();

                return false; // if a is not 0, it is not opaque
            }
        }

        this._blockRendering = false;
        const nextTask = this._taskQueue.shift();
        if (nextTask !== undefined) nextTask();

        return true;
    }

    /**
     * Dispose this object
     */
    public dispose(): void {
        this._renderTargetTexture.dispose();
    }

    private static readonly _TmeDisposeEventRegistered = new WeakSet<Scene>();
    private static readonly _OeDisposeEventRegistered = new WeakSet<Scene>();

    private static _GetShader(scene: Scene, mode: TextureAlphaCheckerMode): ShaderMaterial {
        let shader = mode === TextureAlphaCheckerMode.TransparentModeEvaluation
            ? scene._textureAlphaCheckerTmeShader
            : scene._textureAlphaCheckerOeShader;

        if (!shader) {
            const engine = scene.getEngine();
            const positionAttributeNeeded = mode === TextureAlphaCheckerMode.OpaqueEvaluation && !engine.isWebGPU && engine.version < 2;

            const glPositionExpression = /* glsl */`gl_Position = ${mode === TextureAlphaCheckerMode.OpaqueEvaluation
                ? "vec4(mod(mod(oePosIndex, 3.0), 2.0) * 2.0 - 1.0, mod(oePosIndex, 3.0) * 2.0 - 1.0, 0.0, 1.0);"
                : "vec4(mod(uv, 1.0) * 2.0 - 1.0, 0.0, 1.0);"
            }`;

            shader = new ShaderMaterial(
                "textureAlphaCheckerShader",
                scene,
                {
                    vertexSource: /* glsl */`
                        precision highp float;
                        attribute vec2 uv;
                        ${positionAttributeNeeded ? "attribute float oePosIndex;" : ""}

                        varying vec2 vUv;

                        void main() {
                            int vPosition = 0;
                            vUv = uv;
                            ${glPositionExpression}
                        }
                    `,
                    fragmentSource: /* glsl */`
                        precision highp float;
                        uniform sampler2D textureSampler;
                        varying vec2 vUv;

                        void main() {
                            gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0 - texture2D(textureSampler, vUv).a);
                        }
                    `
                },
                {
                    needAlphaBlending: false,
                    needAlphaTesting: false,
                    attributes: positionAttributeNeeded ? ["uv", "oePosIndex"] : ["uv"],
                    uniforms: [],
                    samplers: ["textureSampler"],
                    shaderLanguage: ShaderLanguage.GLSL
                }
            );
            shader.backFaceCulling = false;
            shader.alphaMode = mode === TextureAlphaCheckerMode.TransparentModeEvaluation
                ? Constants.ALPHA_DISABLE
                : Constants.ALPHA_ADD;

            if (mode === TextureAlphaCheckerMode.TransparentModeEvaluation) {
                if (!this._TmeDisposeEventRegistered.has(scene)) {
                    this._TmeDisposeEventRegistered.add(scene);
                    scene.onDisposeObservable.add(() => {
                        scene._textureAlphaCheckerTmeShader?.dispose();
                        scene._textureAlphaCheckerTmeShader = null;
                    });
                }

                scene._textureAlphaCheckerTmeShader = shader;
            } else {
                if (!this._OeDisposeEventRegistered.has(scene)) {
                    this._OeDisposeEventRegistered.add(scene);
                    scene.onDisposeObservable.add(() => {
                        scene._textureAlphaCheckerOeShader?.dispose();
                        scene._textureAlphaCheckerOeShader = null;
                    });
                }

                scene._textureAlphaCheckerOeShader = shader;
            }
        }

        return shader;
    }

    /**
     * Dispose the texture alpha checker shader from the scene
     *
     * If you are no longer loading the mmd model, it will be helpful for your memory to call this method and dispose the shader
     * @param scene Scene
     * @param mode Mode (if null, transparent mode evaluation shader and opaque evaluation shader are disposed)
     */
    public static DisposeShader(scene: Scene, mode: Nullable<TextureAlphaCheckerMode> = null): void {
        if (mode === null || mode === TextureAlphaCheckerMode.TransparentModeEvaluation) {
            scene._textureAlphaCheckerTmeShader?.dispose();
            scene._textureAlphaCheckerTmeShader = null;
        }
        if (mode === null || mode === TextureAlphaCheckerMode.OpaqueEvaluation) {
            scene._textureAlphaCheckerOeShader?.dispose();
            scene._textureAlphaCheckerOeShader = null;
        }
    }
}
