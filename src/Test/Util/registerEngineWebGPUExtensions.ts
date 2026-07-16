import { RegisterBufferAlign } from "@babylonjs/core/Buffers/buffer.align.pure";
import { AbstractEngine } from "@babylonjs/core/Engines/abstractEngine.pure";
import { RegisterAbstractEngineStates } from "@babylonjs/core/Engines/AbstractEngine/abstractEngine.states.pure";
import { RegisterAbstractEngineStencil } from "@babylonjs/core/Engines/AbstractEngine/abstractEngine.stencil.pure";
import { RegisterAbstractEngineTexture } from "@babylonjs/core/Engines/AbstractEngine/abstractEngine.texture.pure";
import { RegisterEnginesWebGPUExtensionsEngineAlpha } from "@babylonjs/core/Engines/WebGPU/Extensions/engine.alpha.pure";
import { RegisterEnginesWebGPUExtensionsEngineMultiRender } from "@babylonjs/core/Engines/WebGPU/Extensions/engine.multiRender.pure";
import { RegisterEnginesWebGPUExtensionsEngineRawTexture } from "@babylonjs/core/Engines/WebGPU/Extensions/engine.rawTexture.pure";
import { RegisterEnginesWebGPUExtensionsEngineReadTexture } from "@babylonjs/core/Engines/WebGPU/Extensions/engine.readTexture.pure";
import { RegisterEnginesWebGPUExtensionsEngineRenderTarget } from "@babylonjs/core/Engines/WebGPU/Extensions/engine.renderTarget.pure";
import { RegisterEnginesWebGPUExtensionsEngineRenderTargetTexture } from "@babylonjs/core/Engines/WebGPU/Extensions/engine.renderTargetTexture.pure";
import { _GetCompatibleTextureLoader } from "@babylonjs/core/Materials/Textures/Loaders/textureLoaderManager";

export function RegisterEngineWebGPUExtensions(): void {
    RegisterBufferAlign();
    RegisterAbstractEngineStates();
    RegisterAbstractEngineStencil();
    RegisterAbstractEngineTexture();
    RegisterEnginesWebGPUExtensionsEngineAlpha();
    RegisterEnginesWebGPUExtensionsEngineMultiRender();
    RegisterEnginesWebGPUExtensionsEngineRawTexture();
    RegisterEnginesWebGPUExtensionsEngineReadTexture();
    RegisterEnginesWebGPUExtensionsEngineRenderTarget();
    RegisterEnginesWebGPUExtensionsEngineRenderTargetTexture();
    AbstractEngine.GetCompatibleTextureLoader = _GetCompatibleTextureLoader; // core/Engines/AbstractEngine/abstractEngine.textureLoaders.ts
}
