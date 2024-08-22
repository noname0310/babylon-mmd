import { VertexBuffer } from "@babylonjs/core/Buffers/buffer";
import type { AbstractEngine } from "@babylonjs/core/Engines/abstractEngine";
import { Constants } from "@babylonjs/core/Engines/constants";
import { addClipPlaneUniforms, bindClipPlane, prepareStringDefinesForClipPlanes } from "@babylonjs/core/Materials/clipPlaneMaterialHelper";
import { DrawWrapper } from "@babylonjs/core/Materials/drawWrapper";
import { type IEffectCreationOptions } from "@babylonjs/core/Materials/effect";
import { EffectFallbacks } from "@babylonjs/core/Materials/effectFallbacks";
import { BindBonesParameters, BindMorphTargetParameters, PrepareAttributesForMorphTargetsInfluencers, PushAttributesForInstances } from "@babylonjs/core/Materials/materialHelper.functions";
import { ShaderLanguage } from "@babylonjs/core/Materials/shaderLanguage";
import { Matrix } from "@babylonjs/core/Maths/math.vector";
import type { _InstancesBatch, Mesh } from "@babylonjs/core/Meshes/mesh";
import type { SubMesh } from "@babylonjs/core/Meshes/subMesh";
import { Scene } from "@babylonjs/core/scene";
import type { ISceneComponent} from "@babylonjs/core/sceneComponent";
import { SceneComponentConstants } from "@babylonjs/core/sceneComponent";
import type { Nullable } from "@babylonjs/core/types";

import { MmdBufferKind } from "./mmdBufferKind";
import type { MmdStandardMaterial } from "./mmdStandardMaterial";
import { SdefInjector } from "./sdefInjector";

declare module "@babylonjs/core/scene" {
    export interface Scene {
        /* eslint-disable @typescript-eslint/naming-convention */
        /** @internal */
        _mmdOutlineRenderer: MmdOutlineRenderer;
        /* eslint-enable @typescript-eslint/naming-convention */

        /**
         * Gets the outline renderer associated with the scene
         * @returns a MmdOutlineRenderer
         */
        getMmdOutlineRenderer(): MmdOutlineRenderer;
    }
}

/**
 * Gets the outline renderer associated with the scene
 * @returns a MmdOutlineRenderer
 */
Scene.prototype.getMmdOutlineRenderer = function(): MmdOutlineRenderer {
    if (!this._mmdOutlineRenderer) {
        this._mmdOutlineRenderer = new MmdOutlineRenderer(this);
    }
    return this._mmdOutlineRenderer;
};

/**
 * This class is responsible to draw the outline/overlay of meshes.
 * It should not be used directly but through the available method on mesh.
 */
export class MmdOutlineRenderer implements ISceneComponent {
    /**
     * The name of the component. Each component must have a unique name.
     */
    public name = "MmdOutline"; // SceneComponentConstants.NAME_OUTLINERENDERER;

    /**
     * The scene the component belongs to.
     */
    public scene: Scene;

    private readonly _engine: AbstractEngine;
    private readonly _passIdForDrawWrapper: number;

    /**
     * Instantiates a new outline renderer. (There could be only one per scene).
     * @param scene Defines the scene it belongs to
     */
    public constructor(scene: Scene) {
        this.scene = scene;
        this._engine = scene.getEngine();
        this.scene._addComponent(this);
        this._passIdForDrawWrapper = this._engine.createRenderPassId("Mmd Outline Renderer");
    }

    /**
     * Register the component to one instance of a scene.
     */
    public register(): void {
        this.scene._afterRenderingMeshStage.registerStep(SceneComponentConstants.STEP_AFTERRENDERINGMESH_OUTLINE, this, this._afterRenderingMesh);
    }

    /**
     * Rebuilds the elements related to this component in case of
     * context lost for instance.
     */
    public rebuild(): void {
        // Nothing to do here.
    }

    /**
     * Disposes the component and the associated resources.
     */
    public dispose(): void {
        this._engine.releaseRenderPassId(this._passIdForDrawWrapper);
    }

    private static readonly _ViewMatrix = new Float32Array(9);
    private static readonly _InverseViewProjectionMatrix = new Matrix();

