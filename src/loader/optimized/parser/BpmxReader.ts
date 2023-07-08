import type { ILogger } from "../../parser/ILogger";
import { ConsoleLogger } from "../../parser/ILogger";
import { MmdDataDeserializer } from "../../parser/MmdDataDeserializer";
import type { BpmxObject } from "./BpmxObject";

export class BpmxReader {
    private constructor() { /* block constructor */ }

    public static async ParseAsync(data: ArrayBufferLike, logger: ILogger = new ConsoleLogger()): Promise<BpmxObject> {
        const dataDeserializer = new MmdDataDeserializer(data);

        dataDeserializer;
        logger;
        throw new Error("Not implemented");
    }
}
