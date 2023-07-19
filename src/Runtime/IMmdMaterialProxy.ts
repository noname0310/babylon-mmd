import type { Material } from "@babylonjs/core/Materials/material";

import type { Vec3, Vec4 } from "@/loader/parser/MmdTypes";

export interface IMmdMaterialProxy {
    reset(): void;
    applyChanges(): void;

    readonly diffuse: Vec4;
    readonly specular: Vec3;
    shininess: number;
    readonly ambient: Vec3;
    readonly edgeColor: Vec4;
    edgeSize: number;
    readonly textureColor: Vec4;
    readonly sphereTextureColor: Vec4;
    readonly toonTextureColor: Vec4;
}

export interface IMmdMaterialProxyConstructor<T extends Material> {
    new(material: T): IMmdMaterialProxy;
}
