import type { ILogger } from "./ILogger";
import { ConsoleLogger } from "./ILogger";
import { MmdDataDeserializer } from "./MmdDataDeserializer";
import type { Vec3, Vec4 } from "./MmdTypes";

export class VmdData {
    private static readonly _Signature = "Vocaloid Motion Data 0002";
    public static readonly SignatureBytes = 30;
    public static readonly ModelNameBytes = 20;

    public static readonly BoneKeyFrameBytes =
        15 + // bone name (uint8[15])
        4 + // frame number (uint32)
        4 * 3 + // position (float32[3])
        4 * 4 + // rotation (float32[4])
        64; // interpolation (int8[64])

    public static readonly MorphKeyFrameBytes =
        15 + // morph name (uint8[15])
        4 + // frame number (uint32)
        4; // weight (float32)

    public static readonly CameraKeyFrameBytes =
        4 + // frame number (uint32)
        4 + // distance (float32)
        4 * 3 + // position (float32[3])
        4 * 3 + // rotation (float32[3])
        24 + // interpolation (int8[24])
        4 + // angle of view (uint32)
        1; // perspective (uint8)

    public static readonly LightKeyFrameBytes =
        4 + // frame number (uint32)
        4 * 3 + // color (float32[3])
        4 * 3; // direction (float32[3])

    public static readonly SelfShadowKeyFrameBytes =
        4 + // frame number (uint32)
        1 + // mode (uint8)
        4; // distance (float32)

    public static readonly PropertyKeyFrameBytes =
        4 + // frame number (uint32)
        1; // visibility (uint8)

    public static readonly PropertyKeyFrameIkStateBytes =
        20 + // bone name (uint8[20])
        1; // ik enabled (uint8)

    public readonly dataDeserializer: MmdDataDeserializer;
    public readonly boneKeyFrameCount: number;
    public readonly morphKeyFrameCount: number;
    public readonly cameraKeyFrameCount: number;
    public readonly lightKeyFrameCount: number;
    public readonly selfShadowKeyFrameCount: number;
    public readonly propertyKeyFrameCount: number;

    private constructor(
        dataDeserializer: MmdDataDeserializer,
        boneKeyFrameCount: number,
        morphKeyFrameCount: number,
        cameraKeyFrameCount: number,
        lightKeyFrameCount: number,
        selfShadowKeyFrameCount: number,
        propertyKeyFrameCount: number
    ) {
        this.dataDeserializer = dataDeserializer;
        this.boneKeyFrameCount = boneKeyFrameCount;
        this.morphKeyFrameCount = morphKeyFrameCount;
        this.cameraKeyFrameCount = cameraKeyFrameCount;
        this.lightKeyFrameCount = lightKeyFrameCount;
        this.selfShadowKeyFrameCount = selfShadowKeyFrameCount;
        this.propertyKeyFrameCount = propertyKeyFrameCount;
    }

