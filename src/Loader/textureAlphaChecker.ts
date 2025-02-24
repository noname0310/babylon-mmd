import { Constants } from "@babylonjs/core/Engines/constants";
import { Material } from "@babylonjs/core/Materials/material";
import { ShaderLanguage } from "@babylonjs/core/Materials/shaderLanguage";
import { ShaderMaterial } from "@babylonjs/core/Materials/shaderMaterial";
import type { BaseTexture } from "@babylonjs/core/Materials/Textures/baseTexture";
import { RenderTargetTexture } from "@babylonjs/core/Materials/Textures/renderTargetTexture";
import { Color4 } from "@babylonjs/core/Maths/math.color";
import type { Mesh } from "@babylonjs/core/Meshes/mesh";
import type { SubMesh } from "@babylonjs/core/Meshes/subMesh";
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
                format: engine.isWebGPU || engine.version > 1 ? Constants.TEXTUREFORMAT_RED : Constants.TEXTUREFORMAT_RGBA,
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

    private async _renderTexture(
        texture: BaseTexture,
        mesh: Mesh,
        subMeshIndex: number | null
    ): Promise<Uint8Array> {
        const shader = TextureAlphaChecker._GetShader(this._scene);
        shader.setTexture("textureSampler", texture);

        let originalSubMeshes: Nullable<SubMesh[]> = null;
        if (subMeshIndex !== null) {
            originalSubMeshes = mesh.subMeshes;
            mesh.subMeshes = [mesh.subMeshes[subMeshIndex]];
        }

        const renderTargetTexture = this._renderTargetTexture;
        renderTargetTexture.renderList = [mesh];
        renderTargetTexture.setMaterialForRendering(mesh, shader);

        // NOTE: there is too much internal api access here, becareful to babylon.js internal changes
        const isEnabled = (mesh as any)._nodeDataStorage._isEnabled;
        const isParentEnabled = (mesh as any)._nodeDataStorage._isParentEnabled;

        // wait for the RTT and shader to be ready
        for (; ;) {
            (mesh as any)._nodeDataStorage._isEnabled = true;
            (mesh as any)._nodeDataStorage._isParentEnabled = true;
            if (renderTargetTexture.isReadyForRendering() && shader.isReady()) break;
            (mesh as any)._nodeDataStorage._isEnabled = isEnabled;
            (mesh as any)._nodeDataStorage._isParentEnabled = isParentEnabled;

            await new Promise<void>(resolve => {
                setTimeout(resolve, 0);
            });

            if (renderTargetTexture._texture === null) {
                return new Uint8Array(0);
            }
        }

        // this operation will mutate `mesh._internalAbstractMeshDataInfo._currentLOD` but it safe because we not use lod for mmd models
        renderTargetTexture.render(false, false);

        (mesh as any)._nodeDataStorage._isParentEnabled = isParentEnabled;
        (mesh as any)._nodeDataStorage._isEnabled = isEnabled;

        const effect = shader.getEffect();
        mesh.geometry!._releaseVertexArrayObject(effect);
        const subMeshes = mesh.subMeshes;
        for (let i = 0, len = subMeshes.length; i < len; ++i) {
            subMeshes[i]._removeDrawWrapper(renderTargetTexture.renderPassId, true);
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
        // {
        //     const debugCanvas = document.createElement("canvas");
        //     debugCanvas.style.width = "256px";
        //     debugCanvas.style.height = "256px";
        //     debugCanvas.width = debugCanvas.height = renderTargetTexture.getSize().width;
        //     const debugContext = debugCanvas.getContext("2d")!;
        //     const imageData = debugContext.createImageData(debugCanvas.width, debugCanvas.height);
        //     const data = imageData.data;
        //     for (let i = 0, len = resultPixelsBuffer.length; i < len; ++i) {
        //         data[i] = resultPixelsBuffer[i];
        //     }
        //     debugContext.putImageData(imageData, 0, 0);

        //     const div = document.createElement("div");
        //     document.body.appendChild(div);

        //     const text = document.createElement("p");
        //     text.textContent = "mesh: " + mesh.name;
        //     div.appendChild(text);

        //     const img = document.createElement("img");
        //     img.src = debugCanvas.toDataURL();
        //     div.appendChild(img);
        // }

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
            const r = resultPixelsBuffer[index];
            maxValue = Math.max(maxValue, r);
            if (0 < r && r < 255) {
                averageMidddleAlpha += r;
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
        if (!texture.isReady()) throw new Error("Texture is not ready");

        if (this._blockRendering) {
            await new Promise<void>(resolve => {
                this._taskQueue.push(resolve);
            });
        }

        this._blockRendering = true;
        const resultPixelsBuffer = await this._renderTexture(texture, mesh, subMeshIndex);

        for (let index = 0; index < resultPixelsBuffer.length; index += 4) {
            if (resultPixelsBuffer[index] !== 0) {
                this._blockRendering = false;
                const nextTask = this._taskQueue.shift();
                if (nextTask !== undefined) nextTask();

                return false; // if r is not 0, it is not opaque
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

    private static _GetShader(scene: Scene): ShaderMaterial {
        if (!scene._textureAlphaCheckerShader) {
            const shaderLanguage = scene.getEngine().isWebGPU ? ShaderLanguage.WGSL : ShaderLanguage.GLSL;

            const shader = new ShaderMaterial(
                "textureAlphaChecker",
                scene,
                {
                    vertex: "textureAlphaChecker",
                    fragment: "textureAlphaChecker"
                },
                {
                    needAlphaBlending: false,
                    needAlphaTesting: false,
                    attributes: ["uv"],
                    uniforms: [],
                    samplers: ["textureSampler"],
                    shaderLanguage: shaderLanguage,
                    extraInitializationsAsync: async(): Promise<void> => {
                        if (shaderLanguage === ShaderLanguage.WGSL) {
                            await Promise.all([import("./ShadersWGSL/textureAlphaChecker.fragment"), import("./ShadersWGSL/textureAlphaChecker.vertex")]);
                        } else {
                            await Promise.all([import("./Shaders/textureAlphaChecker.fragment"), import("./Shaders/textureAlphaChecker.vertex")]);
                        }
                    }
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

    /**
     * Dispose the texture alpha checker shader from the scene
     *
     * If you are no longer loading the mmd model, it will be helpful for your memory to call this method and dispose the shader
     * @param scene Scene
     */
    public static DisposeShader(scene: Scene): void {
        scene._textureAlphaCheckerShader?.dispose();
        scene._textureAlphaCheckerShader = null;
    }
}
