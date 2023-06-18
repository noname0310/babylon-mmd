import { Logger, type Mesh } from "@babylonjs/core";

import type { ILogger } from "./ILogger";
import type { RuntimeMmdMesh } from "./MmdMesh";
import { MmdMesh } from "./MmdMesh";
import { MmdModel } from "./MmdModel";

export class MmdRuntime implements ILogger {
    private readonly _models: MmdModel[];

    private _loggingEnabled: boolean;

    /**
     * @internal
     */
    public log: (message: string) => void;
    /**
     * @internal
     */
    public warn: (message: string) => void;
    /**
     * @internal
     */
    public error: (message: string) => void;

    public constructor() {
        this._models = [];

        this._loggingEnabled = false;
        this.log = this.logDisabled;
        this.warn = this.warnDisabled;
        this.error = this.errorDisabled;
    }

    public createMmdModel(mmdMesh: Mesh): MmdModel {
        if (!MmdMesh.isMmdMesh(mmdMesh)) throw new Error("Mesh validation failed.");

        const model = new MmdModel(mmdMesh, this);
        this._models.push(model);

        const runtimeMesh = mmdMesh as unknown as RuntimeMmdMesh;
        runtimeMesh.metadata = {
            isRuntimeMmdModel: true,
            header: mmdMesh.metadata.header
        };

        return model;
    }

    public update(): void {
        const models = this._models;
        for (let i = 0; i < models.length; ++i) {
            const model = models[i];
            model.morph.update();
        }
    }

    public get loggingEnabled(): boolean {
        return this._loggingEnabled;
    }

    public set loggingEnabled(value: boolean) {
        this._loggingEnabled = value;

        if (value) {
            this.log = this.logEnabled;
            this.warn = this.warnEnabled;
            this.error = this.errorEnabled;
        } else {
            this.log = this.logDisabled;
            this.warn = this.warnDisabled;
            this.error = this.errorDisabled;
        }
    }

    private logEnabled(message: string): void {
        Logger.Log(message);
    }

    private logDisabled(): void {
        // do nothing
    }

    private warnEnabled(message: string): void {
        Logger.Warn(message);
    }

    private warnDisabled(): void {
        // do nothing
    }

    private errorEnabled(message: string): void {
        Logger.Error(message);
    }

    private errorDisabled(): void {
        // do nothing
    }
}
