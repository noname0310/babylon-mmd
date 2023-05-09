import { MmdDataDeserializer } from "./MmdDataDeserializer";
import { Vec3, Vec4 } from "./MmdTypes";
import { PmxObject } from "./PmxObject";

export class VmdData {
    private static readonly signature = "Vocaloid Motion Data 0002";
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

    public static readonly _propertyKeyFrameBytes =
        4 + // frame number (uint32)
        1; // visibility (uint8)

    public static readonly _propertyKeyFrameIkStateBytes =
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
        dataDeserializer.initializeTextDecoder(PmxObject.Header.Encoding.utf16le);

        if (dataDeserializer.bytesAvailable < VmdData.signatureBytes + VmdData.modelNameBytes) {
            return null;
        }

        const signature = dataDeserializer.getSignatureString(this.signatureBytes);
        console.log(signature, VmdData.signature);
        if (signature !== VmdData.signature) {
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
            if (dataDeserializer.bytesAvailable < VmdData._propertyKeyFrameBytes) return null;
            dataDeserializer.offset += VmdData._propertyKeyFrameBytes;

            if (dataDeserializer.bytesAvailable < 4) return null;
            const propertyKeyFrameIkStateCount = dataDeserializer.getUint32();
            if (dataDeserializer.bytesAvailable < propertyKeyFrameIkStateCount * VmdData._propertyKeyFrameIkStateBytes) return null;
            dataDeserializer.offset += propertyKeyFrameIkStateCount * VmdData._propertyKeyFrameIkStateBytes;
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
                const ikName = dataDeserializer.getDecoderString(20);
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

    public static parseFromBuffer(buffer: ArrayBufferLike): VmdObject | null {
        const vmdData = VmdData.checkedCreate(buffer);
        if (vmdData === null) {
            throw new Error('Invalid VMD data');
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
};

export namespace VmdObject {
    export class BoneKeyFrames {
        private _dataDeserializer: MmdDataDeserializer;
        private _startOffset: number;
        private _length: number;

        public constructor(
            dataDeserializer: MmdDataDeserializer,
            startOffset: number,
            length: number
        ) {
            this._dataDeserializer = dataDeserializer;
            this._startOffset = startOffset;
            this._length = length;
        }

        public get length() {
            return this._length;
        }

        public get(index: number): BoneKeyFrame {
            const offset = this._startOffset + index * VmdData.boneKeyFrameBytes;
            return new BoneKeyFrame(this._dataDeserializer, offset);
        }
    }

    export class BoneKeyFrame {
        boneName: string;
        frameNumber: number;
        position: Vec3;
        rotation: Vec4;
        interpolation: Int8Array;

        public constructor(dataDeserializer: MmdDataDeserializer, offset: number) {
            dataDeserializer.offset = offset;

            this.boneName = dataDeserializer.getDecoderString(15);
            this.frameNumber = dataDeserializer.getUint32();
            this.position = dataDeserializer.getFloat32Array(3);
            this.rotation = dataDeserializer.getFloat32Array(4);
            
            const interpolationBuffer = new ArrayBuffer(64);
            this.interpolation = new Int8Array(interpolationBuffer);
            for (let i = 0; i < 64; i++) {
                this.interpolation[i] = dataDeserializer.getInt8();
            }
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
