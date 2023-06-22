import type { Material} from "@babylonjs/core";
import { Logger, type Mesh } from "@babylonjs/core";

import type { ILogger } from "./ILogger";
import type { IMmdMaterialProxyConstructor } from "./IMmdMaterialProxy";
import type { RuntimeMmdMesh } from "./MmdMesh";
import { MmdMesh } from "./MmdMesh";
import { MmdModel } from "./MmdModel";
import { MmdStandardMaterialProxy } from "./MmdStandardMaterialProxy";

export class MmdRuntime implements ILogger {
    private readonly _models: MmdModel[];

    private _loggingEnabled: boolean;

    /** @internal */
    public log: (message: string) => void;
    /** @internal */
    public warn: (message: string) => void;
    /** @internal */
    public error: (message: string) => void;

    public constructor() {
        this._models = [];

        this._loggingEnabled = false;
        this.log = this._logDisabled;
        this.warn = this._warnDisabled;
        this.error = this._errorDisabled;
    }

    public createMmdModel(
        mmdMesh: Mesh,
        materialProxyConstructor: IMmdMaterialProxyConstructor<Material> = MmdStandardMaterialProxy as unknown as IMmdMaterialProxyConstructor<Material>
    ): MmdModel {
        if (!MmdMesh.isMmdMesh(mmdMesh)) throw new Error("Mesh validation failed.");

        const model = new MmdModel(mmdMesh, materialProxyConstructor, this);
        this._models.push(model);

        const runtimeMesh = mmdMesh as unknown as RuntimeMmdMesh;
        runtimeMesh.metadata = {
            isRuntimeMmdModel: true,
            header: mmdMesh.metadata.header
        };

        return model;
    }

    public destroyMmdModel(mmdModel: MmdModel): void {
        mmdModel.enableSkeletonWorldMatrixUpdate();

        const models = this._models;
        const index = models.indexOf(mmdModel);
        if (index < 0) throw new Error("Model not found.");

        models.splice(index, 1);
    }

    public update(): void {
        const models = this._models;
        for (let i = 0; i < models.length; ++i) {
            const model = models[i];
            model.beforePhysics();
            // todo: physics
            model.afterPhysics();
        }
    }

    public get models(): readonly MmdModel[] {
        return this._models;
    }

    public get loggingEnabled(): boolean {
        return this._loggingEnabled;
    }

    public set loggingEnabled(value: boolean) {
        this._loggingEnabled = value;

        if (value) {
            this.log = this._logEnabled;
            this.warn = this._warnEnabled;
            this.error = this._errorEnabled;
        } else {
            this.log = this._logDisabled;
            this.warn = this._warnDisabled;
            this.error = this._errorDisabled;
        }
    }

    private _logEnabled(message: string): void {
        Logger.Log(message);
    }

    private _logDisabled(): void {
        // do nothing
    }

    private _warnEnabled(message: string): void {
        Logger.Warn(message);
    }

    private _warnDisabled(): void {
        // do nothing
    }

    private _errorEnabled(message: string): void {
        Logger.Error(message);
    }

    private _errorDisabled(): void {
        // do nothing
    }
}