    /**
     * Renders the outline in the canvas.
     * @param subMesh Defines the sumesh to render
     * @param batch Defines the batch of meshes in case of instances
     * @param renderPassId Render pass id to use to render the mesh
     */
    public render(subMesh: SubMesh, batch: _InstancesBatch, renderPassId?: number): void {
        renderPassId = renderPassId ?? this._passIdForDrawWrapper;

        const scene = this.scene;
        const engine = scene.getEngine();

        const hardwareInstancedRendering =
            engine.getCaps().instancedArrays &&
            ((batch.visibleInstances[subMesh._id] !== null && batch.visibleInstances[subMesh._id] !== undefined) || subMesh.getRenderingMesh().hasThinInstances);

        if (!this.isReady(subMesh, hardwareInstancedRendering, renderPassId)) {
            return;
        }

        const ownerMesh = subMesh.getMesh();
        const replacementMesh = ownerMesh._internalAbstractMeshDataInfo._actAsRegularMesh ? ownerMesh : null;
        const renderingMesh = subMesh.getRenderingMesh();
        const effectiveMesh = replacementMesh ? replacementMesh : renderingMesh;
        const material = subMesh.getMaterial() as Nullable<MmdStandardMaterial>;

        if (!material || !scene.activeCamera) {
            return;
        }

        const drawWrapper = subMesh._getDrawWrapper(renderPassId)!;
        const effect = DrawWrapper.GetEffect(drawWrapper)!;

        engine.enableEffect(drawWrapper);

        // Logarithmic depth
        if ((<any>material).useLogarithmicDepth) {
            effect.setFloat("logarithmicDepthConstant", 2.0 / (Math.log(scene.activeCamera.maxZ + 1.0) / Math.LN2));
        }

        effect.setFloat("offset", material.outlineWidth);
        effect.setColor4("color", material.outlineColor, material.outlineAlpha);

        // const renderHeight = 1080;
        // const renderWidth = engine.getRenderWidth() * (renderHeight / engine.getRenderHeight());
        const renderHeight = engine.getRenderHeight();
        const renderWidth = engine.getRenderWidth();

        effect.setFloat2("viewport", renderWidth, renderHeight);
        const viewMatrixArray = MmdOutlineRenderer._ViewMatrix;
        {
            const m = scene.getViewMatrix().m;
            viewMatrixArray[0] = m[0];
            viewMatrixArray[1] = m[1];
            viewMatrixArray[2] = m[2];
            viewMatrixArray[3] = m[4];
            viewMatrixArray[4] = m[5];
            viewMatrixArray[5] = m[6];
            viewMatrixArray[6] = m[8];
            viewMatrixArray[7] = m[9];
            viewMatrixArray[8] = m[10];
        }
        effect.setMatrix3x3("view", viewMatrixArray);
        effect.setMatrix("viewProjection", scene.getTransformMatrix());
        effect.setMatrix("world", effectiveMesh.getWorldMatrix());

        // Bones
        BindBonesParameters(renderingMesh, effect);

        // Morph targets
        BindMorphTargetParameters(renderingMesh, effect);
        if (renderingMesh.morphTargetManager && renderingMesh.morphTargetManager.isUsingTextureForTargets) {
            renderingMesh.morphTargetManager._bind(effect);
        }

        if (!hardwareInstancedRendering) {
            renderingMesh._bind(subMesh, effect, material.fillMode);
        }

        // Baked vertex animations
        const bvaManager = subMesh.getMesh().bakedVertexAnimationManager;
        if (bvaManager && bvaManager.isEnabled) {
            bvaManager.bind(effect, hardwareInstancedRendering);
        }

        // Alpha test
        if (material && material.needAlphaTesting()) {
            const alphaTexture = material.getAlphaTestTexture();
            if (alphaTexture) {
                effect.setTexture("diffuseSampler", alphaTexture);
                effect.setMatrix("diffuseMatrix", alphaTexture.getTextureMatrix());
            }
        }

        // Clip plane
        bindClipPlane(effect, material, scene);

        // Clip plane support
        if (effect.defines.includes("WORLDPOS_REQUIRED")) {
            effect.setMatrix("inverseViewProjection", scene.getTransformMatrix().invertToRef(MmdOutlineRenderer._InverseViewProjectionMatrix));
        }

        renderingMesh._processRendering(effectiveMesh, subMesh, effect, material.fillMode, batch, hardwareInstancedRendering, (_isInstance, world) => {
            effect.setMatrix("world", world);
        });
    }

