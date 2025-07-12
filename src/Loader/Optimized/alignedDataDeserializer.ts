import { Endianness } from "../Parser/endianness";

const enum Constants {
    Alignment = 4
}

const enum Uint8 {
    Shift = 0
}

// const enum Uint16 {
//     Shift = 1
// }

const enum Uint32 {
    Shift = 2
}

// const enum Int32 {
//     Shift = 2
// }

// const enum Float32 {
//     Shift = 2
// }

/**
 * Data deserializer only for strictly 4 byte aligned binary data
 *
 * Data assumed to be serialized in little endian
 */
export class AlignedDataDeserializer extends Endianness {
    public readonly arrayBuffer: ArrayBufferLike;
    private readonly _uint8Ptr: Uint8Array;
    private readonly _uint32Ptr: Uint32Array;
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
        this._uint32Ptr = new Uint32Array(arrayBuffer);
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
     * Read a uint32 value
     * @returns Uunt32 value
     */
    public getUint32(): number {
        const value = this._uint32Ptr[this._offset >> Uint32.Shift];
        this._offset += 1 << Uint32.Shift;
        return value;
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
