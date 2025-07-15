import "@babylonjs/core/Materials/Textures/Loaders/ddsTextureLoader";
import "@babylonjs/core/Materials/Textures/Loaders/tgaTextureLoader";
import "@babylonjs/core/Misc/dumpTools";
import "@/Loader/mmdOutlineRenderer";

import { FreeCamera } from "@babylonjs/core/Cameras/freeCamera";
import type { AbstractEngine } from "@babylonjs/core/Engines/abstractEngine";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { Mesh } from "@babylonjs/core/Meshes/mesh";
import type { LoadFileError } from "@babylonjs/core/Misc/fileTools";
import type { WebRequest } from "@babylonjs/core/Misc/webRequest";
import { Scene } from "@babylonjs/core/scene";
import type { Nullable } from "@babylonjs/core/types";

import type { IMmdModelLoadState } from "@/Loader/mmdModelLoader";
import { MmdStandardMaterialBuilder } from "@/Loader/mmdStandardMaterialBuilder";
import { BpmxConverter } from "@/Loader/Optimized/bpmxConverter";
import { BpmxLoader } from "@/Loader/Optimized/Legacy/bpmxLoader";
import type { BpmxObject } from "@/Loader/Optimized/Parser/bpmxObject";

import type { ISceneBuilder } from "../baseRuntime";

class MigrationBpmxLoader extends BpmxLoader {
    public lastBpmxObject: Nullable<BpmxObject> = null;
    protected override async _parseFileAsync(arrayBuffer: ArrayBuffer): Promise<BpmxObject> {
        this.lastBpmxObject = await super._parseFileAsync(arrayBuffer);
        return this.lastBpmxObject;
    }
}

