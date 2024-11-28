import { AbstractEngine } from "@babylonjs/core/Engines/abstractEngine";
import type { InternalTexture } from "@babylonjs/core/Materials/Textures/internalTexture";
import type { IInternalTextureLoader } from "@babylonjs/core/Materials/Textures/Loaders/internalTextureLoader";

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
        const onload = (img: HTMLImageElement | ImageBitmap): void => {
            const done = (): void => { };

            callback(
                img.width,
                img.height,
                false,
                false,
                done
            );

            done();
        };

        data;
        texture;
        onload;
        AbstractEngine;
        // According to the WebGL spec section 6.10, ImageBitmaps must be inverted on creation.
        // So, we pass imageOrientation to _FileToolsLoadImage() as it may create an ImageBitmap.

        // AbstractEngine._FileToolsLoadImage(
        //     data,
        //     onload,
        //     () => {

        //     }
        //     scene ? scene.offlineProvider : null,
        //     mimeType,
        //     texture.invertY && this._features.needsInvertingBitmap ? { imageOrientation: "flipY" } : undefined
        // );
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
