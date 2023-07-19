import { FreeCamera } from "@babylonjs/core/Cameras/freeCamera";
import type { Engine } from "@babylonjs/core/Engines/engine";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Scene } from "@babylonjs/core/scene";

import { BvmdConverter } from "@/loader/optimized/BvmdConverter";
import { VmdLoader } from "@/loader/VmdLoader";

import type { ISceneBuilder } from "./BaseRuntime";

export class VmdConverterScene implements ISceneBuilder {
    public async build(canvas: HTMLCanvasElement, engine: Engine): Promise<Scene> {
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

        const vmdLoader = new VmdLoader(scene);
        vmdLoader.loggingEnabled = true;

        const files: File[] = [];

        const title = document.createElement("h1");
        title.textContent = "VMD to BVMD Converter";
        title.style.width = "500px";
        title.style.textAlign = "center";
        innerFormDiv.appendChild(title);

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
        fileInput.style.width = "100%";
        fileInput.style.height = "80px";
        fileInput.style.display = "block";
        fileInput.style.backgroundColor = "black";
        fileInput.style.color = "white";
        fileInput.style.marginBottom = "10px";
        fileInput.style.fontSize = "20px";

        fileInput.type = "file";
        fileInput.accept = ".vmd";
        fileInput.multiple = true;
        fileInput.onchange = (): void => {
            if (fileInput.files === null) return;
            for (const file of fileInput.files) {
                if (!file.name.endsWith(".vmd")) continue;
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
                alert("Please select a VMD file");
                return;
            }

            convertButton.textContent = "Converting...";
            const animation = await vmdLoader.loadAsync(files[0].name, files);
            const arrayBuffer = BvmdConverter.Convert(animation);
            const blob = new Blob([arrayBuffer], { type: "application/octet-stream" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `${files[0].name.substring(0, files[0].name.lastIndexOf("."))}.bvmd`;
            a.click();
            URL.revokeObjectURL(url);
            a.remove();

            files.length = 0;
            renderLoadedFiles();
            convertButton.textContent = "Convert";
        };
        innerFormDiv.appendChild(convertButton);

        return scene;
    }
}
