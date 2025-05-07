import type { IBulletWasmInstance } from "../bulletWasmInstance";
import { RigidBodyConstructionInfo } from "../rigidBodyConstructionInfo";
import type { PluginBody } from "./pluginBody";

export class PluginConstructionInfo extends RigidBodyConstructionInfo {
    public worldId: number;
    public readonly commandsOnCreation: ((body: PluginBody) => void)[];

    public constructor(wasmInstance: IBulletWasmInstance) {
        super(wasmInstance);
        this.worldId = 0;
        this.commandsOnCreation = [];
    }
}
