// ref: https://github.com/RReverser/wasm-bindgen-rayon/blob/main/src/workerHelpers.js

import type { MmdWasmInstance } from "../mmdWasmInstance";

export interface WorkerInitInput {
    module: WebAssembly.Module;
    memory: WebAssembly.Memory;
    receiver: number;
}

export class WorkerPool {
    private readonly _workers: Worker[] = [];

    private constructor(
        workers: Worker[]
    ) {
        this._workers = workers;
    }

    public forceTerminate(): void {
        for (const worker of this._workers) {
            worker.terminate();
        }
        this._workers.length = 0;
    }

    public static async Initialize(
        module: WebAssembly.Module,
        wasmInstance: MmdWasmInstance,
        threadCount: number
    ): Promise<WorkerPool> {
        if (threadCount <= 0) {
            throw new Error("threadCount must be > 0.");
        }

        const workerPoolBuilder = wasmInstance.createWorkerPoolBuilder(threadCount);

        const workerInit: WorkerInitInput = {
            module,
            memory: wasmInstance.memory,
            receiver: workerPoolBuilder.receiver()
        };

        const workerPromises = new Array<Promise<Worker>>(threadCount);
        for (let i = 0; i < threadCount; i++) {
            const worker = new Worker(
                new URL("./worker", import.meta.url),
                {
                    type: "module"
                }
            );
            worker.postMessage(workerInit);
            workerPromises[i] = new Promise<Worker>(resolve =>
                worker.addEventListener("message", () => resolve(worker), { once: true })
            );
        }

        const workers = await Promise.all(workerPromises);
        workerPoolBuilder.build();

        workerPoolBuilder.free();

        return new WorkerPool(workers);
    }
}
