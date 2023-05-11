import { MmdDataDeserializer } from "./MmdDataDeserializer";
import type { Vec3, Vec4 } from "./MmdTypes";

export class VmdData {
    private static readonly _signature = "Vocaloid Motion Data 0002";
    public static readonly signatureBytes = 30;
    public static readonly modelNameBytes = 20;

    public static readonly boneKeyFrameBytes =
        15 + // bone name (uint8[15])
        4 + // frame number (uint32)
        4 * 3 + // position (float32[3])
        4 * 4 + // rotation (float32[4])
        64; // interpolation (int8[64])

    public static readonly morphKeyFrameBytes =
        15 + // morph name (uint8[15])
        4 + // frame number (uint32)
        4; // weight (float32)

    public static readonly cameraKeyFrameBytes =
        4 + // frame number (uint32)
        4 + // distance (float32)
        4 * 3 + // position (float32[3])
        4 * 3 + // rotation (float32[3])
        24 + // interpolation (int8[24])
        4 + // angle of view (uint32)
        1; // perspective (uint8)

    public static readonly lightKeyFrameBytes =
        4 + // frame number (uint32)
        4 * 3 + // color (float32[3])
        4 * 3; // direction (float32[3])

    public static readonly selfShadowKeyFrameBytes =
        4 + // frame number (uint32)
        1 + // mode (uint8)
        4; // distance (float32)

    public static readonly propertyKeyFrameBytes =
        4 + // frame number (uint32)
        1; // visibility (uint8)

    public static readonly propertyKeyFrameIkStateBytes =
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

