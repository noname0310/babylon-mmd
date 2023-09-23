import type { ILogger } from "./ILogger";
import type { PmxObject } from "./pmxObject";

/**
 * Pmx reader static class interface
 */
export interface IPmxReaderConstructor {
    /* eslint-disable @typescript-eslint/naming-convention */
    /**
     * Parses PMX data asynchronously
     * @param data Arraybuffer of PMX data
     * @param logger Logger
     * @returns PMX data
     * @throws {Error} If the parse fails
     */
    ParseAsync(data: ArrayBufferLike, logger?: ILogger): Promise<PmxObject>;
    /* eslint-enable @typescript-eslint/naming-convention */
}
