import type { Vec3, Vec4 } from "./mmdTypes";

export type VpdObject = {
    bones: {
        [boneName: string]: {
            position?: Vec3;
            rotation: Vec4;
        };
    };
    morphs: {
        [morphName: string]: number;
    };
};
