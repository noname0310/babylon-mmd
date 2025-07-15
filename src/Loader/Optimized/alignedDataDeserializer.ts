import type { Tuple } from "@babylonjs/core/types";

import { Endianness } from "../Parser/endianness";

const enum Constants {
    Alignment = 4
}

const enum Uint8 {
    Shift = 0
}

const enum Uint16 {
    Shift = 1
}

const enum Uint32 {
    Shift = 2
}

const enum Int32 {
    Shift = 2
}

const enum Float32 {
    Shift = 2
}

/**
 * Data deserializer only for strictly 4 byte aligned binary data
 *
 * Data assumed to be serialized in little endian
 */
export class AlignedDataDeserializer extends Endianness {
    public readonly arrayBuffer: ArrayBufferLike;
    private readonly _uint8Ptr: Uint8Array;
    private readonly _uint16Ptr: Uint16Array;
    private readonly _uint32Ptr: Uint32Array;
    private readonly _int32Ptr: Int32Array;
    private readonly _float32Ptr: Float32Array;
    private readonly _decoder: TextDecoder;
    private _offset: number;

    /**
     * Creates Aligned data deserializer
     * @param arrayBuffer ArrayBuffer to deserialize data
     */
    public constructor(arrayBuffer: ArrayBufferLike) {
        super();
        this.arrayBuffer = arrayBuffer;
        this._uint8Ptr = new Uint8Array(arrayBuffer);
        this._uint16Ptr = new Uint16Array(arrayBuffer);
        this._uint32Ptr = new Uint32Array(arrayBuffer);
        this._int32Ptr = new Int32Array(arrayBuffer);
        this._float32Ptr = new Float32Array(arrayBuffer);
        this._decoder = new TextDecoder("utf-8");
        this._offset = 0;
    }

    /**
     * Current offset in the buffer
     */
    public get offset(): number {
        return this._offset;
    }

    public set offset(value: number) {
        this._offset = value;
    }

    /**
     * Read a uint8 value
     * @returns Uint8 value
     */
    public getUint8(): number {
        const value = this._uint8Ptr[this._offset >> Uint8.Shift];
        this._offset += 1 << Uint8.Shift;
        return value;
    }

    /**
     * Read a uint8 array
     * @param array Uint8 array to fill
     * @param offset Offset in the array to start writing
     * @param length Length of the array to read
     */
    public getUint8Array(array: Uint8Array, offset: number = 0, length: number = array.length): void {
        array.set(new Uint8Array(this.arrayBuffer, this._offset, length), offset);
        this._offset += length * (1 << Uint8.Shift);
    }

    /**
     * Read a uint16 value
     * @returns Uint16 value
     */
    public getUint16(): number {
        const uint16Offset = this._offset >> Uint16.Shift;
        if (!this.isDeviceLittleEndian) this.swap16Array(this._uint16Ptr, uint16Offset, 1);
        const value = this._uint16Ptr[uint16Offset];
        this._offset += 1 << Uint16.Shift;
        return value;
    }

    /**
     * Read a uint16 array
     * @param array Uint16 array to fill
     * @param offset Offset in the array to start writing
     * @param length Length of the array to read
     */
    public getUint16Array(array: Uint16Array, offset: number = 0, length: number = array.length): void {
        if (!this.isDeviceLittleEndian) this.swap16Array(this._uint16Ptr, this._offset >> Uint16.Shift, length);
        array.set(new Uint16Array(this.arrayBuffer, this._offset, length), offset);
        this._offset += length * (1 << Uint16.Shift);
    }

    /**
     * Read a uint32 value
     * @returns Uint32 value
     */
    public getUint32(): number {
        const uint32Offset = this._offset >> Uint32.Shift;
        if (!this.isDeviceLittleEndian) this.swap32Array(this._uint32Ptr, uint32Offset, 1);
        const value = this._uint32Ptr[uint32Offset];
        this._offset += 1 << Uint32.Shift;
        return value;
    }

