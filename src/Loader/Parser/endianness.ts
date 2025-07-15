/**
 * Endianness utility class for serlization/deserialization
 */
export class Endianness {
    /**
     * Whether the device is little endian
     */
    public readonly isDeviceLittleEndian: boolean;

    public constructor() {
        this.isDeviceLittleEndian = this._getIsDeviceLittleEndian();
    }

    private _getIsDeviceLittleEndian(): boolean {
        const array = new Int16Array([256]);
        return new Int8Array(array.buffer)[1] === 1;
    }

    /**
     * Changes the byte order of the array
     * @param array Array to swap
     */
    public swap16Array(
        array: Int16Array | Uint16Array,
        offset: number = 0,
        length: number = array.length
    ): void {
        for (let i = offset; i < length; ++i) {
            const value = array[i];
            array[i] = ((value & 0xFF) << 8) | ((value >> 8) & 0xFF);
        }
    }

    /**
     * Changes the byte order of the array
     * @param array Array to swap
     */
    public swap32Array(
        array: Int32Array | Uint32Array | Float32Array,
        offset: number = 0,
        length: number = array.length
    ): void {
        for (let i = offset; i < length; ++i) {
            const value = array[i];
            array[i] = ((value & 0xFF) << 24) | ((value & 0xFF00) << 8) | ((value >> 8) & 0xFF00) | ((value >> 24) & 0xFF);
        }
    }
}
