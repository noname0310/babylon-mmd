import type { IMmdMaterialProxyConstructor } from "./IMmdMaterialProxy";

/**
 * Globally shared MMD runtime settings
 *
 * This class is used to share settings across the MMD runtime
 */
export class MmdRuntimeShared {
    /**
     * Default value of `IMmdModelCreationOptions.materialProxyConstructor`
     */
    public static MaterialProxyConstructor: IMmdMaterialProxyConstructor<any> | null = null;
}
