import type { BulletWasmInstance } from "../bulletWasmInstance";
import { RigidBodyConstructionInfoList } from "../rigidBodyConstructionInfoList";
import type { PluginBodyBundle } from "./pluginBodyBundle";

export class PluginConstructionInfoList extends RigidBodyConstructionInfoList {
    public worldId: number;
    public readonly commandsOnCreation: ((bundle: PluginBodyBundle) => void)[];

    public constructor(wasmInstance: BulletWasmInstance, count: number) {
        super(wasmInstance, count);
        this.worldId = 0;
        this.commandsOnCreation = [];
    }

    public get length(): number {
        return this.count;
    }
}
