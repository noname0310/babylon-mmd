type TupleOf<T, N extends number, R extends unknown[]> =
    R["length"] extends N ? R : TupleOf<T, N, [T, ...R]>;

type Tuple<T, N extends number> = N extends N
    ? number extends N ? T[] : TupleOf<T, N, []>
    : never;

export class MmdDataDeserializer {
    private static readonly _LittleEndian = true;

    private readonly _dataView: DataView;
    private _decoder: TextDecoder | null;
    private _offset: number;

    public constructor(arrayBuffer: ArrayBufferLike) {
        this._dataView = new DataView(arrayBuffer);
        this._decoder = null;
        this._offset = 0;
    }

    public get offset(): number {
        return this._offset;
    }

    public set offset(value: number) {
        this._offset = value;
    }

    public getUint8(): number {
        const value = this._dataView.getUint8(this._offset);
        this._offset += 1;
        return value;
    }

    public getInt8(): number {
        const value = this._dataView.getInt8(this._offset);
        this._offset += 1;
        return value;
    }

    public getUint8Array(dest: Uint8Array, length: number): void {
        for (let i = 0; i < length; ++i) {
            dest[i] = this._dataView.getUint8(this._offset);
            this._offset += 1;
        }
    }

    public getUint16(): number {
        const value = this._dataView.getUint16(this._offset, MmdDataDeserializer._LittleEndian);
        this._offset += 2;
        return value;
    }

    public getInt16(): number {
        const value = this._dataView.getInt16(this._offset, MmdDataDeserializer._LittleEndian);
        this._offset += 2;
        return value;
    }

    public getUint32(): number {
        const value = this._dataView.getUint32(this._offset, MmdDataDeserializer._LittleEndian);
        this._offset += 4;
        return value;
    }

    public getUint32Array(dest: Uint32Array, length: number): void {
        for (let i = 0; i < length; ++i) {
            dest[i] = this._dataView.getUint32(this._offset, MmdDataDeserializer._LittleEndian);
            this._offset += 4;
        }
    }

    public getInt32(): number {
        const value = this._dataView.getInt32(this._offset, MmdDataDeserializer._LittleEndian);
        this._offset += 4;
        return value;
    }

    public getFloat32(): number {
        const value = this._dataView.getFloat32(this._offset, MmdDataDeserializer._LittleEndian);
        this._offset += 4;
        return value;
    }

    public getFloat32Array(dest: Float32Array, length: number): void {
        for (let i = 0; i < length; ++i) {
            dest[i] = this._dataView.getFloat32(this._offset, MmdDataDeserializer._LittleEndian);
            this._offset += 4;
        }
    }

    public getFloat32Tuple<N extends number>(length: N): Tuple<number, N> {
        const result = new Array<number>(length);
        for (let i = 0; i < length; ++i) {
            result[i] = this._dataView.getFloat32(this._offset, MmdDataDeserializer._LittleEndian);
            this._offset += 4;
        }
        return result as Tuple<number, N>;
    }

    public initializeTextDecoder(encoding: string): void {
        this._decoder = new TextDecoder(encoding);
    }

    public getDecoderString(length: number, trim: boolean): string {
        if (this._decoder === null) {
            throw new Error("TextDecoder is not initialized.");
        }

        let bytes = new Uint8Array(this._dataView.buffer, this._offset, length);
        this._offset += length;

        if (trim) {
            for (let i = 0; i < bytes.length; ++i) {
                if (bytes[i] === 0) {
                    bytes = bytes.subarray(0, i);
                    break;
                }
            }
        }

        return this._decoder.decode(bytes);
    }

    public getSignatureString(length: number): string {
        const decoder = new TextDecoder("utf-8");
        const bytes = new Uint8Array(this._dataView.buffer, this._offset, length);
        this._offset += length;

        return decoder.decode(bytes);
    }

    public get bytesAvailable(): number {
        return this._dataView.byteLength - this._offset;
    }
}
