import { wasm_bindgen } from "../wasm";
import type { WorkerInitInput } from "./workerPool";

onmessage = async({ data: { module, memory, receiver } }: MessageEvent<WorkerInitInput>): Promise<void> => {
    await wasm_bindgen(module, memory);
    postMessage(true);
    wasm_bindgen.workerEntry(receiver);
};