export class SceneBuilder implements ISceneBuilder {
    public async buildAsync(canvas: HTMLCanvasElement, engine: AbstractEngine): Promise<Scene> {
        engine.setHardwareScalingLevel(1000);
        const scene = new Scene(engine);
        new FreeCamera("camera1", new Vector3(0, 5, -10), scene);

        const formDiv = document.createElement("div");
        formDiv.style.position = "absolute";
        formDiv.style.top = "0";
        formDiv.style.left = "0";
        formDiv.style.backgroundColor = "white";
        formDiv.style.width = "100%";
        formDiv.style.height = "100%";
        formDiv.style.display = "flex";
        formDiv.style.flexDirection = "column";
        formDiv.style.justifyContent = "center";
        formDiv.style.alignItems = "center";
        formDiv.style.fontFamily = "sans-serif";
        canvas.parentElement!.appendChild(formDiv);

        const innerFormDiv = document.createElement("div");
        innerFormDiv.style.width = "auto";
        innerFormDiv.style.height = "100%";
        innerFormDiv.style.display = "flex";
        innerFormDiv.style.flexDirection = "column";
        innerFormDiv.style.justifyContent = "center";
        innerFormDiv.style.alignItems = "start";
        formDiv.appendChild(innerFormDiv);

        const legacyBpmxLoader = new MigrationBpmxLoader();
        legacyBpmxLoader.loggingEnabled = true;
        legacyBpmxLoader.preserveSerializationData = true;
        const materialBuilder = legacyBpmxLoader.materialBuilder = new MmdStandardMaterialBuilder();
        materialBuilder.forceDisableAlphaEvaluation = true;
        materialBuilder.deleteTextureBufferAfterLoad = false;
        const bpmxConverter = new BpmxConverter();
        bpmxConverter.loggingEnabled = true;

        const files: File[] = [];

        const title = document.createElement("h1");
        title.textContent = "BPMX 2.X to 3.X Migration Tool";
        title.style.width = "100%";
        title.style.fontSize = "24px";
        title.style.textAlign = "center";
        title.style.marginBottom = "0";
        innerFormDiv.appendChild(title);

        const version = document.createElement("p");
        version.textContent = `BPMX Version: ${BpmxConverter.Version.join(".")}`;
        version.style.width = "100%";
        version.style.fontSize = "16px";
        version.style.textAlign = "center";
        version.style.marginTop = "0";
        innerFormDiv.appendChild(version);

        const loadedFileList = document.createElement("ul");
        innerFormDiv.appendChild(loadedFileList);
        loadedFileList.style.width = "100%";
        loadedFileList.style.height = "auto";
        loadedFileList.style.fontSize = "20px";

        const renderLoadedFiles = (): void => {
            loadedFileList.innerHTML = "";
            for (const file of files) {
                const item = document.createElement("li");
                item.textContent = file.name;
                loadedFileList.appendChild(item);
            }
        };
        renderLoadedFiles();

        const fileInput = document.createElement("input");
        fileInput.style.width = "350px";
        fileInput.style.height = "80px";
        fileInput.style.display = "block";
        fileInput.style.backgroundColor = "black";
        fileInput.style.color = "white";
        fileInput.style.marginBottom = "10px";
        fileInput.style.fontSize = "20px";

        fileInput.type = "file";
        fileInput.accept = ".bpmx";
        fileInput.multiple = true;
        fileInput.onchange = (): void => {
            if (fileInput.files === null) return;
            for (const file of fileInput.files) {
                if (!file.name.endsWith(".bpmx")) continue;
                files.push(file);
            }
            renderLoadedFiles();
        };
        innerFormDiv.appendChild(fileInput);

        const convertButton = document.createElement("button");
        convertButton.textContent = "Convert";
        convertButton.style.width = "100%";
        convertButton.style.height = "60px";
        convertButton.style.border = "none";
        convertButton.style.fontSize = "20px";

        convertButton.onclick = async(): Promise<void> => {
            if (files.length === 0) {
                alert("Please select a BVMD file");
                return;
            }

            convertButton.textContent = "Converting...";
            for (const file of files) {
                const loadState = await new Promise<IMmdModelLoadState>((resolve) => {
                    legacyBpmxLoader.loadFile(
                        scene,
                        file,
                        "",
                        (request) => {
                            resolve(request);
                        },
                        undefined,
                        true,
                        (request?: WebRequest, exception?: LoadFileError): void => {
                            if (exception) {
                                console.error(`Failed to load file: ${file.name}`, exception);
                            } else if (request) {
                                console.error(`Failed to load file: ${request.requestURL}`);
                            } else {
                                console.error(`Failed to load file: ${file.name}`);
                            }
                        }
                    );
                });
                const assetContainer = await legacyBpmxLoader.loadAssetContainerAsync(
                    scene,
                    loadState as any,
                    "",
                    undefined,
                    undefined
                );
                const bpmxObject = legacyBpmxLoader.lastBpmxObject!;
                const translucentMaterials = new Array<Nullable<boolean>>(bpmxObject.materials.length);
                const alphaEvaluateResults = new Array<number>(bpmxObject.materials.length);
                for (let i = 0; i < bpmxObject.materials.length; ++i) {
                    const material = bpmxObject.materials[i];
                    const evaluatedTransparency = material.evaluatedTransparency;
                    let etIsNotOpaque = (evaluatedTransparency >> 4) & 0x03;
                    if ((etIsNotOpaque ^ 0x03) === 0) { // 11: not evaluated
                        etIsNotOpaque = -1;
                    }
                    let etAlphaEvaluateResult = evaluatedTransparency & 0x0F;
                    if ((etAlphaEvaluateResult ^ 0x0F) === 0) { // 1111: not evaluated
                        etAlphaEvaluateResult = -1;
                    }
                    translucentMaterials[i] = etIsNotOpaque === -1
                        ? null
                        : etIsNotOpaque !== 0;
                    alphaEvaluateResults[i] = etAlphaEvaluateResult;
                }
                const arrayBuffer = bpmxConverter.convert(assetContainer.rootNodes[0] as Mesh, {
                    translucentMaterials,
                    alphaEvaluateResults
                });
                assetContainer.dispose();
                const blob = new Blob([arrayBuffer], { type: "application/octet-stream" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `${file.name.substring(0, file.name.lastIndexOf("."))}_migrated.bpmx`;
                a.click();
                URL.revokeObjectURL(url);
                a.remove();
            }

            files.length = 0;
            renderLoadedFiles();
            convertButton.textContent = "Convert";
        };
        innerFormDiv.appendChild(convertButton);

        return scene;
    }
}