    /**
     * Returns whether or not the outline renderer is ready for a given submesh.
     * All the dependencies e.g. submeshes, texture, effect... mus be ready
     * @param subMesh Defines the submesh to check readiness for
     * @param useInstances Defines whether wee are trying to render instances or not
     * @param renderPassId Render pass id to use to render the mesh
     * @returns true if ready otherwise false
     */
    public isReady(subMesh: SubMesh, useInstances: boolean, renderPassId?: number): boolean {
        renderPassId = renderPassId ?? this._passIdForDrawWrapper;

        const defines = [];
        const attribs = [VertexBuffer.PositionKind, VertexBuffer.NormalKind];

        const mesh = subMesh.getMesh();
        const material = subMesh.getMaterial();

        if (!material) {
            return false;
        }

        const scene = mesh.getScene();

        // Alpha test
        if (material.needAlphaTesting()) {
            defines.push("#define ALPHATEST");
            if (mesh.isVerticesDataPresent(VertexBuffer.UVKind)) {
                attribs.push(VertexBuffer.UVKind);
                defines.push("#define UV1");
            }
            if (mesh.isVerticesDataPresent(VertexBuffer.UV2Kind)) {
                attribs.push(VertexBuffer.UV2Kind);
                defines.push("#define UV2");
            }
        }
        //Logarithmic depth
        if ((<any>material).useLogarithmicDepth) {
            defines.push("#define LOGARITHMICDEPTH");
        }
        // Clip planes
        prepareStringDefinesForClipPlanes(material, scene, defines);

        // Clip planes support
        let useClipPlane = false;
        for (let i = 0; i < defines.length; ++i) {
            if (defines[i].includes("CLIPPLANE")) {
                useClipPlane = true;
                break;
            }
        }
        if (useClipPlane) defines.push("#define WORLDPOS_REQUIRED");

        // Bones
        const fallbacks = new EffectFallbacks();
        if (mesh.useBones && mesh.computeBonesUsingShaders && mesh.skeleton) {
            attribs.push(VertexBuffer.MatricesIndicesKind);
            attribs.push(VertexBuffer.MatricesWeightsKind);
            if (mesh.numBoneInfluencers > 4) {
                attribs.push(VertexBuffer.MatricesIndicesExtraKind);
                attribs.push(VertexBuffer.MatricesWeightsExtraKind);
            }
            if (mesh.isVerticesDataPresent(MmdBufferKind.MatricesSdefCKind)) {
                attribs.push(MmdBufferKind.MatricesSdefCKind);
                attribs.push(MmdBufferKind.MatricesSdefRW0Kind);
                attribs.push(MmdBufferKind.MatricesSdefRW1Kind);
                defines.push("#define SDEF");
            }
            const skeleton = mesh.skeleton;
            defines.push("#define NUM_BONE_INFLUENCERS " + mesh.numBoneInfluencers);
            if (mesh.numBoneInfluencers > 0) {
                fallbacks.addCPUSkinningFallback(0, mesh);
            }

            if (skeleton.isUsingTextureForMatrices) {
                defines.push("#define BONETEXTURE");
            } else {
                defines.push("#define BonesPerMesh " + (skeleton.bones.length + 1));
            }
        } else {
            defines.push("#define NUM_BONE_INFLUENCERS 0");
        }

        // Morph targets
        const morphTargetManager = (mesh as Mesh).morphTargetManager;
        let numMorphInfluencers = 0;
        if (morphTargetManager) {
            numMorphInfluencers = morphTargetManager.numMaxInfluencers || morphTargetManager.numInfluencers;
            if (numMorphInfluencers > 0) {
                defines.push("#define MORPHTARGETS");
                defines.push("#define NUM_MORPH_INFLUENCERS " + numMorphInfluencers);

                if (morphTargetManager.isUsingTextureForTargets) {
                    defines.push("#define MORPHTARGETS_TEXTURE");
                }

                PrepareAttributesForMorphTargetsInfluencers(attribs, mesh, numMorphInfluencers);
            }
        }

        // Instances
        if (useInstances) {
            defines.push("#define INSTANCES");
            PushAttributesForInstances(attribs);
            if (subMesh.getRenderingMesh().hasThinInstances) {
                defines.push("#define THIN_INSTANCES");
            }
        }

        // Baked vertex animations
        const bvaManager = mesh.bakedVertexAnimationManager;
        if (bvaManager && bvaManager.isEnabled) {
            defines.push("#define BAKED_VERTEX_ANIMATION_TEXTURE");
            if (useInstances) {
                attribs.push("bakedVertexAnimationSettingsInstanced");
            }
        }

        // Get correct effect
        const drawWrapper = subMesh._getDrawWrapper(renderPassId, true)!;
        const cachedDefines = drawWrapper.defines;
        const join = defines.join("\n");

        if (cachedDefines !== join) {
            const uniforms = [
                "world",
                "mBones",
                "viewport",
                "view",
                "viewProjection",
                "diffuseMatrix",
                "offset",
                "color",
                "logarithmicDepthConstant",
                "morphTargetInfluences",
                "boneTextureWidth",
                "morphTargetCount",
                "morphTargetTextureInfo",
                "morphTargetTextureIndices",
                "bakedVertexAnimationSettings",
                "bakedVertexAnimationTextureSizeInverted",
                "bakedVertexAnimationTime",
                "bakedVertexAnimationTexture"
            ];
            const samplers = ["diffuseSampler", "boneSampler", "morphTargets", "bakedVertexAnimationTexture"];

            addClipPlaneUniforms(uniforms);
            if (useClipPlane) uniforms.push("inverseViewProjection");

            const shaderLanguage = scene.getEngine().isWebGPU ? ShaderLanguage.WGSL : ShaderLanguage.GLSL;
            drawWrapper.setEffect(
                this.scene.getEngine().createEffect(
                    "mmdOutline",
                    <IEffectCreationOptions>{
                        attributes: attribs,
                        uniformsNames: uniforms,
                        uniformBuffersNames: [],
                        samplers: samplers,
                        defines: join,
                        fallbacks: fallbacks,
                        onCompiled: null,
                        onError: null,
                        indexParameters: { maxSimultaneousMorphTargets: numMorphInfluencers },
                        processCodeAfterIncludes: SdefInjector.ProcessSdefCode,
                        shaderLanguage: shaderLanguage,
                        extraInitializationsAsync: async(): Promise<void> => {
                            if (shaderLanguage === ShaderLanguage.WGSL) {
                                await Promise.all([import("./ShadersWGSL/mmdOutline.fragment"), import("./ShadersWGSL/mmdOutline.vertex")]);
                            } else {
                                await Promise.all([import("./Shaders/mmdOutline.fragment"), import("./Shaders/mmdOutline.vertex")]);
                            }
                        }
                    },
                    this.scene.getEngine()
                ),
                join
            );
        }

        return drawWrapper.effect!.isReady();
    }

    private _afterRenderingMesh(_mesh: Mesh, subMesh: SubMesh, batch: _InstancesBatch): void {
        const material = subMesh.getMaterial() as Nullable<MmdStandardMaterial>;
        if (material === null) return;

        if (material.renderOutline) {
            const engine = this._engine;

            const savedDepthWrite = engine.getDepthWrite();
            const savedAlphaMode = engine.getAlphaMode();
            const savedAlphaBlendState = engine.alphaState.alphaBlend;

            engine.setDepthWrite(true);
            engine.setAlphaMode(Constants.ALPHA_COMBINE, true);

            engine.setState(true, undefined, undefined, undefined, this.scene._mirroredCameraPosition ? true : false);
            this.render(subMesh, batch, this._passIdForDrawWrapper);

            engine.setAlphaMode(savedAlphaMode, true);
            engine.setDepthWrite(savedDepthWrite);
            engine.alphaState.alphaBlend = savedAlphaBlendState;
        }
    }
}
