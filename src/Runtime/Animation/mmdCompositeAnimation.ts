import type { ILogger } from "../ILogger";
import type { MmdModel } from "../mmdModel";
import type { IMmdBindableModelAnimation } from "./IMmdBindableAnimation";
import type { IMmdRuntimeModelAnimation } from "./IMmdRuntimeAnimation";

export class MmdCompositeRuntimeModelAnimation implements IMmdRuntimeModelAnimation {
    public animation: MmdCompositeAnimation;

    public constructor(animation: MmdCompositeAnimation) {
        this.animation = animation;
    }

    public animate(frameTime: number): void {
        frameTime;
        throw new Error("Method not implemented.");
    }

    public induceMaterialRecompile(logger?: ILogger): void {
        logger;
        throw new Error("Method not implemented.");
    }
}

export class MmdAnimationSpan {

}

export class MmdCompositeAnimation implements IMmdBindableModelAnimation {
    public name: string;
    public startFrame: number;
    public endFrame: number;

    public constructor(name: string) {
        this.name = name;
        this.startFrame = 0;
        this.endFrame = 0;
    }

    public addSpan(span: MmdAnimationSpan): void {
        span;
        throw new Error("Method not implemented.");
    }

    public createRuntimeModelAnimation(model: MmdModel, retargetingMap?: { [key: string]: string; }, logger?: ILogger): IMmdRuntimeModelAnimation {
        model;
        retargetingMap;
        logger;
        throw new Error("Method not implemented.");
    }
}
