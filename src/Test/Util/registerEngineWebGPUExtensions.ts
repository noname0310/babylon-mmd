import { AbstractEngine } from "@babylonjs/core/Engines/abstractEngine.pure";
import { RegisterAbstractEngineStates } from "@babylonjs/core/Engines/AbstractEngine/abstractEngine.states.pure";
import { RegisterAbstractEngineStencil } from "@babylonjs/core/Engines/AbstractEngine/abstractEngine.stencil.pure";
import { RegisterAbstractEngineTexture } from "@babylonjs/core/Engines/AbstractEngine/abstractEngine.texture.pure";
import { RegisterEnginesWebGPUExtensionsEngineRenderTarget } from "@babylonjs/core/Engines/WebGPU/Extensions/engine.renderTarget.pure";
import { RegisterEnginesWebGPUExtensionsEngineRenderTargetTexture } from "@babylonjs/core/Engines/WebGPU/Extensions/engine.renderTargetTexture.pure";
import { _GetCompatibleTextureLoader } from "@babylonjs/core/Materials/Textures/Loaders/textureLoaderManager";

export function RegisterEngineWebGPUExtensions(): void {
    RegisterAbstractEngineStates();
    RegisterAbstractEngineStencil();
    RegisterAbstractEngineTexture();
    RegisterEnginesWebGPUExtensionsEngineRenderTarget();
    RegisterEnginesWebGPUExtensionsEngineRenderTargetTexture();
    AbstractEngine.GetCompatibleTextureLoader = _GetCompatibleTextureLoader; // core/Engines/AbstractEngine/abstractEngine.textureLoaders.ts
}
