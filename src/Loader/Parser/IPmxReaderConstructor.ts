import { ILogger } from "./ILogger";
import { PmxObject } from "./pmxObject";

/**
 * Pmx reader static class interface
 */
export interface IPmxReaderConstructor {
    /**
     * Parses PMX data asynchronously
     * @param data Arraybuffer of PMX data
     * @param logger Logger
     * @returns PMX data
     * @throws {Error} If the parse fails
     */
    ParseAsync(data: ArrayBufferLike, logger?: ILogger): Promise<PmxObject>;
}
