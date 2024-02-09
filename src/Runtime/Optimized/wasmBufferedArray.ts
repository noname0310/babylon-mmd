import type { IWasmTypedArray } from "./IWasmTypedArray";
import type { MmdWasmInstance } from "./mmdWasmInstance";
import type { TypedArray, TypedArrayConstructor } from "./wasmTypedArray";

/**
 * Wasm two-buffered array for multi-threading
 */
export class WasmBufferedArray<T extends TypedArray> {
    private _frontBuffer: T;
    private _backBuffer: T;

    /**
     * Create a new wasm buffered array
     * @param frontBuffer Front buffer
     * @param backBuffer Back buffer
     */
    public constructor(
        frontBuffer: IWasmTypedArray<T>,
        backBuffer?: IWasmTypedArray<T>
    ) {
        this._frontBuffer = frontBuffer.array;
        this._backBuffer = backBuffer?.array ?? frontBuffer.array;
    }

    /**
     * Set back buffer
     *
     * This method should be called once before starting multi-threading
     * @param backBuffer Back buffer
     */
    public setBackBuffer(backBuffer: IWasmTypedArray<T>): void {
        this._backBuffer = backBuffer.array;
    }

    /**
     * Swap front and back buffers
     *
     * Span objects created from the front buffer will be automatically updated
     */
    public swap(): void {
        const temp = this._backBuffer;
        this._backBuffer = this._frontBuffer;
        this._frontBuffer = temp;
    }

    /**
     * Get front buffer
     */
    public get frontBuffer(): T {
        return this._frontBuffer;
    }

    /**
     * Get back buffer
     */
    public get backBuffer(): T {
        return this._backBuffer;
    }
}

/**
 * Wasm two-buffered array span for multi-threading
 */
export class WasmBufferedArraySpan<T extends TypedArray> {
    private readonly _data: WasmBufferedArray<T>;

    private _frontBufferPtr: number;
    private _frontBufferSpan: T;

    private _backBufferSpan: T;

    /**
     * Create a new wasm buffered array span
     * @param wasmInstance MMD WASM instance
     * @param data Wasm buffered array
     * @param byteOffset Byte offset relative to the buffer
     * @param length Length of the span
     */
    public constructor(
        wasmInstance: MmdWasmInstance,
        data: WasmBufferedArray<T>,
        byteOffset: number,
        length: number
    ) {
        this._data = data;

        const frontBufferPtr = this._frontBufferPtr = data.frontBuffer.byteOffset;
        this._frontBufferSpan = wasmInstance.createTypedArray(
            data.frontBuffer.constructor as TypedArrayConstructor<T>,
            frontBufferPtr + byteOffset,
            length
        ).array;

        const backBufferPtr = data.backBuffer.byteOffset;
        this._backBufferSpan = wasmInstance.createTypedArray(
            data.backBuffer.constructor as TypedArrayConstructor<T>,
            backBufferPtr + byteOffset,
            length
        ).array;
    }

    /**
     * Update back buffer reference
     *
     * This method should be called once before starting multi-threading when the back buffer is not initialized
     * @param wasmInstance MMD WASM instance
     */
    public updateBackBufferReference(wasmInstance: MmdWasmInstance): void {
        const frontBufferSpan = this._frontBufferSpan;

        const byteOffset = frontBufferSpan.byteOffset - this._frontBufferPtr;
        const length = frontBufferSpan.length;

        const backBufferPtr = this._data.backBuffer.byteOffset;
        this._backBufferSpan = wasmInstance.createTypedArray(
            this._data.backBuffer.constructor as TypedArrayConstructor<T>,
            backBufferPtr + byteOffset,
            length
        ).array;
    }

    /**
     * Get front buffer span
     */
    public get array(): T {
        if (this._frontBufferPtr !== this._data.frontBuffer.byteOffset) {
            this._frontBufferPtr = this._data.frontBuffer.byteOffset;

            const temp = this._backBufferSpan;
            this._backBufferSpan = this._frontBufferSpan;
            this._frontBufferSpan = temp;
        }
        return this._frontBufferSpan;
    }
}
