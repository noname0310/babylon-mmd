import type { MmdAnimation } from "../Animation/mmdAnimation";
import type { ILogger } from "./ILogger";
import { ConsoleLogger } from "./ILogger";

/**
 * VmdReader is a static class that parses VMD data
 */
export class VpdReader {
    private constructor() { /* block constructor */ }

    /**
     * Parse VPD data and return single frame MMD animation data
     *
     * @param animationName animation name
     * @param data VPD data
     * @param logger logger
     * @returns MMD animation data
     * @throws {Error} If validation fails
     */
    public static Parse(animationName: string, data: string, logger: ILogger = new ConsoleLogger()): MmdAnimation {
        animationName;
        data;
        logger;
        throw new Error("Not implemented");
    }
}
