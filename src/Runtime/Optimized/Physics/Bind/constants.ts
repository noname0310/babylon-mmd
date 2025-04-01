export const enum Constants {
    A8BytesPerElement = 1,
    A16BytesPerElement = 2,
    A32BytesPerElement = 4,
    BtTransformSize = 64,
    BtTransformSizeInFloat32Array = BtTransformSize / A32BytesPerElement,
    MotionStateSize = 80,
    MotionStateSizeInFloat32Array = MotionStateSize / A32BytesPerElement,
    RigidBodyConstructionInfoSize = 144
}

/**
 * RigidBodyConstructionInfo representations
 *
 * shape: *uint32 : offset 0
 * initial_transform: float32[16] : offset 16
 *
 * dataMask: uint8 : offset 80
 * motionType: uint8 : offset 82
 *
 * padding: uint8[1] : offset 83
 *
 * mass: float32 : offset 84
 * localInertia: float32[3] : offset 88
 * linearDamping: float32 : offset 100
 * angularDamping: float32 : offset 104
 * friction: float32 : offset 108
 * restitution: float32 : offset 112
 * linearSleepingThreshold: float32 : offset 116
 * angularSleepingThreshold: float32 : offset 120
 * collisionGroup: uint16 : offset 124
 * collisionMask: uint16 : offset 126
 * additionalDamping: uint8 : offset 128
 * noContactResponse: uint8 : offset 129
 * disableDeactivation: uint8 : offset 130
 * padding: uint8[13] : offset 131
 *
 * --size: 144
 */
export const enum RigidBodyConstructionInfoOffsets {
    Shape = 0x00,
    InitialTransform = 0x10,
    DataMask = 0x50,
    MotionType = 0x52,
    Mass = 0x54,
    LocalInertia = 0x58,
    LinearDamping = 0x64,
    AngularDamping = 0x68,
    Friction = 0x6C,
    Restitution = 0x70,
    LinearSleepingThreshold = 0x74,
    AngularSleepingThreshold = 0x78,
    CollisionGroup = 0x7C,
    CollisionMask = 0x7E,
    AdditionalDamping = 0x80,
    NoContactResponse = 0x81,
    DisableDeactivation = 0x82
}


/**
 * btTransform representations
 * matrix_rowx: f32[3] : offset 0
 * padding: u32 : offset 12
 * matrix_rowy: f32[3] : offset 16
 * padding: u32 : offset 28
 * matrix_rowz: f32[3] : offset 32
 * padding: u32 : offset 44
 * translation: f32[3] : offset 48
 * padding: u32 : offset 60
 *
 * --size: 64
 */
export const enum BtTransformOffsets {
    MatrixRowX = 0,
    MatrixRowY = 16,
    MatrixRowZ = 32,
    Translation = 48
}

export const enum BtTransformOffsetsInFloat32Array {
    MatrixRowX = BtTransformOffsets.MatrixRowX / Constants.A32BytesPerElement,
    MatrixRowY = BtTransformOffsets.MatrixRowY / Constants.A32BytesPerElement,
    MatrixRowZ = BtTransformOffsets.MatrixRowZ / Constants.A32BytesPerElement,
    Translation = BtTransformOffsets.Translation / Constants.A32BytesPerElement
}


/**
 * MotionState representations
 *
 * vtable: u32 : offset 0
 * padding: u32[3] : offset 4
 * matrix_rowx: f32[3] : offset 16
 * padding: u32 : offset 28
 * matrix_rowy: f32[3] : offset 32
 * padding: u32 : offset 44
 * matrix_rowz: f32[3] : offset 48
 * padding: u32 : offset 60
 * translation: f32[3] : offset 64
 * padding: u32 : offset 76
 *
 * --size: 80
 */
export const enum MotionStateOffsets {
    VTable = 0,
    TransformOffset = 16,
    MatrixRowX = BtTransformOffsets.MatrixRowX + TransformOffset,
    MatrixRowY = BtTransformOffsets.MatrixRowY + TransformOffset,
    MatrixRowZ = BtTransformOffsets.MatrixRowZ + TransformOffset,
    Translation = BtTransformOffsets.Translation + TransformOffset,
}

export const enum MotionStateOffsetsInFloat32Array {
    MatrixRowX = MotionStateOffsets.MatrixRowX / Constants.A32BytesPerElement,
    MatrixRowY = MotionStateOffsets.MatrixRowY / Constants.A32BytesPerElement,
    MatrixRowZ = MotionStateOffsets.MatrixRowZ / Constants.A32BytesPerElement,
    Translation = MotionStateOffsets.Translation / Constants.A32BytesPerElement
}

export const enum TemporalKinematicState {
    Disabled = 0,
    Idle = 1,
    WaitForRestore = 2,
    Restoring = 3
}
