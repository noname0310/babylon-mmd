export class MmdDataSerializer {
    private static readonly _LittleEndian = true;

    private readonly _dataView: DataView;
    private readonly _encoder: TextEncoder;
    private _offset: number;

    public constructor(arrayBuffer: ArrayBufferLike) {
        this._dataView = new DataView(arrayBuffer);
        this._encoder = new TextEncoder();
        this._offset = 0;
    }

    public get offset(): number {
        return this._offset;
    }

    public set offset(value: number) {
        this._offset = value;
    }

    public setUint8Array(values: ArrayLike<number>): void {
        const dataView = this._dataView;
        for (let i = 0; i < values.length; ++i) {
            dataView.setUint8(this._offset, values[i]);
            this._offset += 1;
        }
    }

    public setInt8Array(values: ArrayLike<number>): void {
        const dataView = this._dataView;
        for (let i = 0; i < values.length; ++i) {
            dataView.setInt8(this._offset, values[i]);
            this._offset += 1;
        }
    }

    public setUint32(value: number): void {
        this._dataView.setUint32(this._offset, value, MmdDataSerializer._LittleEndian);
        this._offset += 4;
    }

    public setUint32Array(values: ArrayLike<number>): void {
        const dataView = this._dataView;
        for (let i = 0; i < values.length; ++i) {
            dataView.setUint32(this._offset, values[i], MmdDataSerializer._LittleEndian);
            this._offset += 4;
        }
    }

    public setFloat32Array(values: ArrayLike<number>): void {
        const dataView = this._dataView;
        for (let i = 0; i < values.length; ++i) {
            dataView.setFloat32(this._offset, values[i], MmdDataSerializer._LittleEndian);
            this._offset += 4;
        }
    }

    public setString(value: string): void {
        const dataView = this._dataView;
        const bytes = this._encoder.encode(value);
        dataView.setUint32(this._offset, bytes.length, MmdDataSerializer._LittleEndian);
        this._offset += 4;
        for (let i = 0; i < bytes.length; ++i) {
            dataView.setUint8(this._offset, bytes[i]);
            this._offset += 1;
        }
    }

    public get bytesAvailable(): number {
        return this._dataView.byteLength - this._offset;
    }
}