    public static checkedCreate(buffer: ArrayBufferLike): VmdData | null {
        const dataDeserializer = new MmdDataDeserializer(buffer);
        dataDeserializer.initializeTextDecoder("shift-jis");

        if (dataDeserializer.bytesAvailable < VmdData.signatureBytes + VmdData.modelNameBytes) {
            return null;
        }

        const signature = dataDeserializer.getSignatureString(this.signatureBytes);
        if (signature.substring(0, this._signature.length) !== this._signature) {
            return null;
        }
        dataDeserializer.offset += VmdData.modelNameBytes;

        if (dataDeserializer.bytesAvailable < 4) return null;
        const boneKeyFrameCount = dataDeserializer.getUint32();
        if (dataDeserializer.bytesAvailable < boneKeyFrameCount * VmdData.boneKeyFrameBytes) return null;
        dataDeserializer.offset += boneKeyFrameCount * VmdData.boneKeyFrameBytes;

        if (dataDeserializer.bytesAvailable < 4) return null;
        const morphKeyFrameCount = dataDeserializer.getUint32();
        if (dataDeserializer.bytesAvailable < morphKeyFrameCount * VmdData.morphKeyFrameBytes) return null;
        dataDeserializer.offset += morphKeyFrameCount * VmdData.morphKeyFrameBytes;

        if (dataDeserializer.bytesAvailable < 4) return null;
        const cameraKeyFrameCount = dataDeserializer.getUint32();
        if (dataDeserializer.bytesAvailable < cameraKeyFrameCount * VmdData.cameraKeyFrameBytes) return null;
        dataDeserializer.offset += cameraKeyFrameCount * VmdData.cameraKeyFrameBytes;

        if (dataDeserializer.bytesAvailable < 4) return null;
        const lightKeyFrameCount = dataDeserializer.getUint32();
        if (dataDeserializer.bytesAvailable < lightKeyFrameCount * VmdData.lightKeyFrameBytes) return null;
        dataDeserializer.offset += lightKeyFrameCount * VmdData.lightKeyFrameBytes;

        if (dataDeserializer.bytesAvailable < 4) return null;
        const selfShadowKeyFrameCount = dataDeserializer.getUint32();
        if (dataDeserializer.bytesAvailable < selfShadowKeyFrameCount * VmdData.selfShadowKeyFrameBytes) return null;
        dataDeserializer.offset += selfShadowKeyFrameCount * VmdData.selfShadowKeyFrameBytes;

        if (dataDeserializer.bytesAvailable < 4) return null;
        const propertyKeyFrameCount = dataDeserializer.getUint32();
        for (let i = 0; i < propertyKeyFrameCount; i++) {
            if (dataDeserializer.bytesAvailable < VmdData.propertyKeyFrameBytes) return null;
            dataDeserializer.offset += VmdData.propertyKeyFrameBytes;

            if (dataDeserializer.bytesAvailable < 4) return null;
            const propertyKeyFrameIkStateCount = dataDeserializer.getUint32();
            if (dataDeserializer.bytesAvailable < propertyKeyFrameIkStateCount * VmdData.propertyKeyFrameIkStateBytes) return null;
            dataDeserializer.offset += propertyKeyFrameIkStateCount * VmdData.propertyKeyFrameIkStateBytes;
        }

        if (dataDeserializer.bytesAvailable > 0) {
            console.warn(`There are ${dataDeserializer.bytesAvailable} bytes left after parsing`);
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

    public static parse(vmdData: VmdData): VmdObject {
        const dataDeserializer = vmdData.dataDeserializer;

        const propertyKeyFrames: VmdObject.PropertyKeyFrame[] = [];
        dataDeserializer.offset =
            VmdData.signatureBytes +
            VmdData.modelNameBytes +
            vmdData.boneKeyFrameCount * VmdData.boneKeyFrameBytes +
            vmdData.morphKeyFrameCount * VmdData.morphKeyFrameBytes +
            vmdData.cameraKeyFrameCount * VmdData.cameraKeyFrameBytes +
            vmdData.lightKeyFrameCount * VmdData.lightKeyFrameBytes +
            vmdData.selfShadowKeyFrameCount * VmdData.selfShadowKeyFrameBytes +
            4;

        const propertyKeyFrameCount = vmdData.propertyKeyFrameCount;
        for (let i = 0; i < propertyKeyFrameCount; i++) {
            const frameNumber = dataDeserializer.getUint32();
            const visable = dataDeserializer.getUint8() !== 0;

            const ikStateCount = dataDeserializer.getUint32();
            const ikStates: VmdObject.PropertyKeyFrame.IKState[] = [];
            for (let j = 0; j < ikStateCount; j++) {
                const ikName = dataDeserializer.getDecoderString(20, true);
                const ikEnabled = dataDeserializer.getUint8() !== 0;
                ikStates.push([ikName, ikEnabled]);
            }

            const propertyKeyFrame: VmdObject.PropertyKeyFrame = {
                frameNumber,
                visable,
                ikStates
            };
            propertyKeyFrames.push(propertyKeyFrame);
        }

        return new VmdObject(vmdData, propertyKeyFrames);
    }

    public static parseFromBuffer(buffer: ArrayBufferLike): VmdObject {
        const vmdData = VmdData.checkedCreate(buffer);
        if (vmdData === null) {
            throw new Error("Invalid VMD data");
        }

        return VmdObject.parse(vmdData);
    }

    public get boneKeyFrames(): VmdObject.BoneKeyFrames {
        const offset =
            VmdData.signatureBytes +
            VmdData.modelNameBytes +
            4;

        return new VmdObject.BoneKeyFrames(
            this._vmdData.dataDeserializer,
            offset,
            this._vmdData.boneKeyFrameCount
        );
    }

    public get morphKeyFrames(): VmdObject.MorphKeyFrames {
        const offset =
            VmdData.signatureBytes +
            VmdData.modelNameBytes +
            4 +
            this._vmdData.boneKeyFrameCount * VmdData.boneKeyFrameBytes +
            4;

        return new VmdObject.MorphKeyFrames(
            this._vmdData.dataDeserializer,
            offset,
            this._vmdData.morphKeyFrameCount
        );
    }

    public get cameraKeyFrames(): VmdObject.CameraKeyFrames {
        const offset =
            VmdData.signatureBytes +
            VmdData.modelNameBytes +
            4 +
            this._vmdData.boneKeyFrameCount * VmdData.boneKeyFrameBytes +
            4 +
            this._vmdData.morphKeyFrameCount * VmdData.morphKeyFrameBytes +
            4;

        return new VmdObject.CameraKeyFrames(
            this._vmdData.dataDeserializer,
            offset,
            this._vmdData.cameraKeyFrameCount
        );
    }

    public get lightKeyFrames(): VmdObject.LightKeyFrames {
        const offset =
            VmdData.signatureBytes +
            VmdData.modelNameBytes +
            4 +
            this._vmdData.boneKeyFrameCount * VmdData.boneKeyFrameBytes +
            4 +
            this._vmdData.morphKeyFrameCount * VmdData.morphKeyFrameBytes +
            4 +
            this._vmdData.cameraKeyFrameCount * VmdData.cameraKeyFrameBytes +
            4;

        return new VmdObject.LightKeyFrames(
            this._vmdData.dataDeserializer,
            offset,
            this._vmdData.lightKeyFrameCount
        );
    }

    public get selfShadowKeyFrames(): VmdObject.SelfShadowKeyFrames {
        const offset =
            VmdData.signatureBytes +
            VmdData.modelNameBytes +
            4 +
            this._vmdData.boneKeyFrameCount * VmdData.boneKeyFrameBytes +
            4 +
            this._vmdData.morphKeyFrameCount * VmdData.morphKeyFrameBytes +
            4 +
            this._vmdData.cameraKeyFrameCount * VmdData.cameraKeyFrameBytes +
            4 +
            this._vmdData.lightKeyFrameCount * VmdData.lightKeyFrameBytes +
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
            const offset = this._startOffset + index * VmdData.boneKeyFrameBytes;
            return new BoneKeyFrame(this._dataDeserializer, offset);
        }
    }

    export class BoneKeyFrame {
        public readonly boneName: string;
        public readonly frameNumber: number;
        public readonly position: Vec3;
        public readonly rotation: Vec4;
        public readonly interpolation: Int8Array;

        public constructor(dataDeserializer: MmdDataDeserializer, offset: number) {
            dataDeserializer.offset = offset;

            this.boneName = dataDeserializer.getDecoderString(15, true);
            this.frameNumber = dataDeserializer.getUint32();
            this.position = dataDeserializer.getFloat32Array(3);
            this.rotation = dataDeserializer.getFloat32Array(4);

            this.interpolation = new Int8Array(64);
            for (let i = 0; i < 64; i++) {
                this.interpolation[i] = dataDeserializer.getInt8();
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
            const offset = this._startOffset + index * VmdData.morphKeyFrameBytes;
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
            const offset = this._startOffset + index * VmdData.cameraKeyFrameBytes;
            return new CameraKeyFrame(this._dataDeserializer, offset);
        }
    }

    export class CameraKeyFrame {
        public readonly frameNumber: number;
        public readonly distance: number;
        public readonly position: Vec3;
        public readonly rotation: Vec3;
        public readonly interpolation: Int8Array;
        public readonly fov: number;
        public readonly perspective: boolean;

        public constructor(dataDeserializer: MmdDataDeserializer, offset: number) {
            dataDeserializer.offset = offset;

            this.frameNumber = dataDeserializer.getUint32();
            this.distance = dataDeserializer.getFloat32();
            this.position = dataDeserializer.getFloat32Array(3);
            this.rotation = dataDeserializer.getFloat32Array(3);

            this.interpolation = new Int8Array(24);
            for (let i = 0; i < 24; i++) {
                this.interpolation[i] = dataDeserializer.getInt8();
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
            const offset = this._startOffset + index * VmdData.lightKeyFrameBytes;
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
            this.color = dataDeserializer.getFloat32Array(3);
            this.direction = dataDeserializer.getFloat32Array(3);
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
            const offset = this._startOffset + index * VmdData.selfShadowKeyFrameBytes;
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
        visable: boolean;
        ikStates: readonly PropertyKeyFrame.IKState[];
    }>;

    export namespace PropertyKeyFrame {
        export type IKState = Readonly<[
            string, // bone name
            boolean // ik enabled
        ]>;
    }
}
