import type { MmdStandardMaterial } from "../mmdStandardMaterial";

export function transferAmbientToDiffuse(material: MmdStandardMaterial): void {
    material.diffuseColor
        .addInPlace(material.ambientColor)
        .clampToRef(0, 1, material.diffuseColor);
    material.ambientColor.set(0, 0, 0);
}
