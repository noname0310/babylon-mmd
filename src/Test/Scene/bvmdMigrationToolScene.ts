import { FreeCamera } from "@babylonjs/core/Cameras/freeCamera";
import type { AbstractEngine } from "@babylonjs/core/Engines/abstractEngine";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Scene } from "@babylonjs/core/scene";

import { BvmdConverter } from "@/Loader/Optimized/bvmdConverter";
import { BvmdLoader } from "@/Loader/Optimized/Legacy/bvmdLoader";

import type { ISceneBuilder } from "../baseRuntime";

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

        const legacyBvmdLoader = new BvmdLoader(scene);
        legacyBvmdLoader.loggingEnabled = true;

        const files: File[] = [];

        const title = document.createElement("h1");
        title.textContent = "BVMD 2.X to 3.X Migration Tool";
        title.style.width = "100%";
        title.style.fontSize = "24px";
        title.style.textAlign = "center";
        title.style.marginBottom = "0";
        innerFormDiv.appendChild(title);

        const version = document.createElement("p");
        version.textContent = `BVMD Version: ${BvmdConverter.Version.join(".")}`;
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
        fileInput.accept = ".bvmd";
        fileInput.multiple = true;
        fileInput.onchange = (): void => {
            if (fileInput.files === null) return;
            for (const file of fileInput.files) {
                if (!file.name.endsWith(".bvmd")) continue;
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
                const animation = await legacyBvmdLoader.loadAsync(file.name, file);
                const arrayBuffer = BvmdConverter.Convert(animation);
                const blob = new Blob([arrayBuffer], { type: "application/octet-stream" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `${file.name.substring(0, file.name.lastIndexOf("."))}_migrated.bvmd`;
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
