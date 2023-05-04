type TupleOf<T, N extends number, R extends unknown[]> =
    R['length'] extends N ? R : TupleOf<T, N, [T, ...R]>;

type Tuple<T, N extends number> = N extends N 
    ? number extends N ? T[] : TupleOf<T, N, []>
    : never;

export class MmdDataDeserializer {
    private static readonly _littleEndian = true;

    private readonly _dataView: DataView;
    private readonly _decoder: TextDecoder;
    private _offset: number;

    public constructor(arrayBuffer: ArrayBufferLike) {
        this._dataView = new DataView(arrayBuffer);
        this._decoder = new TextDecoder("shift-jis");
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

    public getUint16(): number {
        const value = this._dataView.getUint16(this._offset, MmdDataDeserializer._littleEndian);
        this._offset += 2;
        return value;
    }

    public getInt16(): number {
        const value = this._dataView.getInt16(this._offset, MmdDataDeserializer._littleEndian);
        this._offset += 2;
        return value;
    }

    public getUint32(): number {
        const value = this._dataView.getUint32(this._offset, MmdDataDeserializer._littleEndian);
        this._offset += 4;
        return value;
    }

    public getFloat32(): number {
        const value = this._dataView.getFloat32(this._offset, MmdDataDeserializer._littleEndian);
        this._offset += 4;
        return value;
    }

    public getFloat32Array<N extends number>(length: N): Tuple<number, N> {
        const result = [];
        for (let i = 0; i < length; i++) {
            result.push(this.getFloat32());
        }
        return result as Tuple<number, N>;
    }

    public getShiftJisString(length: number): string {
        const bytes = new Uint8Array(this._dataView.buffer, this._offset, length);
        this._offset += length;

        return this._decoder.decode(bytes);
    }
}
