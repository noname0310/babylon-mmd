import { AbstractEngine } from "@babylonjs/core/Engines/abstractEngine";
import type { InternalTexture } from "@babylonjs/core/Materials/Textures/internalTexture";
import type { IInternalTextureLoader } from "@babylonjs/core/Materials/Textures/Loaders/internalTextureLoader";
import type { Nullable } from "@babylonjs/core/types";

const enum BmpConstants {
    MagicNumber = 0x4D42,

    MagicNumberOffset = 0x00,
    FileSizeOffset = 0x02,
    OffsetToImageDataOffset = 0x0A,
    SizeOfBitmapInfoHeaderOffset = 0x0E,
    BitsPerPixelOffset = 0x1C,
    CompressionOffset = 0x1E,
    RedMaskOffset = 0x36,

    BITMAPINFOHEADERSize = 0x28,
    AppendHeaderSize = 0x44,
}

/**
 * Implementation of the .bmp texture loader that handle alpha for BITMAPINFOHEADER like DirectX9 behavior.
 * @internal
 */
export class _DxBmpTextureLoader implements IInternalTextureLoader {
    /**
     * Defines whether the loader supports cascade loading the different faces.
     */
    public readonly supportCascades = false;

    /**
     * Uploads the cube texture data to the WebGL texture. It has already been bound.
     */
    public loadCubeData(): void {
        throw ".dxbmp not supported in Cube";
    }

    private static readonly _HeaderExtension = new Uint8Array([
        0x00, 0x00, 0xFF, 0x00, // Red mask 0x00FF0000 (16711680)
        0x00, 0xFF, 0x00, 0x00, // Green mask 0x0000FF00 (65280)
        0xFF, 0x00, 0x00, 0x00, // Blue mask 0x00FF0000 (355)
        0x00, 0x00, 0x00, 0xFF, // Alpha mask 0xFF000000 (4278190080)
        0x00, 0x00, 0x00, 0x00, // Color space type (0x00000000) LCS_CALIBRATED_RGB
        0x00, 0x00, 0x00, 0x00, // Endpoints (ciexyzRed.ciexyzX)
        0x00, 0x00, 0x00, 0x00, // Endpoints (ciexyzRed.ciexyzY)
        0x00, 0x00, 0x00, 0x00, // Endpoints (ciexyzRed.ciexyzZ)
        0x00, 0x00, 0x00, 0x00, // Endpoints (ciexyzGreen.ciexyzX)
        0x00, 0x00, 0x00, 0x00, // Endpoints (ciexyzGreen.ciexyzY)
        0x00, 0x00, 0x00, 0x00, // Endpoints (ciexyzGreen.ciexyzZ)
        0x00, 0x00, 0x00, 0x00, // Endpoints (ciexyzBlue.ciexyzX)
        0x00, 0x00, 0x00, 0x00, // Endpoints (ciexyzBlue.ciexyzY)
        0x00, 0x00, 0x00, 0x00, // Endpoints (ciexyzBlue.ciexyzZ)
        0x00, 0x00, 0x00, 0x00, // Gamma red 0x00000000 (0)
        0x00, 0x00, 0x00, 0x00, // Gamma green 0x00000000 (0)
        0x00, 0x00, 0x00, 0x00 // Gamma blue 0x00000000 (0)
    ]);

    private _injectHeader(data: ArrayBufferView): ArrayBufferView {
        const dataView = new DataView(data.buffer, data.byteOffset, data.byteLength);

        if (dataView.getUint16(BmpConstants.MagicNumberOffset, true) !== BmpConstants.MagicNumber) {
            return data;
        }

        const headerSize = dataView.getUint32(BmpConstants.SizeOfBitmapInfoHeaderOffset, true);
        if (headerSize !== BmpConstants.BITMAPINFOHEADERSize) {
            return data;
        }

        const bitsPerPixel = dataView.getUint16(BmpConstants.BitsPerPixelOffset, true);
        if (bitsPerPixel !== 32) {
            return data;
        }

        const compression = dataView.getUint32(BmpConstants.CompressionOffset, true);
        if (compression !== 0) {
            return data;
        }

        const copiedData = new Uint8Array(data.byteLength + BmpConstants.AppendHeaderSize);
        copiedData.set(new Uint8Array(data.buffer, data.byteOffset, BmpConstants.RedMaskOffset), 0);
        copiedData.set(new Uint8Array(data.buffer, data.byteOffset + BmpConstants.RedMaskOffset, data.byteLength - BmpConstants.RedMaskOffset), BmpConstants.RedMaskOffset + BmpConstants.AppendHeaderSize);
        const copiedDataView = new DataView(copiedData.buffer, copiedData.byteOffset, copiedData.byteLength);

        const fileSize = copiedDataView.getUint32(BmpConstants.FileSizeOffset, true);
        copiedDataView.setUint32(BmpConstants.FileSizeOffset, fileSize + BmpConstants.AppendHeaderSize, true);

        const offsetToImageData = copiedDataView.getUint32(BmpConstants.OffsetToImageDataOffset, true);
        copiedDataView.setUint32(BmpConstants.OffsetToImageDataOffset, offsetToImageData + BmpConstants.AppendHeaderSize, true);
        copiedDataView.setUint32(BmpConstants.SizeOfBitmapInfoHeaderOffset, BmpConstants.BITMAPINFOHEADERSize + BmpConstants.AppendHeaderSize, true);
        copiedDataView.setUint32(BmpConstants.CompressionOffset, 3, true);

        copiedData.set(_DxBmpTextureLoader._HeaderExtension, BmpConstants.RedMaskOffset);

        return copiedData;
    }

