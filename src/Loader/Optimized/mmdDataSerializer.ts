/**
 * DataView wrapper for serializing MMD data
 */
export class MmdDataSerializer {
    private readonly _dataView: DataView;
    private readonly _encoder: TextEncoder;
    private _offset: number;

    /**
     * Creates MMD data serializer
     * @param arrayBuffer ArrayBuffer to serialize
     */
    public constructor(arrayBuffer: ArrayBufferLike) {
        this._dataView = new DataView(arrayBuffer);
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
        this._dataView.setUint8(this._offset, value);
        this._offset += 1;
    }

    /**
     * Writes a uint8 array
     * @param values Uint8 array to write
     */
    public setUint8Array(values: ArrayLike<number>): void {
        const dataView = this._dataView;
        for (let i = 0; i < values.length; ++i) {
            dataView.setUint8(this._offset, values[i]);
            this._offset += 1;
        }
    }

    /**
     * Writes a int8 value
     * @param value Int8 value to write
     */
    public setInt8(value: number): void {
        this._dataView.setInt8(this._offset, value);
        this._offset += 1;
    }

    /**
     * Writes a int8 array
     * @param values Int8 array to write
     */
    public setInt8Array(values: ArrayLike<number>): void {
        const dataView = this._dataView;
        for (let i = 0; i < values.length; ++i) {
            dataView.setInt8(this._offset, values[i]);
            this._offset += 1;
        }
    }

    /**
     * Writes a uint16 value
     * @param value Uint16 value to write
     */
    public setUint16(value: number): void {
        this._dataView.setUint16(this._offset, value, true);
        this._offset += 2;
    }

    /**
     * Writes a uint16 array
     * @param values Uint16 array to write
     */
    public setUint16Array(values: ArrayLike<number>): void {
        const dataView = this._dataView;
        for (let i = 0; i < values.length; ++i) {
            dataView.setUint16(this._offset, values[i], true);
            this._offset += 2;
        }
    }

    /**
     * Writes a uint32 value
     * @param value Uint32 value to write
     */
    public setUint32(value: number): void {
        this._dataView.setUint32(this._offset, value, true);
        this._offset += 4;
    }

    /**
     * Writes a uint32 array
     * @param values Uint32 array to write
     */
    public setUint32Array(values: ArrayLike<number>): void {
        const dataView = this._dataView;
        for (let i = 0; i < values.length; ++i) {
            dataView.setUint32(this._offset, values[i], true);
            this._offset += 4;
        }
    }

    /**
     * Writes a int32 value
     * @param value Int32 value to write
     */
    public setInt32(value: number): void {
        this._dataView.setInt32(this._offset, value, true);
        this._offset += 4;
    }

    /**
     * Writes a int32 array
     * @param values Int32 array to write
     */
    public setInt32Array(values: ArrayLike<number>): void {
        const dataView = this._dataView;
        for (let i = 0; i < values.length; ++i) {
            dataView.setInt32(this._offset, values[i], true);
            this._offset += 4;
        }
    }

    /**
     * Writes a float32 value
     * @param value Float32 value to write
     */
    public setFloat32(value: number): void {
        this._dataView.setFloat32(this._offset, value, true);
        this._offset += 4;
    }

    /**
     * Writes a float32 array
     * @param values Float32 array to write
     */
    public setFloat32Array(values: ArrayLike<number>): void {
        const dataView = this._dataView;
        for (let i = 0; i < values.length; ++i) {
            dataView.setFloat32(this._offset, values[i], true);
            this._offset += 4;
        }
    }

    /**
     * Writes a string as UTF-8
     * @param value String to write
     */
    public setString(value: string): void {
        const dataView = this._dataView;
        const bytes = this._encoder.encode(value);
        dataView.setUint32(this._offset, bytes.length, true);
        this._offset += 4;
        for (let i = 0; i < bytes.length; ++i) {
            dataView.setUint8(this._offset, bytes[i]);
            this._offset += 1;
        }
    }

    /**
     * The number of bytes available
     */
    public get bytesAvailable(): number {
        return this._dataView.byteLength - this._offset;
    }

    /**
     * Compute byte alignment padding
     * @param offset Offset
     * @param elementSize Element size
     * @returns Padding
     */
    public static Padding(offset: number, elementSize: number): number {
        return offset % elementSize === 0 ? 0 : elementSize - offset % elementSize;
    }
}
