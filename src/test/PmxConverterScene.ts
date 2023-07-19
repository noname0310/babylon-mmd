import { ArcRotateCamera } from "@babylonjs/core/Cameras/arcRotateCamera";
import type { Engine } from "@babylonjs/core/Engines/engine";
import { DirectionalLight } from "@babylonjs/core/Lights/directionalLight";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { ShadowGenerator } from "@babylonjs/core/Lights/Shadows/shadowGenerator";
import { SceneLoader } from "@babylonjs/core/Loading/sceneLoader";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { Scene } from "@babylonjs/core/scene";
import type { Nullable } from "@babylonjs/core/types";

import type { MmdStandardMaterialBuilder } from "@/loader/MmdStandardMaterialBuilder";
import { BpmxConverter } from "@/loader/optimized/BpmxConverter";
import { PmxLoader } from "@/loader/PmxLoader";
import { SdefInjector } from "@/loader/SdefInjector";
import type { MmdStaticMesh } from "@/runtime/MmdMesh";

import type { ISceneBuilder } from "./BaseRuntime";

async function readDirectories(entries: FileSystemEntry[], path = ""): Promise<FileSystemFileEntry[]> {
    const result: FileSystemFileEntry[] = [];

    for (let i = 0; i < entries.length; i++) {
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
    for (let i = 0; i < directories.length; i++) {
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

export class PmxConverterScene implements ISceneBuilder {
    public async build(canvas: HTMLCanvasElement, engine: Engine): Promise<Scene> {
        SdefInjector.OverrideEngineCreateEffect(engine);
        const pmxLoader = new PmxLoader();
        pmxLoader.loggingEnabled = true;
        pmxLoader.buildSkeleton = false;
        pmxLoader.buildMorph = false;
        SceneLoader.RegisterPlugin(pmxLoader);

        const scene = new Scene(engine);

        const camera = new ArcRotateCamera("camera", 0, 0, 45, new Vector3(0, 10, 0), scene);
        camera.maxZ = 5000;
        camera.fov = 30 * (Math.PI / 180);
        camera.speed = 0.5;
        camera.setPosition(new Vector3(0, 10, -45));
        camera.attachControl(canvas, true);

        const hemisphericLight = new HemisphericLight("hemisphericLight", new Vector3(0, 1, 0), scene);
        hemisphericLight.intensity = 0.4;
        hemisphericLight.specular = new Color3(0, 0, 0);
        hemisphericLight.groundColor = new Color3(1, 1, 1);

        const directionalLight = new DirectionalLight("directionalLight", new Vector3(0.5, -1, 1), scene);
        directionalLight.intensity = 0.8;
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
        shadowGenerator.usePercentageCloserFiltering = true;
        shadowGenerator.forceBackFacesOnly = true;
        shadowGenerator.filteringQuality = ShadowGenerator.QUALITY_MEDIUM;
        shadowGenerator.frustumEdgeFalloff = 0.1;

        const ground = MeshBuilder.CreateGround("ground1", { width: 100, height: 100, subdivisions: 2, updatable: false }, scene);
        ground.receiveShadows = true;
        shadowGenerator.addShadowCaster(ground);

        const loadModelAsync = async(file: File): Promise<void> => {
            if (isLoading) return;

            if (mesh !== null) {
                shadowGenerator.removeShadowCaster(mesh);
                mesh.dispose(false, true);
                mesh = null;
            }

            isLoading = true;
            engine.displayLoadingUI();
            const fileRelativePath = file.webkitRelativePath as string;
            selectedPmxFile.textContent = file.name;
            const materialBuilder = pmxLoader.materialBuilder as MmdStandardMaterialBuilder;
            materialBuilder.useAlphaEvaluation = bpmxConverter.useAlphaEvaluation;
            materialBuilder.alphaEvaluationResolution = bpmxConverter.alphaEvaluationResolution;
            materialBuilder.alphaThreshold = bpmxConverter.alphaThreshold;
            materialBuilder.alphaBlendThreshold = bpmxConverter.alphaBlendThreshold;
            mesh = (await SceneLoader.ImportMeshAsync(
                undefined,
                fileRelativePath.substring(0, fileRelativePath.lastIndexOf("/") + 1),
                file,
                scene,
                (event) => engine.loadingUIText = `<br/><br/><br/>Loading (${file.name})... ${event.loaded}/${event.total} (${Math.floor(event.loaded * 100 / event.total)}%)`
            )).meshes[0] as MmdStaticMesh;
            mesh.receiveShadows = true;
            shadowGenerator.addShadowCaster(mesh);
            engine.hideLoadingUI();
            setTimeout(() => isLoading = false, 1500);
        };

        let selectedFile: Nullable<File> = null;
        let mesh: Nullable<MmdStaticMesh> = null;
        let isLoading = false;

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
        title.style.width = "500px";
        title.style.textAlign = "center";
        title.style.marginTop = "0";
        innerFormDiv.appendChild(title);

        const selectedPmxFile = document.createElement("div");
        selectedPmxFile.textContent = "No PMX file selected";
        selectedPmxFile.style.width = "100%";
        selectedPmxFile.style.height = "auto";
        selectedPmxFile.style.fontSize = "20px";
        selectedPmxFile.style.marginBottom = "10px";
        selectedPmxFile.style.border = "1px solid black";
        selectedPmxFile.style.boxSizing = "border-box";
        selectedPmxFile.style.padding = "10px";
        innerFormDiv.appendChild(selectedPmxFile);

        const listContainer = document.createElement("div");
        listContainer.style.width = "500px";
        listContainer.style.flexGrow = "1";
        listContainer.style.overflow = "auto";
        listContainer.style.marginBottom = "10px";
        listContainer.style.border = "1px solid black";
        listContainer.style.boxSizing = "border-box";
        innerFormDiv.appendChild(listContainer);

        const pmxFileList = document.createElement("ul");
        pmxFileList.style.height = "auto";
        pmxFileList.style.fontSize = "16px";
        listContainer.appendChild(pmxFileList);
        const renderLoadedFiles = (): void => {
            pmxFileList.innerHTML = "";
            for (const file of files) {
                const item = document.createElement("li");
                item.style.whiteSpace = "nowrap";
                const fileRelativePath = file.webkitRelativePath as string;
                item.textContent = fileRelativePath;
                if (file.name.endsWith(".pmx")) {
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
        };
        fileInput.onchange = (): void => {
            if (fileInput.files === null) return;
            files = Array.from(fileInput.files);
            renderLoadedFiles();
            pmxLoader.referenceFiles = files;
        };
        innerFormDiv.appendChild(fileInput);

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

        const useAlphaEvaluationDiv = document.createElement("div");
        useAlphaEvaluationDiv.style.width = "100%";
        useAlphaEvaluationDiv.style.height = "50px";
        useAlphaEvaluationDiv.style.display = "flex";
        useAlphaEvaluationDiv.style.flexDirection = "row";
        useAlphaEvaluationDiv.style.justifyContent = "space-between";
        useAlphaEvaluationDiv.style.alignItems = "center";
        useAlphaEvaluationDiv.style.marginBottom = "10px";
        convertOptions.appendChild(useAlphaEvaluationDiv);

        const useAlphaEvaluationLabel = document.createElement("label");
        useAlphaEvaluationLabel.textContent = "Use Alpha Evaluation";
        useAlphaEvaluationLabel.style.width = "200px";
        useAlphaEvaluationLabel.style.textAlign = "left";
        useAlphaEvaluationLabel.style.marginRight = "10px";
        useAlphaEvaluationLabel.style.fontSize = "20px";
        useAlphaEvaluationLabel.style.flexGrow = "1";
        useAlphaEvaluationDiv.appendChild(useAlphaEvaluationLabel);

        const useAlphaEvaluationInput = document.createElement("input");
        useAlphaEvaluationInput.style.width = "20px";
        useAlphaEvaluationInput.style.height = "20px";
        useAlphaEvaluationInput.style.fontSize = "20px";
        useAlphaEvaluationInput.type = "checkbox";
        useAlphaEvaluationInput.checked = bpmxConverter.useAlphaEvaluation;
        useAlphaEvaluationDiv.appendChild(useAlphaEvaluationInput);
        useAlphaEvaluationInput.onchange = (): void => {
            bpmxConverter.useAlphaEvaluation = useAlphaEvaluationInput.checked;
        };

        const alphaEvaluationResolutionDiv = document.createElement("div");
        alphaEvaluationResolutionDiv.style.width = "100%";
        alphaEvaluationResolutionDiv.style.height = "50px";
        alphaEvaluationResolutionDiv.style.display = "flex";
        alphaEvaluationResolutionDiv.style.flexDirection = "row";
        alphaEvaluationResolutionDiv.style.justifyContent = "space-between";
        alphaEvaluationResolutionDiv.style.alignItems = "center";
        alphaEvaluationResolutionDiv.style.marginBottom = "10px";
        convertOptions.appendChild(alphaEvaluationResolutionDiv);

        const alphaEvaluationResolutionLabel = document.createElement("label");
        alphaEvaluationResolutionLabel.textContent = "Alpha Evaluation Resolution";
        alphaEvaluationResolutionLabel.style.width = "200px";
        alphaEvaluationResolutionLabel.style.textAlign = "left";
        alphaEvaluationResolutionLabel.style.marginRight = "10px";
        alphaEvaluationResolutionLabel.style.fontSize = "20px";
        alphaEvaluationResolutionLabel.style.flexGrow = "1";
        alphaEvaluationResolutionDiv.appendChild(alphaEvaluationResolutionLabel);

        const alphaEvaluationResolutionInput = document.createElement("input");
        alphaEvaluationResolutionInput.style.width = "100px";
        alphaEvaluationResolutionInput.style.height = "40px";
        alphaEvaluationResolutionInput.style.fontSize = "20px";
        alphaEvaluationResolutionInput.type = "number";
        alphaEvaluationResolutionInput.min = "64";
        alphaEvaluationResolutionInput.max = "4096";
        alphaEvaluationResolutionInput.value = bpmxConverter.alphaEvaluationResolution.toString();
        alphaEvaluationResolutionDiv.appendChild(alphaEvaluationResolutionInput);
        alphaEvaluationResolutionInput.onchange = (): void => {
            bpmxConverter.alphaEvaluationResolution = Number(alphaEvaluationResolutionInput.value);
        };

        const alphaThresholdDiv = document.createElement("div");
        alphaThresholdDiv.style.width = "100%";
        alphaThresholdDiv.style.height = "50px";
        alphaThresholdDiv.style.display = "flex";
        alphaThresholdDiv.style.flexDirection = "row";
        alphaThresholdDiv.style.justifyContent = "space-between";
        alphaThresholdDiv.style.alignItems = "center";
        alphaThresholdDiv.style.marginBottom = "10px";
        convertOptions.appendChild(alphaThresholdDiv);

        const alphaThresholdLabel = document.createElement("label");
        alphaThresholdLabel.textContent = "Alpha Threshold";
        alphaThresholdLabel.style.width = "200px";
        alphaThresholdLabel.style.textAlign = "left";
        alphaThresholdLabel.style.marginRight = "10px";
        alphaThresholdLabel.style.fontSize = "20px";
        alphaThresholdLabel.style.flexGrow = "1";
        alphaThresholdDiv.appendChild(alphaThresholdLabel);

        const alphaThresholdInput = document.createElement("input");
        alphaThresholdInput.style.width = "100px";
        alphaThresholdInput.style.height = "40px";
        alphaThresholdInput.style.fontSize = "20px";
        alphaThresholdInput.type = "number";
        alphaThresholdInput.min = "0";
        alphaThresholdInput.max = "255";
        alphaThresholdInput.value = bpmxConverter.alphaThreshold.toString();
        alphaThresholdDiv.appendChild(alphaThresholdInput);
        alphaThresholdInput.onchange = (): void => {
            bpmxConverter.alphaThreshold = Number(alphaThresholdInput.value);
        };

        const alphaBlendThresholdDiv = document.createElement("div");
        alphaBlendThresholdDiv.style.width = "100%";
        alphaBlendThresholdDiv.style.height = "50px";
        alphaBlendThresholdDiv.style.display = "flex";
        alphaBlendThresholdDiv.style.flexDirection = "row";
        alphaBlendThresholdDiv.style.justifyContent = "space-between";
        alphaBlendThresholdDiv.style.alignItems = "center";
        convertOptions.appendChild(alphaBlendThresholdDiv);

        const alphaBlendThresholdLabel = document.createElement("label");
        alphaBlendThresholdLabel.textContent = "Alpha Blend Threshold";
        alphaBlendThresholdLabel.style.width = "200px";
        alphaBlendThresholdLabel.style.textAlign = "left";
        alphaBlendThresholdLabel.style.marginRight = "10px";
        alphaBlendThresholdLabel.style.fontSize = "20px";
        alphaBlendThresholdLabel.style.flexGrow = "1";
        alphaBlendThresholdDiv.appendChild(alphaBlendThresholdLabel);

        const alphaBlendThresholdInput = document.createElement("input");
        alphaBlendThresholdInput.style.width = "100px";
        alphaBlendThresholdInput.style.height = "40px";
        alphaBlendThresholdInput.style.fontSize = "20px";
        alphaBlendThresholdInput.type = "number";
        alphaBlendThresholdInput.min = "-500";
        alphaBlendThresholdInput.max = "500";
        alphaBlendThresholdInput.value = bpmxConverter.alphaBlendThreshold.toString();
        alphaBlendThresholdDiv.appendChild(alphaBlendThresholdInput);
        alphaBlendThresholdInput.onchange = (): void => {
            bpmxConverter.alphaBlendThreshold = Number(alphaBlendThresholdInput.value);
        };

        const buttonContainer = document.createElement("div");
        buttonContainer.style.width = "100%";
        buttonContainer.style.height = "auto";
        buttonContainer.style.display = "flex";
        buttonContainer.style.flexDirection = "row";
        buttonContainer.style.justifyContent = "space-between";
        buttonContainer.style.alignItems = "center";
        innerFormDiv.appendChild(buttonContainer);

        const reloadButton = document.createElement("button");
        reloadButton.textContent = "Reload";
        reloadButton.style.width = "100%";
        reloadButton.style.height = "60px";
        reloadButton.style.border = "none";
        reloadButton.style.fontSize = "20px";
        reloadButton.style.color = "gray";
        reloadButton.style.marginRight = "10px";
        buttonContainer.appendChild(reloadButton);
        reloadButton.onclick = (): void => {
            if (selectedFile === null) return;
            loadModelAsync(selectedFile);
        };

        const convertButton = document.createElement("button");
        convertButton.textContent = "Convert";
        convertButton.style.width = "100%";
        convertButton.style.height = "60px";
        convertButton.style.border = "none";
        convertButton.style.fontSize = "20px";
        buttonContainer.appendChild(convertButton);
        convertButton.onclick = async(): Promise<void> => {
            if (selectedFile === null) return;
            if (mesh === null) return;

            isLoading = true;
            engine.displayLoadingUI();

            const fileRelativePath = selectedFile.webkitRelativePath as string;
            engine.loadingUIText = `<br/><br/><br/>Converting (${selectedFile.name})...`;
            const arrayBuffer = await bpmxConverter.convert(scene, fileRelativePath, files);
            const blob = new Blob([arrayBuffer], { type: "application/octet-stream" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `${selectedFile.name.substring(0, selectedFile.name.lastIndexOf("."))}.bpmx`;
            a.click();
            URL.revokeObjectURL(url);
            a.remove();

            engine.hideLoadingUI();
            setTimeout(() => isLoading = false, 1500);
        };

        engine.resize(true);
        return scene;
    }
}