    public static CheckedCreate(buffer: ArrayBufferLike, logger: ILogger = new ConsoleLogger()): VmdData | null {
        const dataDeserializer = new MmdDataDeserializer(buffer);
        dataDeserializer.initializeTextDecoder("shift-jis");

        if (dataDeserializer.bytesAvailable < VmdData.SignatureBytes + VmdData.ModelNameBytes) {
            return null;
        }

        const signature = dataDeserializer.getSignatureString(this.SignatureBytes);
        if (signature.substring(0, this._Signature.length) !== this._Signature) {
            return null;
        }
        dataDeserializer.offset += VmdData.ModelNameBytes;

        if (dataDeserializer.bytesAvailable < 4) return null;
        const boneKeyFrameCount = dataDeserializer.getUint32();
        if (dataDeserializer.bytesAvailable < boneKeyFrameCount * VmdData.BoneKeyFrameBytes) return null;
        dataDeserializer.offset += boneKeyFrameCount * VmdData.BoneKeyFrameBytes;

        if (dataDeserializer.bytesAvailable < 4) return null;
        const morphKeyFrameCount = dataDeserializer.getUint32();
        if (dataDeserializer.bytesAvailable < morphKeyFrameCount * VmdData.MorphKeyFrameBytes) return null;
        dataDeserializer.offset += morphKeyFrameCount * VmdData.MorphKeyFrameBytes;

        if (dataDeserializer.bytesAvailable < 4) return null;
        const cameraKeyFrameCount = dataDeserializer.getUint32();
        if (dataDeserializer.bytesAvailable < cameraKeyFrameCount * VmdData.CameraKeyFrameBytes) return null;
        dataDeserializer.offset += cameraKeyFrameCount * VmdData.CameraKeyFrameBytes;

        if (dataDeserializer.bytesAvailable < 4) return null;
        const lightKeyFrameCount = dataDeserializer.getUint32();
        if (dataDeserializer.bytesAvailable < lightKeyFrameCount * VmdData.LightKeyFrameBytes) return null;
        dataDeserializer.offset += lightKeyFrameCount * VmdData.LightKeyFrameBytes;

        if (dataDeserializer.bytesAvailable < 4) return null;
        const selfShadowKeyFrameCount = dataDeserializer.getUint32();
        if (dataDeserializer.bytesAvailable < selfShadowKeyFrameCount * VmdData.SelfShadowKeyFrameBytes) return null;
        dataDeserializer.offset += selfShadowKeyFrameCount * VmdData.SelfShadowKeyFrameBytes;

        if (dataDeserializer.bytesAvailable === 0) {
            // some old VMD files don't have property key frames
            return new VmdData(
                dataDeserializer,
                boneKeyFrameCount,
                morphKeyFrameCount,
                cameraKeyFrameCount,
                lightKeyFrameCount,
                selfShadowKeyFrameCount,
                0
            );
        }

        if (dataDeserializer.bytesAvailable < 4) return null;
        const propertyKeyFrameCount = dataDeserializer.getUint32();
        for (let i = 0; i < propertyKeyFrameCount; ++i) {
            if (dataDeserializer.bytesAvailable < VmdData.PropertyKeyFrameBytes) return null;
            dataDeserializer.offset += VmdData.PropertyKeyFrameBytes;

            if (dataDeserializer.bytesAvailable < 4) return null;
            const propertyKeyFrameIkStateCount = dataDeserializer.getUint32();
            if (dataDeserializer.bytesAvailable < propertyKeyFrameIkStateCount * VmdData.PropertyKeyFrameIkStateBytes) return null;
            dataDeserializer.offset += propertyKeyFrameIkStateCount * VmdData.PropertyKeyFrameIkStateBytes;
        }

        if (dataDeserializer.bytesAvailable > 0) {
            logger.warn(`There are ${dataDeserializer.bytesAvailable} bytes left after parsing`);
        }

        dataDeserializer.offset = 0;

        const vmdData = new VmdData(
            dataDeserializer,
            boneKeyFrameCount,
            morphKeyFrameCount,
            cameraKeyFrameCount,
            lightKeyFrameCount,
            selfShadowKeyFrameCount,
            propertyKeyFrameCount
        );

        return vmdData;
    }
}

export class VmdObject {
    public readonly propertyKeyFrames: readonly VmdObject.PropertyKeyFrame[];

    private readonly _vmdData: VmdData;

    private constructor(vmdData: VmdData, propertyKeyFrames: readonly VmdObject.PropertyKeyFrame[]) {
        this._vmdData = vmdData;
        this.propertyKeyFrames = propertyKeyFrames;
    }

    public static Parse(vmdData: VmdData): VmdObject {
        const dataDeserializer = vmdData.dataDeserializer;

        const propertyKeyFrames: VmdObject.PropertyKeyFrame[] = [];
        dataDeserializer.offset =
            VmdData.SignatureBytes +
            VmdData.ModelNameBytes +
            4 + vmdData.boneKeyFrameCount * VmdData.BoneKeyFrameBytes +
            4 + vmdData.morphKeyFrameCount * VmdData.MorphKeyFrameBytes +
            4 + vmdData.cameraKeyFrameCount * VmdData.CameraKeyFrameBytes +
            4 + vmdData.lightKeyFrameCount * VmdData.LightKeyFrameBytes +
            4 + vmdData.selfShadowKeyFrameCount * VmdData.SelfShadowKeyFrameBytes +
            4;

        const propertyKeyFrameCount = vmdData.propertyKeyFrameCount;
        for (let i = 0; i < propertyKeyFrameCount; ++i) {
            const frameNumber = dataDeserializer.getUint32();
            const visible = dataDeserializer.getUint8() !== 0;

            const ikStateCount = dataDeserializer.getUint32();
            const ikStates: VmdObject.PropertyKeyFrame.IKState[] = [];
            for (let j = 0; j < ikStateCount; j++) {
                const ikName = dataDeserializer.getDecoderString(20, true);
                const ikEnabled = dataDeserializer.getUint8() !== 0;
                ikStates.push([ikName, ikEnabled]);
            }

            const propertyKeyFrame: VmdObject.PropertyKeyFrame = {
                frameNumber,
                visible,
                ikStates
            };
            propertyKeyFrames.push(propertyKeyFrame);
        }

        return new VmdObject(vmdData, propertyKeyFrames);
    }

