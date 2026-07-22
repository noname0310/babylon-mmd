import { AbstractEngine } from "@babylonjs/core/Engines/abstractEngine.pure";
import { RegisterAbstractEngineLoadingScreen } from "@babylonjs/core/Engines/AbstractEngine/abstractEngine.loadingScreen.pure";
import { RegisterAbstractEngineStates } from "@babylonjs/core/Engines/AbstractEngine/abstractEngine.states.pure";
import { RegisterAbstractEngineStencil } from "@babylonjs/core/Engines/AbstractEngine/abstractEngine.stencil.pure";
import { RegisterAbstractEngineTexture } from "@babylonjs/core/Engines/AbstractEngine/abstractEngine.texture.pure";
import { RegisterEnginesExtensionsEngineAlpha } from "@babylonjs/core/Engines/Extensions/engine.alpha.pure";
import { RegisterEnginesExtensionsEngineRawTexture } from "@babylonjs/core/Engines/Extensions/engine.rawTexture.pure";
import { RegisterEnginesExtensionsEngineReadTexture } from "@babylonjs/core/Engines/Extensions/engine.readTexture.pure";
import { RegisterEnginesExtensionsEngineRenderTarget } from "@babylonjs/core/Engines/Extensions/engine.renderTarget.pure";
import { RegisterEnginesExtensionsEngineRenderTargetTexture } from "@babylonjs/core/Engines/Extensions/engine.renderTargetTexture.pure";
import { RegisterEngineUniformBuffer } from "@babylonjs/core/Engines/Extensions/engine.uniformBuffer.pure";
import { _GetCompatibleTextureLoader } from "@babylonjs/core/Materials/Textures/Loaders/textureLoaderManager";

export function RegisterEngineExtensions(): void {
    RegisterAbstractEngineLoadingScreen();
    RegisterAbstractEngineStates();
    RegisterAbstractEngineStencil();
    RegisterAbstractEngineTexture();
    RegisterEnginesExtensionsEngineAlpha();
    RegisterEnginesExtensionsEngineRawTexture();
    RegisterEnginesExtensionsEngineReadTexture();
    RegisterEnginesExtensionsEngineRenderTarget();
    RegisterEnginesExtensionsEngineRenderTargetTexture();
    RegisterEngineUniformBuffer();
    AbstractEngine.GetCompatibleTextureLoader = _GetCompatibleTextureLoader; // core/Engines/AbstractEngine/abstractEngine.textureLoaders.ts
}
