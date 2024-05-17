import "@babylonjs/core/Loading/loadingScreen";
import "@babylonjs/core/Lights/Shadows/shadowGeneratorSceneComponent";
import "@babylonjs/core/Materials/Textures/Loaders/tgaTextureLoader";
import "@/Loader/mmdOutlineRenderer";
import "@/Loader/pmdLoader";
import "@/Loader/pmxLoader";

import { ArcRotateCamera } from "@babylonjs/core/Cameras/arcRotateCamera";
import type { AbstractEngine } from "@babylonjs/core/Engines/abstractEngine";
import { DirectionalLight } from "@babylonjs/core/Lights/directionalLight";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { ShadowGenerator } from "@babylonjs/core/Lights/Shadows/shadowGenerator";
import { SceneLoader } from "@babylonjs/core/Loading/sceneLoader";
import { Material } from "@babylonjs/core/Materials/material";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { CreateGround } from "@babylonjs/core/Meshes/Builders/groundBuilder";
import { DefaultRenderingPipeline } from "@babylonjs/core/PostProcesses/RenderPipeline/Pipelines/defaultRenderingPipeline";
import { Scene } from "@babylonjs/core/scene";
import type { Nullable } from "@babylonjs/core/types";

import type { MmdStandardMaterial } from "@/Loader/mmdStandardMaterial";
import { type MmdStandardMaterialBuilder, MmdStandardMaterialRenderMethod } from "@/Loader/mmdStandardMaterialBuilder";
import { BpmxConverter } from "@/Loader/Optimized/bpmxConverter";
import type { PmdLoader } from "@/Loader/pmdLoader";
import type { PmxLoader } from "@/Loader/pmxLoader";
import { SdefInjector } from "@/Loader/sdefInjector";
import { TextureAlphaChecker } from "@/Loader/textureAlphaChecker";
import type { MmdMesh } from "@/Runtime/mmdMesh";

import type { ISceneBuilder } from "../baseRuntime";

async function readDirectories(entries: FileSystemEntry[], path = ""): Promise<FileSystemFileEntry[]> {
    const result: FileSystemFileEntry[] = [];

    for (let i = 0; i < entries.length; ++i) {
        const entry = entries[i];
        if (entry.isDirectory) {
            const dirReader = (entry as FileSystemDirectoryEntry).createReader();
            const entries = await new Promise<FileSystemEntry[]>((resolve, reject) => {
                dirReader.readEntries(resolve, reject);
            });
            result.push(...await readDirectories(entries, path + entry.name + "/"));
        } else {
            result.push(entry as FileSystemFileEntry);
        }
    }

    return result;
}

async function entriesToFiles(entries: FileSystemEntry[]): Promise<File[]> {
    const files: File[] = [];
    const directories = await readDirectories(entries);
    for (let i = 0; i < directories.length; ++i) {
        const entry = directories[i];
        const file = await new Promise<File>((resolve, reject) => {
            entry.file(resolve, reject);
        });
        if (file.webkitRelativePath === "") {
            Object.defineProperty(file, "webkitRelativePath", {
                writable: true
            });
            (file as any).webkitRelativePath = entry.fullPath;
        }
        files.push(file);
    }
    return files;
}