    public static ParseFromBuffer(buffer: ArrayBufferLike): VmdObject {
        const vmdData = VmdData.CheckedCreate(buffer);
        if (vmdData === null) {
            throw new Error("Invalid VMD data");
        }

        return VmdObject.Parse(vmdData);
    }

    public get boneKeyFrames(): VmdObject.BoneKeyFrames {
        const offset =
            VmdData.SignatureBytes +
            VmdData.ModelNameBytes +
            4;

        return new VmdObject.BoneKeyFrames(
            this._vmdData.dataDeserializer,
            offset,
            this._vmdData.boneKeyFrameCount
        );
    }

    public get morphKeyFrames(): VmdObject.MorphKeyFrames {
        const offset =
            VmdData.SignatureBytes +
            VmdData.ModelNameBytes +
            4 +
            this._vmdData.boneKeyFrameCount * VmdData.BoneKeyFrameBytes +
            4;

        return new VmdObject.MorphKeyFrames(
            this._vmdData.dataDeserializer,
            offset,
            this._vmdData.morphKeyFrameCount
        );
    }

    public get cameraKeyFrames(): VmdObject.CameraKeyFrames {
        const offset =
            VmdData.SignatureBytes +
            VmdData.ModelNameBytes +
            4 +
            this._vmdData.boneKeyFrameCount * VmdData.BoneKeyFrameBytes +
            4 +
            this._vmdData.morphKeyFrameCount * VmdData.MorphKeyFrameBytes +
            4;

        return new VmdObject.CameraKeyFrames(
            this._vmdData.dataDeserializer,
            offset,
            this._vmdData.cameraKeyFrameCount
        );
    }

    public get lightKeyFrames(): VmdObject.LightKeyFrames {
        const offset =
            VmdData.SignatureBytes +
            VmdData.ModelNameBytes +
            4 +
            this._vmdData.boneKeyFrameCount * VmdData.BoneKeyFrameBytes +
            4 +
            this._vmdData.morphKeyFrameCount * VmdData.MorphKeyFrameBytes +
            4 +
            this._vmdData.cameraKeyFrameCount * VmdData.CameraKeyFrameBytes +
            4;

        return new VmdObject.LightKeyFrames(
            this._vmdData.dataDeserializer,
            offset,
            this._vmdData.lightKeyFrameCount
        );
    }

    public get selfShadowKeyFrames(): VmdObject.SelfShadowKeyFrames {
        const offset =
            VmdData.SignatureBytes +
            VmdData.ModelNameBytes +
            4 +
            this._vmdData.boneKeyFrameCount * VmdData.BoneKeyFrameBytes +
            4 +
            this._vmdData.morphKeyFrameCount * VmdData.MorphKeyFrameBytes +
            4 +
            this._vmdData.cameraKeyFrameCount * VmdData.CameraKeyFrameBytes +
            4 +
            this._vmdData.lightKeyFrameCount * VmdData.LightKeyFrameBytes +
            4;

        return new VmdObject.SelfShadowKeyFrames(
            this._vmdData.dataDeserializer,
            offset,
            this._vmdData.selfShadowKeyFrameCount
        );
    }
}

export namespace VmdObject {
    export abstract class BufferArrayReader<T> {
        protected readonly _dataDeserializer: MmdDataDeserializer;
        protected readonly _startOffset: number;
        private readonly _length: number;

        public constructor(
            dataDeserializer: MmdDataDeserializer,
            startOffset: number,
            length: number
        ) {
            this._dataDeserializer = dataDeserializer;
            this._startOffset = startOffset;
            this._length = length;
        }

        public get length(): number {
            return this._length;
        }

        public abstract get(index: number): T;
    }

    export class BoneKeyFrames extends BufferArrayReader<BoneKeyFrame> {
        public constructor(
            dataDeserializer: MmdDataDeserializer,
            startOffset: number,
            length: number
        ) {
            super(dataDeserializer, startOffset, length);
        }

        public get(index: number): BoneKeyFrame {
            const offset = this._startOffset + index * VmdData.BoneKeyFrameBytes;
            return new BoneKeyFrame(this._dataDeserializer, offset);
        }
    }

    export class BoneKeyFrame {
        public readonly boneName: string;
        public readonly frameNumber: number;
        public readonly position: Vec3;
        public readonly rotation: Vec4;
        public readonly interpolation: Uint8Array;

        public constructor(dataDeserializer: MmdDataDeserializer, offset: number) {
            dataDeserializer.offset = offset;

            this.boneName = dataDeserializer.getDecoderString(15, true);
            this.frameNumber = dataDeserializer.getUint32();
            this.position = dataDeserializer.getFloat32Tuple(3);
            this.rotation = dataDeserializer.getFloat32Tuple(4);

            this.interpolation = new Uint8Array(64);
            for (let i = 0; i < 64; ++i) {
                this.interpolation[i] = dataDeserializer.getUint8();
            }
        }
    }