    private _workingCanvas: Nullable<HTMLCanvasElement> = null;
    private _workingContext: Nullable<CanvasRenderingContext2D> = null;

    private _prepareTextureProcess(texture: InternalTexture, img: HTMLImageElement | ImageBitmap): void {
        const engine = texture.getEngine();

        if (!this._workingCanvas) {
            this._workingCanvas = document.createElement("canvas");
            this._workingContext = this._workingCanvas.getContext("2d");
            if (!this._workingContext) {
                throw new Error("Unable to get 2d context");
            }
        }
        const canvas = this._workingCanvas;
        const context = this._workingContext!;

        canvas.width = img.width;
        canvas.height = img.height;
        context.drawImage(img, 0, 0);
        const imgData = context.getImageData(0, 0, img.width, img.height);
        const data = imgData.data;

        engine._uploadDataToTextureDirectly(texture, data);
    }

    /**
     * Uploads the 2D texture data to the WebGL texture. It has already been bound once in the callback.
     * @param data contains the texture data
     * @param texture defines the BabylonJS internal texture
     * @param callback defines the method to call once ready to upload
     */
    public loadData(
        data: ArrayBufferView,
        texture: InternalTexture,
        callback: (width: number, height: number, loadMipmap: boolean, isCompressed: boolean, done: () => void, loadFailed?: boolean, options?: any) => void
    ): void {
        const onLoad = (img: HTMLImageElement | ImageBitmap): void => {
            callback(
                img.width,
                img.height,
                true,
                false,
                (): void => this._prepareTextureProcess(texture, img)
            );
        };

        const onError = (_message?: string, _exception?: any): void => {
            callback(
                1,
                1,
                false,
                false,
                (): void => { },
                true
            );
        };

        const fixedData = this._injectHeader(data);

        const engine = texture.getEngine();
        AbstractEngine._FileToolsLoadImage(
            fixedData,
            onLoad,
            onError,
            null,
            undefined,
            texture.invertY && engine._features.needsInvertingBitmap ? { imageOrientation: "flipY" } : undefined
        );
    }
}

// problem case

// if DIB header is BITMAPINFOHEADER and Bits per pixel is 32 and Compression is 0, then insert v4 header (BITMAPV4HEADER)

// 42 4d // Signature (BM)
// 36 00 01 00 // File size 0x00010036 (65590)                // need recalculate (65590 + 68 = 65658) 0x0001007A  7A 00 01 00
// 00 00 // Reserved
// 00 00 // Reserved
// 36 00 00 00 // Offset to image data 0x00000036 (54)        // need recalculate (54 + 68 = 122) 0x0000007A  7A 00 00 00
// 28 00 00 00 // Size of BITMAPINFOHEADER 0x00000028 (40)    // need recalculate (40 + 68 = 108) 0x0000006C  6C 00 00 00
// 80 00 00 00 // Width 0x00000080 (128)
// 80 00 00 00 // Height 0x00000080 (128)
// 01 00 // Planes 0x0001 (1)
// 20 00 // Bits per pixel 0x0020 (32)
// 00 00 00 00 // Compression 0x00000000 (0)                  // need recalculate (3) 0x00000003  03 00 00 00
// 00 00 00 00 // Image size 0x00000000 (0)
// c4 0e 00 00 // Horizontal resolution 0x00000ec4 (3780)
// c4 0e 00 00 // Vertical resolution 0x00000ec4 (3780)
// 00 00 00 00 // Colors used 0x00000000 (0)
// 00 00 00 00 // Colors important 0x00000000 (0)

// 00 00 FF 00 // Red mask 0x00FF0000 (16711680)
// 00 FF 00 00 // Green mask 0x0000FF00 (65280)
// FF 00 00 00 // Blue mask 0x00FF0000 (355)
// 00 00 00 FF // Alpha mask 0xFF000000 (4278190080)
// 00 00 00 00 // Color space type (0x00000000) LCS_CALIBRATED_RGB
// 00 00 00 00 // Endpoints (ciexyzRed.ciexyzX)
// 00 00 00 00 // Endpoints (ciexyzRed.ciexyzY)
// 00 00 00 00 // Endpoints (ciexyzRed.ciexyzZ)
// 00 00 00 00 // Endpoints (ciexyzGreen.ciexyzX)
// 00 00 00 00 // Endpoints (ciexyzGreen.ciexyzY)
// 00 00 00 00 // Endpoints (ciexyzGreen.ciexyzZ)
// 00 00 00 00 // Endpoints (ciexyzBlue.ciexyzX)
// 00 00 00 00 // Endpoints (ciexyzBlue.ciexyzY)
// 00 00 00 00 // Endpoints (ciexyzBlue.ciexyzZ)
// 00 00 00 00 // Gamma red 0x00000000 (0)
// 00 00 00 00 // Gamma green 0x00000000 (0)
// 00 00 00 00 // Gamma blue 0x00000000 (0)