export class SceneBuilder implements ISceneBuilder {
    public async build(canvas: HTMLCanvasElement, engine: AbstractEngine): Promise<Scene> {
        SdefInjector.OverrideEngineCreateEffect(engine);

        const pmdLoader = SceneLoader.GetPluginForExtension(".pmd") as PmdLoader;
        pmdLoader.loggingEnabled = true;
        pmdLoader.preserveSerializationData = true;

        const pmxLoader = SceneLoader.GetPluginForExtension(".pmx") as PmxLoader;
        pmxLoader.loggingEnabled = true;
        pmxLoader.preserveSerializationData = true;
        const materialBuilder = pmxLoader.materialBuilder as MmdStandardMaterialBuilder;
        materialBuilder.deleteTextureBufferAfterLoad = false;
        materialBuilder.renderMethod = MmdStandardMaterialRenderMethod.AlphaEvaluation;

        const scene = new Scene(engine);
        scene.ambientColor = new Color3(0.5, 0.5, 0.5);

        const camera = new ArcRotateCamera("camera", 0, 0, 45, new Vector3(0, 10, 0), scene);
        camera.maxZ = 5000;
        camera.fov = 30 * (Math.PI / 180);
        camera.speed = 0.5;
        camera.setPosition(new Vector3(0, 10, -45));
        camera.attachControl(canvas, true);

        const hemisphericLight = new HemisphericLight("hemisphericLight", new Vector3(0, 1, 0), scene);
        hemisphericLight.intensity = 0.5;
        hemisphericLight.specular = new Color3(0, 0, 0);
        hemisphericLight.groundColor = new Color3(1, 1, 1);

        const directionalLight = new DirectionalLight("directionalLight", new Vector3(0.5, -1, 1), scene);
        directionalLight.intensity = 0.5;
        directionalLight.autoCalcShadowZBounds = false;
        directionalLight.autoUpdateExtends = false;
        directionalLight.shadowMaxZ = 20 * 3;
        directionalLight.shadowMinZ = -30;
        directionalLight.orthoTop = 18 * 3;
        directionalLight.orthoBottom = -1 * 3;
        directionalLight.orthoLeft = -10 * 3;
        directionalLight.orthoRight = 10 * 3;
        directionalLight.shadowOrthoScale = 0;

        const shadowGenerator = new ShadowGenerator(1024, directionalLight, true, camera);
        shadowGenerator.transparencyShadow = true;
        shadowGenerator.usePercentageCloserFiltering = true;
        shadowGenerator.forceBackFacesOnly = false;
        shadowGenerator.bias = 0.01;
        shadowGenerator.filteringQuality = ShadowGenerator.QUALITY_MEDIUM;
        shadowGenerator.frustumEdgeFalloff = 0.1;

        const ground = CreateGround("ground1", { width: 100, height: 100, subdivisions: 2, updatable: false }, scene);
        ground.receiveShadows = true;

        const defaultPipeline = new DefaultRenderingPipeline("default", true, scene);
        defaultPipeline.samples = 4;
        defaultPipeline.fxaaEnabled = true;
        defaultPipeline.imageProcessingEnabled = false;

        const textureAlphaChecker = new TextureAlphaChecker(scene);

        const loadModelAsync = async(file: File): Promise<void> => {
            if (isLoading) return;

            if (mesh !== null) {
                for (const subMesh of mesh.metadata.meshes) {
                    shadowGenerator.removeShadowCaster(subMesh);
                }
                mesh.dispose(false, true);
                mesh = null;
            }

            isLoading = true;
            engine.displayLoadingUI();
            const fileRelativePath = file.webkitRelativePath as string;
            selectedPmxFile.textContent = file.name;
            mesh = await SceneLoader.ImportMeshAsync(
                undefined,
                fileRelativePath.substring(0, fileRelativePath.lastIndexOf("/") + 1),
                file,
                scene,
                (event) => engine.loadingUIText = `<br/><br/><br/>Loading (${file.name})... ${event.loaded}/${event.total} (${Math.floor(event.loaded * 100 / event.total)}%)`
            ).then(result => result.meshes[0] as MmdMesh);
            {
                const meshes = mesh!.metadata.meshes;
                for (let i = 0; i < meshes.length; ++i) {
                    const mesh = meshes[i];
                    mesh.receiveShadows = true;
                    shadowGenerator.addShadowCaster(mesh, false);
                    mesh.alphaIndex = i;
                }

                const materials = mesh!.metadata.materials;
                translucentMaterials.length = materials.length;
                alphaEvaluateResults.length = materials.length;
                for (let i = 0; i < materials.length; ++i) {
                    const material = materials[i] as MmdStandardMaterial;
                    const diffuseTexture = material.diffuseTexture;
                    if (diffuseTexture) {
                        diffuseTexture.hasAlpha = true;
                        material.useAlphaFromDiffuseTexture = true;
                    }

                    if (material.alpha < 1) {
                        translucentMaterials[i] = true;
                    } else if (!diffuseTexture) {
                        translucentMaterials[i] = false;
                    } else {
                        translucentMaterials[i] = true;
                        const referencedMeshes = meshes.filter(m => m.material === material);
                        for (const referencedMesh of referencedMeshes) {
                            const isOpaque = await textureAlphaChecker.hasFragmentsOnlyOpaqueOnGeometry(diffuseTexture, referencedMesh, null);
                            if (isOpaque) {
                                translucentMaterials[i] = false;
                                break;
                            }
                        }
                    }

                    alphaEvaluateResults[i] = material.transparencyMode ?? -1;
                }
            }
            renderMaterialsList();
            engine.hideLoadingUI();
            setTimeout(() => isLoading = false, 1500);
        };

        let selectedFile: Nullable<File> = null;
        let mesh: Nullable<MmdMesh> = null;
        const translucentMaterials: boolean[] = [];
        const alphaEvaluateResults: number[] = [];
        let currentMode: "Alpha Mode" | "Force Depth Write Mode" = "Alpha Mode";
        let isLoading = false;

        const switchMaterialTransparencyMode = (mode: "Alpha Mode" | "Force Depth Write Mode"): void => {
            if (mesh === null) return;

            const materials = mesh.metadata.materials;

            if (mode === "Alpha Mode") {
                for (let i = 0; i < materials.length; ++i) {
                    const material = materials[i] as MmdStandardMaterial;
                    material.transparencyMode = alphaEvaluateResults[i] ?? Material.MATERIAL_OPAQUE;
                    material.forceDepthWrite = false;
                }
            } else {
                for (let i = 0; i < materials.length; ++i) {
                    const material = materials[i] as MmdStandardMaterial;
                    material.transparencyMode = translucentMaterials[i] ? Material.MATERIAL_ALPHABLEND : Material.MATERIAL_OPAQUE;
                    material.forceDepthWrite = true;
                }
            }
        };

        const parentDiv = canvas.parentElement!;
        parentDiv.style.display = "flex";
        parentDiv.style.flexDirection = "row-reverse";

        const canvasNewParentDiv = document.createElement("div");
        canvasNewParentDiv.style.width = "100%";
        canvasNewParentDiv.style.height = "100%";
        canvasNewParentDiv.style.display = "flex";
        canvasNewParentDiv.appendChild(canvas);
        parentDiv.appendChild(canvasNewParentDiv);

        const formDiv = document.createElement("div");
        formDiv.style.position = "relative";
        formDiv.style.backgroundColor = "white";
        formDiv.style.width = "auto";
        formDiv.style.height = "100%";
        formDiv.style.display = "flex";
        formDiv.style.flexDirection = "column";
        formDiv.style.justifyContent = "center";
        formDiv.style.alignItems = "center";
        formDiv.style.fontFamily = "sans-serif";
        parentDiv.appendChild(formDiv);

        const innerFormDiv = document.createElement("div");
        innerFormDiv.style.width = "auto";
        innerFormDiv.style.height = "100%";
        innerFormDiv.style.display = "flex";
        innerFormDiv.style.flexDirection = "column";
        innerFormDiv.style.justifyContent = "center";
        innerFormDiv.style.alignItems = "start";
        innerFormDiv.style.padding = "20px";
        innerFormDiv.style.boxSizing = "border-box";
        formDiv.appendChild(innerFormDiv);

        const bpmxConverter = new BpmxConverter();
        bpmxConverter.loggingEnabled = true;

        let files: File[] = [];

        const title = document.createElement("h1");
        title.textContent = "PMX to BPMX Converter";
        title.style.width = "350px";
        title.style.textAlign = "center";
        title.style.fontSize = "24px";
        title.style.marginTop = "0";
        innerFormDiv.appendChild(title);

        // #region Tab

        const tabContainer = document.createElement("div");
        tabContainer.style.width = "350px";
        tabContainer.style.height = "auto";
        tabContainer.style.display = "flex";
        tabContainer.style.flexDirection = "row";
        tabContainer.style.justifyContent = "space-between";
        tabContainer.style.alignItems = "center";
        innerFormDiv.appendChild(tabContainer);

        const loadModelTab = document.createElement("div");
        loadModelTab.textContent = "Load Model";
        loadModelTab.style.width = "100%";
        loadModelTab.style.height = "auto";
        loadModelTab.style.border = "none";
        loadModelTab.style.backgroundColor = "#111111";
        loadModelTab.style.fontSize = "20px";
        loadModelTab.style.textAlign = "center";
        loadModelTab.style.color = "white";
        loadModelTab.style.cursor = "pointer";
        loadModelTab.onclick = (): void => {
            loadModelTab.style.backgroundColor = "#444444";
            fixMaterialTab.style.backgroundColor = "#111111";

            fileInput.style.display = "block";
            fileListTitle.style.display = "block";
            fileListContainer.style.display = "block";
            modeSwitchContainer.style.display = "none";
            materialListTitle.style.display = "none";
            materialListContainer.style.display = "none";
        };
        tabContainer.appendChild(loadModelTab);

        const fixMaterialTab = document.createElement("div");
        fixMaterialTab.textContent = "Fix Material";
        fixMaterialTab.style.width = "100%";
        fixMaterialTab.style.height = "auto";
        fixMaterialTab.style.border = "none";
        fixMaterialTab.style.backgroundColor = "#111111";
        fixMaterialTab.style.fontSize = "20px";
        fixMaterialTab.style.textAlign = "center";
        fixMaterialTab.style.color = "white";
        fixMaterialTab.style.cursor = "pointer";
        fixMaterialTab.onclick = (): void => {
            loadModelTab.style.backgroundColor = "#111111";
            fixMaterialTab.style.backgroundColor = "#444444";

            fileInput.style.display = "none";
            fileListTitle.style.display = "none";
            fileListContainer.style.display = "none";
            modeSwitchContainer.style.display = "flex";
            materialListTitle.style.display = "block";
            materialListContainer.style.display = "block";
        };
        tabContainer.appendChild(fixMaterialTab);

        // #endregion

        const selectedPmxFile = document.createElement("div");
        selectedPmxFile.textContent = "No PMX file selected";
        selectedPmxFile.style.width = "350px";
        selectedPmxFile.style.height = "auto";
        selectedPmxFile.style.fontSize = "18px";
        selectedPmxFile.style.marginBottom = "10px";
        selectedPmxFile.style.border = "1px solid black";
        selectedPmxFile.style.boxSizing = "border-box";
        selectedPmxFile.style.padding = "10px";
        selectedPmxFile.style.overflow = "scroll";
        innerFormDiv.appendChild(selectedPmxFile);

        // #region Load Model Tab

        const fileListTitle = document.createElement("div");
        fileListTitle.textContent = "Files";
        fileListTitle.style.width = "100%";
        fileListTitle.style.height = "auto";
        fileListTitle.style.fontSize = "18px";
        fileListTitle.style.backgroundColor = "#444444";
        fileListTitle.style.color = "white";
        fileListTitle.style.padding = "2px 5px";
        fileListTitle.style.boxSizing = "border-box";
        innerFormDiv.appendChild(fileListTitle);

        const fileListContainer = document.createElement("div");
        fileListContainer.style.width = "350px";
        fileListContainer.style.flexGrow = "1";
        fileListContainer.style.overflow = "auto";
        fileListContainer.style.marginBottom = "10px";
        fileListContainer.style.border = "1px solid black";
        fileListContainer.style.boxSizing = "border-box";
        innerFormDiv.appendChild(fileListContainer);

        const pmxFileList = document.createElement("ul");
        pmxFileList.style.height = "auto";
        pmxFileList.style.fontSize = "16px";
        fileListContainer.appendChild(pmxFileList);
        const renderLoadedFiles = (): void => {
            pmxFileList.innerHTML = "";
            for (const file of files) {
                const item = document.createElement("li");
                item.style.whiteSpace = "nowrap";
                const fileRelativePath = file.webkitRelativePath as string;
                item.textContent = fileRelativePath.substring(fileRelativePath.indexOf("/") + 1);
                if (file.name.endsWith(".pmx") || file.name.endsWith(".pmd")) {
                    item.style.color = "blue";
                    item.style.cursor = "pointer";
                    item.style.textDecoration = "underline";
                    item.onclick = (): void => {
                        selectedFile = file;
                        loadModelAsync(file);
                    };
                }
                pmxFileList.appendChild(item);
            }
        };

        const fileInput = document.createElement("input");
        fileInput.style.width = "100%";
        fileInput.style.minHeight = "80px";
        fileInput.style.display = "block";
        fileInput.style.backgroundColor = "black";
        fileInput.style.color = "white";
        fileInput.style.marginBottom = "10px";
        fileInput.style.fontSize = "20px";
        fileInput.type = "file";
        fileInput.setAttribute("directory", "");
        fileInput.setAttribute("webkitdirectory", "");
        fileInput.setAttribute("allowdirs", "");
        fileInput.ondragover = (event): void => {
            event.preventDefault();
        };
        fileInput.ondrop = async(event): Promise<void> => {
            event.preventDefault();
            const dataTransferItemList = event.dataTransfer!.items;
            if (!dataTransferItemList) return;
            const entries: FileSystemEntry[] = [];
            for (let i = 0; i < dataTransferItemList.length; ++i) {
                const item = dataTransferItemList[i];
                const entry = item.webkitGetAsEntry();
                if (entry) entries.push(entry);
            }

            const fileSystemEntries = await readDirectories(entries);
            files = await entriesToFiles(fileSystemEntries);
            renderLoadedFiles();
            pmxLoader.referenceFiles = files;
            pmdLoader.referenceFiles = files;
        };
        fileInput.onchange = (): void => {
            if (fileInput.files === null) return;
            files = Array.from(fileInput.files);
            renderLoadedFiles();
            pmxLoader.referenceFiles = files;
            pmdLoader.referenceFiles = files;
        };
        innerFormDiv.appendChild(fileInput);

        // #endregion

        // #region Fix Material Tab

        const modeSwitchContainer = document.createElement("div");
        modeSwitchContainer.style.width = "100%";
        modeSwitchContainer.style.height = "auto";
        modeSwitchContainer.style.display = "flex";
        modeSwitchContainer.style.flexDirection = "row";
        modeSwitchContainer.style.justifyContent = "space-between";
        innerFormDiv.appendChild(modeSwitchContainer);

        const alphaModeSwitch = document.createElement("button");
        alphaModeSwitch.textContent = "Alpha Mode";
        alphaModeSwitch.style.flexGrow = "1";
        alphaModeSwitch.style.height = "auto";
        alphaModeSwitch.style.border = "none";
        alphaModeSwitch.style.fontSize = "16px";
        alphaModeSwitch.style.backgroundColor = "#444444";
        alphaModeSwitch.style.color = "white";
        alphaModeSwitch.style.cursor = "pointer";
        alphaModeSwitch.onclick = (): void => {
            if (currentMode === "Alpha Mode") return;
            alphaModeSwitch.style.backgroundColor = "#444444";
            forceDapthWriteSwitch.style.backgroundColor = "#111111";
            currentMode = "Alpha Mode";
            switchMaterialTransparencyMode(currentMode);
            renderMaterialsList();
        };
        modeSwitchContainer.appendChild(alphaModeSwitch);

        const forceDapthWriteSwitch = document.createElement("button");
        forceDapthWriteSwitch.textContent = "Force Depth Write Mode";
        forceDapthWriteSwitch.style.flexGrow = "1";
        forceDapthWriteSwitch.style.height = "auto";
        forceDapthWriteSwitch.style.border = "none";
        forceDapthWriteSwitch.style.fontSize = "16px";
        forceDapthWriteSwitch.style.backgroundColor = "#111111";
        forceDapthWriteSwitch.style.color = "white";
        forceDapthWriteSwitch.style.cursor = "pointer";
        forceDapthWriteSwitch.onclick = (): void => {
            if (currentMode === "Force Depth Write Mode") return;
            alphaModeSwitch.style.backgroundColor = "#111111";
            forceDapthWriteSwitch.style.backgroundColor = "#444444";
            currentMode = "Force Depth Write Mode";
            switchMaterialTransparencyMode(currentMode);
            renderMaterialsList();
        };
        modeSwitchContainer.appendChild(forceDapthWriteSwitch);

        const materialListTitle = document.createElement("div");
        materialListTitle.textContent = "Materials";
        materialListTitle.style.width = "100%";
        materialListTitle.style.height = "auto";
        materialListTitle.style.fontSize = "18px";
        materialListTitle.style.backgroundColor = "#444444";
        materialListTitle.style.color = "white";
        materialListTitle.style.padding = "2px 5px";
        materialListTitle.style.boxSizing = "border-box";
        innerFormDiv.appendChild(materialListTitle);

        const materialListContainer = document.createElement("div");
        materialListContainer.style.width = "350px";
        materialListContainer.style.flexGrow = "1";
        materialListContainer.style.overflow = "auto";
        materialListContainer.style.marginBottom = "10px";
        materialListContainer.style.border = "1px solid black";
        materialListContainer.style.boxSizing = "border-box";
        innerFormDiv.appendChild(materialListContainer);

        const materialList = document.createElement("ol");
        materialList.start = 0;
        materialList.style.height = "auto";
        materialList.style.fontSize = "16px";
        materialListContainer.appendChild(materialList);
        const renderMaterialsList = (): void => {
            materialList.innerHTML = "";

            if (mesh === null) return;

            const meshes = mesh.metadata.meshes;
            for (let i = 0; i < meshes.length; ++i) {
                const material = meshes[i].material as MmdStandardMaterial;

                const item = document.createElement("li");
                item.style.padding = "5px 0px";
                item.style.boxSizing = "border-box";
                item.style.whiteSpace = "nowrap";

                item.textContent = material.name;

                if (currentMode === "Alpha Mode") {
                    const transparencyModeButton = document.createElement("button");
                    transparencyModeButton.style.float = "right";
                    transparencyModeButton.style.width = "100px";
                    transparencyModeButton.style.height = "auto";
                    transparencyModeButton.style.fontSize = "14px";
                    transparencyModeButton.style.marginRight = "10px";
                    transparencyModeButton.style.border = "none";
                    transparencyModeButton.textContent = fromTransparencyModeEnumToString(material.transparencyMode ?? 0);
                    const materialIndex = i;
                    transparencyModeButton.onclick = (): void => {
                        if (material.transparencyMode === null) material.transparencyMode = 0;
                        material.transparencyMode = (material.transparencyMode + 1) % 3;
                        alphaEvaluateResults[materialIndex] = material.transparencyMode;
                        transparencyModeButton.textContent = fromTransparencyModeEnumToString(material.transparencyMode ?? 0);
                    };
                    item.appendChild(transparencyModeButton);
                } else {
                    const opaqueToggleButton = document.createElement("button");
                    opaqueToggleButton.style.float = "right";
                    opaqueToggleButton.style.width = "100px";
                    opaqueToggleButton.style.height = "auto";
                    opaqueToggleButton.style.fontSize = "14px";
                    opaqueToggleButton.style.marginRight = "10px";
                    opaqueToggleButton.style.border = "none";
                    opaqueToggleButton.textContent = material.transparencyMode === Material.MATERIAL_OPAQUE ? "Opaque" : "Alpha Blend";
                    const materialIndex = i;
                    opaqueToggleButton.onclick = (): void => {
                        material.transparencyMode = material.transparencyMode === Material.MATERIAL_OPAQUE ? Material.MATERIAL_ALPHABLEND : Material.MATERIAL_OPAQUE;
                        translucentMaterials[materialIndex] = material.transparencyMode === Material.MATERIAL_ALPHABLEND;
                        opaqueToggleButton.textContent = material.transparencyMode === Material.MATERIAL_OPAQUE ? "Opaque" : "Alpha Blend";
                    };
                    item.appendChild(opaqueToggleButton);
                }

                materialList.appendChild(item);
            }

            function fromTransparencyModeEnumToString(transparencyMode: number): string {
                switch (transparencyMode) {
                case Material.MATERIAL_OPAQUE:
                    return "Opaque";
                case Material.MATERIAL_ALPHATEST:
                    return "Alpha Test";
                case Material.MATERIAL_ALPHABLEND:
                    return "Alpha Blend";
                default:
                    return "Unknown";
                }
            }
        };

        // #endregion

        const convertOptions = document.createElement("div");
        convertOptions.style.width = "100%";
        convertOptions.style.height = "auto";
        convertOptions.style.display = "flex";
        convertOptions.style.flexDirection = "column";
        convertOptions.style.justifyContent = "center";
        convertOptions.style.alignItems = "center";
        convertOptions.style.marginBottom = "10px";
        convertOptions.style.border = "1px solid black";
        convertOptions.style.padding = "20px";
        convertOptions.style.boxSizing = "border-box";
        innerFormDiv.appendChild(convertOptions);

        const preserveSerializationDataDiv = document.createElement("div");
        preserveSerializationDataDiv.style.width = "100%";
        preserveSerializationDataDiv.style.height = "30px";
        preserveSerializationDataDiv.style.display = "flex";
        preserveSerializationDataDiv.style.flexDirection = "row";
        preserveSerializationDataDiv.style.justifyContent = "space-between";
        preserveSerializationDataDiv.style.alignItems = "center";
        preserveSerializationDataDiv.style.marginBottom = "10px";
        convertOptions.appendChild(preserveSerializationDataDiv);

        const preserveSerializationDataLabel = document.createElement("label");
        preserveSerializationDataLabel.textContent = "Preserve Serialization Data";
        preserveSerializationDataLabel.title = "If enabled, the converted file will be larger, but the converted file will be able to be converted back to PMX without any loss of data in technically(currently BPMX to PMX conversion is not supported).";
        preserveSerializationDataLabel.style.textAlign = "left";
        preserveSerializationDataLabel.style.marginRight = "10px";
        preserveSerializationDataLabel.style.fontSize = "16px";
        preserveSerializationDataDiv.appendChild(preserveSerializationDataLabel);

        const preserveSerializationDataSmallLabel = document.createElement("label");
        preserveSerializationDataSmallLabel.textContent = "(reload required)";
        preserveSerializationDataSmallLabel.style.fontSize = "11px";
        preserveSerializationDataSmallLabel.style.color = "gray";
        preserveSerializationDataSmallLabel.style.flexGrow = "1";
        preserveSerializationDataDiv.appendChild(preserveSerializationDataSmallLabel);

        const preserveSerializationDataInput = document.createElement("input");
        preserveSerializationDataInput.style.width = "16px";
        preserveSerializationDataInput.style.height = "16px";
        preserveSerializationDataInput.type = "checkbox";
        preserveSerializationDataInput.checked = pmxLoader.preserveSerializationData;
        preserveSerializationDataDiv.appendChild(preserveSerializationDataInput);
        preserveSerializationDataInput.onclick = (event): void => {
            if (isLoading) {
                event.preventDefault();
                return;
            }
            pmxLoader.preserveSerializationData = preserveSerializationDataInput.checked;
            pmdLoader.preserveSerializationData = preserveSerializationDataInput.checked;

            if (selectedFile === null) return;
            loadModelAsync(selectedFile);
        };

        const buildSkeletonDiv = document.createElement("div");
        buildSkeletonDiv.style.width = "100%";
        buildSkeletonDiv.style.height = "30px";
        buildSkeletonDiv.style.display = "flex";
        buildSkeletonDiv.style.flexDirection = "row";
        buildSkeletonDiv.style.justifyContent = "space-between";
        buildSkeletonDiv.style.alignItems = "center";
        buildSkeletonDiv.style.marginBottom = "10px";
        convertOptions.appendChild(buildSkeletonDiv);

        const buildSkeletonLabel = document.createElement("label");
        buildSkeletonLabel.textContent = "Build Skeleton";
        buildSkeletonLabel.title = "If your model don't need to be animated by skeleton(e.g. stage model), you can disable this option to reduce the size of the converted file. also, it can improve the performance of the converted model.";
        buildSkeletonLabel.style.textAlign = "left";
        buildSkeletonLabel.style.marginRight = "10px";
        buildSkeletonLabel.style.fontSize = "16px";
        buildSkeletonLabel.style.flexGrow = "1";
        buildSkeletonDiv.appendChild(buildSkeletonLabel);

        const buildSkeletonInput = document.createElement("input");
        buildSkeletonInput.style.width = "16px";
        buildSkeletonInput.style.height = "16px";
        buildSkeletonInput.type = "checkbox";
        buildSkeletonInput.checked = pmxLoader.buildSkeleton;
        buildSkeletonDiv.appendChild(buildSkeletonInput);

        const buildMorphDiv = document.createElement("div");
        buildMorphDiv.style.width = "100%";
        buildMorphDiv.style.height = "30px";
        buildMorphDiv.style.display = "flex";
        buildMorphDiv.style.flexDirection = "row";
        buildMorphDiv.style.justifyContent = "space-between";
        buildMorphDiv.style.alignItems = "center";
        buildMorphDiv.style.marginBottom = "10px";
        convertOptions.appendChild(buildMorphDiv);

        const buildMorphLabel = document.createElement("label");
        buildMorphLabel.textContent = "Build Morph";
        buildMorphLabel.title = "If your model don't need to be animated by morph targets(e.g. stage model), you can disable this option to reduce the size of the converted file. also, it can improve the performance of the converted model.";
        buildMorphLabel.style.textAlign = "left";
        buildMorphLabel.style.marginRight = "10px";
        buildMorphLabel.style.fontSize = "16px";
        buildMorphLabel.style.flexGrow = "1";
        buildMorphDiv.appendChild(buildMorphLabel);

        const buildMorphInput = document.createElement("input");
        buildMorphInput.style.width = "16px";
        buildMorphInput.style.height = "16px";
        buildMorphInput.type = "checkbox";
        buildMorphInput.checked = pmxLoader.buildMorph;
        buildMorphDiv.appendChild(buildMorphInput);

        const buttonContainer = document.createElement("div");
        buttonContainer.style.width = "100%";
        buttonContainer.style.height = "auto";
        buttonContainer.style.display = "flex";
        buttonContainer.style.flexDirection = "row";
        buttonContainer.style.justifyContent = "space-between";
        buttonContainer.style.alignItems = "center";
        innerFormDiv.appendChild(buttonContainer);

        const convertButton = document.createElement("button");
        convertButton.textContent = "Convert";
        convertButton.style.width = "100%";
        convertButton.style.height = "60px";
        convertButton.style.border = "none";
        convertButton.style.fontSize = "20px";
        buttonContainer.appendChild(convertButton);
        convertButton.onclick = async(): Promise<void> => {
            if (isLoading) return;
            if (selectedFile === null) return;
            if (mesh === null) return;

            isLoading = true;
            engine.displayLoadingUI();

            engine.loadingUIText = `<br/><br/><br/>Converting (${selectedFile.name})...`;
            const arrayBuffer = bpmxConverter.convert(mesh, {
                includeSkinningData: buildSkeletonInput.checked,
                includeMorphData: buildMorphInput.checked,
                translucentMaterials: translucentMaterials,
                alphaEvaluateResults: alphaEvaluateResults
            });
            const blob = new Blob([arrayBuffer], { type: "application/octet-stream" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `${selectedFile.name.substring(0, selectedFile.name.lastIndexOf("."))}.bpmx`;
            a.click();
            URL.revokeObjectURL(url);
            a.remove();

            await new Promise<void>(resolve => {
                setTimeout(() => {
                    engine.hideLoadingUI();
                    resolve();
                }, 1500);
            });
            isLoading = false;
        };

        loadModelTab.click();
        engine.resize(true);
        return scene;
    }
}