    export class MorphKeyFrames extends BufferArrayReader<MorphKeyFrame> {
        public constructor(
            dataDeserializer: MmdDataDeserializer,
            startOffset: number,
            length: number
        ) {
            super(dataDeserializer, startOffset, length);
        }

        public get(index: number): MorphKeyFrame {
            const offset = this._startOffset + index * VmdData.MorphKeyFrameBytes;
            return new MorphKeyFrame(this._dataDeserializer, offset);
        }
    }

    export class MorphKeyFrame {
        public readonly morphName: string;
        public readonly frameNumber: number;
        public readonly weight: number;

        public constructor(dataDeserializer: MmdDataDeserializer, offset: number) {
            dataDeserializer.offset = offset;

            this.morphName = dataDeserializer.getDecoderString(15, true);
            this.frameNumber = dataDeserializer.getUint32();
            this.weight = dataDeserializer.getFloat32();
        }
    }

    export class CameraKeyFrames extends BufferArrayReader<CameraKeyFrame> {
        public constructor(
            dataDeserializer: MmdDataDeserializer,
            startOffset: number,
            length: number
        ) {
            super(dataDeserializer, startOffset, length);
        }

        public get(index: number): CameraKeyFrame {
            const offset = this._startOffset + index * VmdData.CameraKeyFrameBytes;
            return new CameraKeyFrame(this._dataDeserializer, offset);
        }
    }

    export class CameraKeyFrame {
        public readonly frameNumber: number;
        public readonly distance: number;
        public readonly position: Vec3;
        public readonly rotation: Vec3;
        public readonly interpolation: Uint8Array;
        public readonly fov: number;
        public readonly perspective: boolean;

        public constructor(dataDeserializer: MmdDataDeserializer, offset: number) {
            dataDeserializer.offset = offset;

            this.frameNumber = dataDeserializer.getUint32();
            this.distance = dataDeserializer.getFloat32();
            this.position = dataDeserializer.getFloat32Tuple(3);
            this.rotation = dataDeserializer.getFloat32Tuple(3);

            this.interpolation = new Uint8Array(24);
            for (let i = 0; i < 24; ++i) {
                this.interpolation[i] = dataDeserializer.getUint8();
            }

            this.fov = dataDeserializer.getUint32();
            this.perspective = dataDeserializer.getUint8() !== 0;
        }
    }

    export class LightKeyFrames extends BufferArrayReader<LightKeyFrame> {
        public constructor(
            dataDeserializer: MmdDataDeserializer,
            startOffset: number,
            length: number
        ) {
            super(dataDeserializer, startOffset, length);
        }

        public get(index: number): LightKeyFrame {
            const offset = this._startOffset + index * VmdData.LightKeyFrameBytes;
            return new LightKeyFrame(this._dataDeserializer, offset);
        }
    }

    export class LightKeyFrame {
        public readonly frameNumber: number;
        public readonly color: Vec3;
        public readonly direction: Vec3;

        public constructor(dataDeserializer: MmdDataDeserializer, offset: number) {
            dataDeserializer.offset = offset;

            this.frameNumber = dataDeserializer.getUint32();
            this.color = dataDeserializer.getFloat32Tuple(3);
            this.direction = dataDeserializer.getFloat32Tuple(3);
        }
    }

    export class SelfShadowKeyFrames extends BufferArrayReader<SelfShadowKeyFrame> {
        public constructor(
            dataDeserializer: MmdDataDeserializer,
            startOffset: number,
            length: number
        ) {
            super(dataDeserializer, startOffset, length);
        }

        public get(index: number): SelfShadowKeyFrame {
            const offset = this._startOffset + index * VmdData.SelfShadowKeyFrameBytes;
            return new SelfShadowKeyFrame(this._dataDeserializer, offset);
        }
    }

    export class SelfShadowKeyFrame {
        public readonly frameNumber: number;
        public readonly mode: number;
        public readonly distance: number;

        public constructor(dataDeserializer: MmdDataDeserializer, offset: number) {
            dataDeserializer.offset = offset;

            this.frameNumber = dataDeserializer.getUint32();
            this.mode = dataDeserializer.getUint8();
            this.distance = dataDeserializer.getFloat32();
        }
    }

    export type PropertyKeyFrame = Readonly<{
        frameNumber: number;
        visible: boolean;
        ikStates: readonly PropertyKeyFrame.IKState[];
    }>;

    export namespace PropertyKeyFrame {
        export type IKState = Readonly<[
            string, // bone name
            boolean // ik enabled
        ]>;
    }
}
