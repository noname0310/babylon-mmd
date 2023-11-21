use nalgebra::Vector3;

pub(crate) struct BoneMetadata {
    pub rest_position: Vector3<f32>,
    pub parent_bone_index: i32,
    pub transform_order: i32,
    pub flag: u16,
    pub append_transform: Option<AppendTransformMetadata>,
    pub ik: Option<Box<IkMetadata>>,
}

pub(crate) struct AppendTransformMetadata {
    pub parent_index: i32,
    pub ratio: f32,
}

pub(crate) struct IkMetadata {
    pub target: i32,
    pub iteration: i32,
    pub rotation_constraint: f32,
    pub links: Vec<IkLinkMetadata>,
}

pub(crate) struct IkLinkMetadata {
    pub target: i32,
    pub minimum_angle: Vector3<f32>,
    pub maximum_angle: Vector3<f32>,
}

pub(crate) enum BoneFlag {
    UseBoneIndexAsTailPosition = 0x0001,

    IsRotatable = 0x0002,
    IsMovable = 0x0004,
    IsVisible = 0x0008,
    IsControllable = 0x0010,
    IsIkEnabled = 0x0020,

    LocalAppendTransform = 0x0080,
    HasAppendRotate = 0x0100,
    HasAppendMove = 0x0200,
    HasAxisLimit = 0x0400,
    HasLocalVector = 0x0800,
    TransformAfterPhysics = 0x1000,
    IsExternalParentTransformed = 0x2000,
}

pub(crate) struct BoneMorphMetadata {
    morph_index: u32,
    indices: Vec<i32>,
    positions: Vec<Vector3<f32>>,
    rotations: Vec<Vector3<f32>>,
}

pub(crate) struct GroupMorphMetadata {
    morph_index: u32,
    indices: Vec<i32>,
    ratios: Vec<f32>,
}

pub(crate) struct RigidbodyMetadata {
    bone_index: i32,
    collision_group: u8,
    collision_mask: u16,
    shape_type: u8,
    shape_size: Vector3<f32>,
    shape_position: Vector3<f32>,
    shape_rotation: Vector3<f32>,
    mass: f32,
    linear_damping: f32,
    angular_damping: f32,
    repulsion: f32,
    friction: f32,
    physics_mode: u8,
}

pub(crate) enum RigidbodyShapeType {
    Sphere = 0,
    Box = 1,
    Capsule = 2,
}

pub(crate) enum RigidbodyPhysicsMode {
    FollowBone = 0,
    Physics = 1,
    PhysicsWithBone = 2,
}

pub(crate) struct JointMetadata {
    kind: u8,
    rigidbody_index_a: i32,
    rigidbody_index_b: i32,
    position: Vector3<f32>,
    rotation: Vector3<f32>,
    position_min: Vector3<f32>,
    position_max: Vector3<f32>,
    rotation_min: Vector3<f32>,
    rotation_max: Vector3<f32>,
    spring_position: Vector3<f32>,
    spring_rotation: Vector3<f32>,
}

pub(crate) enum JointKind {
    Spring6Dof = 0,
    SixDof = 1,
    P2p = 2,
    ConeTwist = 3,
    Slider = 4,
    Hinge = 5,
}

pub(crate) struct MmdModelMetadata {
    pub bones: Vec<BoneMetadata>,
    pub bone_morphs: Vec<BoneMorphMetadata>,
    pub group_morphs: Vec<GroupMorphMetadata>,
    pub rigidbodies: Vec<RigidbodyMetadata>,
    pub joints: Vec<JointMetadata>,
}

impl MmdModelMetadata {
    pub fn decode(bytes: &[u8]) -> Self {
//         let mut offset = 0;
//         let bone_count = u32::from_le_bytes(bytes[offset..offset + 4].try_into().unwrap());
//         offset += 4;
//         let mut bones = Vec::with_capacity(bone_count as usize);
//         for _ in 0..bone_count {
//             let name = decode_string(bytes, &mut offset);
//             let parent_bone_index = i32::from_le_bytes(bytes[offset..offset + 4].try_into().unwrap());
//             offset += 4;
//             let transform_order = i32::from_le_bytes(bytes[offset..offset + 4].try_into().unwrap());
//             offset += 4;
//             let flag = u16::from_le_bytes(bytes[offset..offset + 2].try_into().unwrap());
//             offset += 2;
//             let append_transform = if (flag & BoneFlag::HasAppendMove as u16) != 0 || (flag & BoneFlag::HasAppendRotate as u16) != 0 {
//                 let parent_index = i32::from_le_bytes(bytes[offset..offset + 4].try_into().unwrap());
//                 offset += 4;
//                 let ratio = f32::from_le_bytes(bytes[offset..offset + 4].try_into().unwrap());
//                 offset += 4;
//                 Some(AppendTransformMetadata {
//                     parent_index,
//                     ratio,
//                 })
//             } else {
//                 None
//             };
//             let ik = if (flag & BoneFlag::IsIkEnabled as u16) != 0 {
//                 let target = i32::from_le_bytes(bytes[offset..offset + 4].try_into().unwrap());
//                 offset += 4;
//                 let iteration = i32::from_le_bytes(bytes[offset..offset + 4].try_into().unwrap());
//                 offset += 4;
//                 let rotation_constraint = f32::from_le_bytes(bytes[offset..offset + 4].try_into().unwrap());
//                 offset += 4;
//                 let link_count = u32::from_le_bytes(bytes[offset..offset + 4].try_into().unwrap());
//                 offset += 4;
//                 let mut links = Vec::with_capacity(link_count as usize);
//                 for _ in 0..link_count {
//                     let target = i32::from_le_bytes(bytes[offset..offset + 4].try_into().unwrap());
//                     offset += 4;
//                     let minimum_angle = Vector3::new(
//                         f32::from_le_bytes(bytes[offset..offset + 4].try_into().unwrap()),
//                         f32::from_le_bytes()
       unimplemented!();
    }
}
