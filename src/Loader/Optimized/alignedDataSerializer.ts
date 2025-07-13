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
 * Data serializer only for strictly 4 byte aligned binary data
 *
 * Data always serialized in little endian
 */
export class AlignedDataSerializer extends Endianness {
    private readonly _arrayBuffer: ArrayBufferLike;
    private readonly _uint8Ptr: Uint8Array;
    private readonly _uint16Ptr: Uint16Array;
    private readonly _uint32Ptr: Uint32Array;
    private readonly _int32Ptr: Int32Array;
    private readonly _float32Ptr: Float32Array;
    private readonly _encoder: TextEncoder;
    private _offset: number;

    /**
     * Creates Aligned data serializer
     * @param arrayBuffer ArrayBuffer to serialize data
     */
    public constructor(arrayBuffer: ArrayBufferLike) {
        super();
        this._arrayBuffer = arrayBuffer;
        this._uint8Ptr = new Uint8Array(arrayBuffer);
        this._uint16Ptr = new Uint16Array(arrayBuffer);
        this._uint32Ptr = new Uint32Array(arrayBuffer);
        this._int32Ptr = new Int32Array(arrayBuffer);
        this._float32Ptr = new Float32Array(arrayBuffer);
        this._encoder = new TextEncoder();
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
     * Writes a uint8 value
     * @param value Uint8 value to write
     */
    public setUint8(value: number): void {
        this._uint8Ptr[this._offset >> Uint8.Shift] = value;
        this._offset += 1 << Uint8.Shift;
    }

    /**
     * Writes a uint8 array
     * @param values Uint8 array to write
     */
    public setUint8Array(values: ArrayLike<number>): void {
        this._uint8Ptr.set(values, this._offset >> Uint8.Shift);
        this._offset += values.length * (1 << Uint8.Shift);
    }

    /**
     * Writes a uint16 value
     * @param value Uint16 value to write
     */
    public setUint16(value: number): void {
        const uint16Offset = this._offset >> Uint16.Shift;
        this._uint16Ptr[uint16Offset] = value;
        if (!this.isDeviceLittleEndian) this.swap16Array(this._uint16Ptr, uint16Offset, 1);
        this._offset += 1 << Uint16.Shift;
    }

    /**
     * Writes a uint16 array
     * @param values Uint16 array to write
     */
    public setUint16Array(values: ArrayLike<number>): void {
        const uint16Offset = this._offset >> Uint16.Shift;
        this._uint16Ptr.set(values, uint16Offset);
        if (!this.isDeviceLittleEndian) this.swap16Array(this._uint16Ptr, uint16Offset, values.length);
        this._offset += values.length * (1 << Uint16.Shift);
    }

    /**
     * Writes a uint32 value
     * @param value Uint32 value to write
     */
    public setUint32(value: number): void {
        const uint32Offset = this._offset >> Uint32.Shift;
        this._uint32Ptr[uint32Offset] = value;
        if (!this.isDeviceLittleEndian) this.swap32Array(this._uint32Ptr, uint32Offset, 1);
        this._offset += 1 << Uint32.Shift;
    }

    /**
     * Writes a uint32 array
     * @param values Uint32 array to write
     */
    public setUint32Array(values: ArrayLike<number>): void {
        const uint32Offset = this._offset >> Uint32.Shift;
        this._uint32Ptr.set(values, uint32Offset);
        if (!this.isDeviceLittleEndian) this.swap32Array(this._uint32Ptr, uint32Offset, values.length);
        this._offset += values.length * (1 << Uint32.Shift);
    }

    /**
     * Writes a int32 value
     * @param value Int32 value to write
     */
    public setInt32(value: number): void {
        const int32Offset = this._offset >> Int32.Shift;
        this._int32Ptr[int32Offset] = value;
        if (!this.isDeviceLittleEndian) this.swap32Array(this._int32Ptr, int32Offset, 1);
        this._offset += 1 << Int32.Shift;
    }

    /**
     * Writes a int32 array
     * @param values Int32 array to write
     */
    public setInt32Array(values: ArrayLike<number>): void {
        const int32Offset = this._offset >> Int32.Shift;
        this._int32Ptr.set(values, int32Offset);
        if (!this.isDeviceLittleEndian) this.swap32Array(this._int32Ptr, int32Offset, values.length);
        this._offset += values.length * (1 << Int32.Shift);
    }

    /**
     * Writes a float32 value
     * @param value Float32 value to write
     */
    public setFloat32(value: number): void {
        const float32Offset = this._offset >> Float32.Shift;
        this._float32Ptr[float32Offset] = value;
        if (!this.isDeviceLittleEndian) this.swap32Array(this._float32Ptr, float32Offset, 1);
        this._offset += 1 << Float32.Shift;
    }

    /**
     * Writes a float32 array
     * @param values Float32 array to write
     */
    public setFloat32Array(values: ArrayLike<number>): void {
        const float32Offset = this._offset >> Float32.Shift;
        this._float32Ptr.set(values, float32Offset);
        if (!this.isDeviceLittleEndian) this.swap32Array(this._float32Ptr, float32Offset, values.length);
        this._offset += values.length * (1 << Float32.Shift);
    }

    /**
     * Writes a string as UTF-8 with 4 byte alignment padding
     * @param value String to write
     */
    public setString(value: string): void {
        const bytes = this._encoder.encode(value);
        const padding = AlignedDataSerializer.Padding(bytes.length);
        this.setUint32(bytes.length);
        this.setUint8Array(bytes);
        this._offset += padding;
    }

    /**
     * The number of bytes available
     */
    public get bytesAvailable(): number {
        return this._arrayBuffer.byteLength - this._offset;
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