    /**
     * Read a uint32 array
     * @param array Uint32 array to fill
     * @param offset Offset in the array to start writing
     * @param length Length of the array to read
     */
    public getUint32Array(array: Uint32Array, offset: number = 0, length: number = array.length): void {
        if (!this.isDeviceLittleEndian) this.swap32Array(this._uint32Ptr, this._offset >> Uint32.Shift, length);
        array.set(new Uint32Array(this.arrayBuffer, this._offset, length), offset);
        this._offset += length * (1 << Uint32.Shift);
    }

    /**
     * Read a int32 value
     * @returns Int32 value
     */
    public getInt32(): number {
        const int32Offset = this._offset >> Int32.Shift;
        if (!this.isDeviceLittleEndian) this.swap32Array(this._int32Ptr, int32Offset, 1);
        const value = this._int32Ptr[int32Offset];
        this._offset += 1 << Int32.Shift;
        return value;
    }

    /**
     * Read a int32 array
     * @param array Int32 array to fill
     * @param offset Offset in the array to start writing
     * @param length Length of the array to read
     */
    public getInt32Array(array: Int32Array, offset: number = 0, length: number = array.length): void {
        if (!this.isDeviceLittleEndian) this.swap32Array(this._int32Ptr, this._offset >> Int32.Shift, length);
        array.set(new Int32Array(this.arrayBuffer, this._offset, length), offset);
        this._offset += length * (1 << Int32.Shift);
    }

    /**
     * Read a float32 value
     * @returns Float32 value
     */
    public getFloat32(): number {
        const float32Offset = this._offset >> Float32.Shift;
        if (!this.isDeviceLittleEndian) this.swap32Array(this._float32Ptr, float32Offset, 1);
        const value = this._float32Ptr[float32Offset];
        this._offset += 1 << Float32.Shift;
        return value;
    }

    /**
     * Read a float32 array
     * @param array Float32 array to fill
     * @param offset Offset in the array to start writing
     * @param length Length of the array to read
     */
    public getFloat32Array(array: Float32Array, offset: number = 0, length: number = array.length): void {
        if (!this.isDeviceLittleEndian) this.swap32Array(this._float32Ptr, this._offset >> Float32.Shift, length);
        array.set(new Float32Array(this.arrayBuffer, this._offset, length), offset);
        this._offset += length * (1 << Float32.Shift);
    }

    /**
     * Read a float32 tuple
     * @param length Tuple length
     * @returns Float32 tuple
     */
    public getFloat32Tuple<N extends number>(length: N): Tuple<number, N> {
        const result = new Array<number>(length);
        const float32Offset = this._offset >> Float32.Shift;
        const float32Ptr = this._float32Ptr;
        if (!this.isDeviceLittleEndian) this.swap32Array(float32Ptr, float32Offset, length);
        for (let i = 0; i < length; ++i) {
            result[i] = float32Ptr[float32Offset + i];
        }
        this._offset += length * (1 << Float32.Shift);
        return result as Tuple<number, N>;
    }

    /**
     * Read a utf-8 string and advance the offset with 4 byte alignment
     * @param length Length of the string in bytes
     * @returns Utf-8 string
     */
    public getString(length: number): string {
        const bytes = new Uint8Array(this.arrayBuffer, this._offset, length);
        this._offset += length + AlignedDataDeserializer.Padding(length);
        return this._decoder.decode(bytes);
    }

    /**
     * The number of bytes available
     */
    public get bytesAvailable(): number {
        return this.arrayBuffer.byteLength - this._offset;
    }

    /**
     * Compute 4 byte alignment padding
     * @param offset Offset
     * @returns Padding
     */
    public static Padding(offset: number): number {
        return offset % Constants.Alignment === 0 ? 0 : Constants.Alignment - offset % Constants.Alignment;
    }
}
