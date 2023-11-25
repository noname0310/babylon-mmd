use byte_slice_cast::{AsSliceOf, FromByteSlice};
use nalgebra::{Vector3, UnitQuaternion, Quaternion, Vector4};
use num_traits::FromBytes;

pub(crate) struct MetadataBuffer {
    bytes: Box<[u8]>,
    offset: usize,
}

impl MetadataBuffer {
    fn new(bytes: Box<[u8]>) -> Self {
        Self {
            bytes,
            offset: 0,
        }
    }

    fn read<'a, T>(&'a mut self) -> T
    where
        T: FromBytes,
        <T as FromBytes>::Bytes: 'a,
        &'a [u8]: TryInto<&'a <T as FromBytes>::Bytes>,
        <&'a [u8] as TryInto<&'a <T as FromBytes>::Bytes>>::Error: std::fmt::Debug,
    {
        let value = T::from_le_bytes(self.bytes[self.offset..self.offset + std::mem::size_of::<T>()].as_ref().try_into().unwrap());
        self.offset += std::mem::size_of::<T>();
        value
    }

    fn read_array<T>(&mut self, n: usize) -> Vec<T>
    where
        T: FromByteSlice + Clone
    {
        let slice = self.bytes[self.offset..self.offset + std::mem::size_of::<T>() * n].as_ref().as_slice_of().unwrap();
        self.offset += std::mem::size_of::<T>() * n;
        slice.to_vec()
    }

    fn read_vector(&mut self) -> Vector3<f32> {
        let slice = self.bytes[self.offset..self.offset + std::mem::size_of::<f32>() * 3].as_ref().as_slice_of().unwrap();
        let value = Vector3::from_column_slice(slice);
        self.offset += std::mem::size_of::<f32>() * 3;
        value
    }

    fn read_vector_array(&mut self, n: usize) -> Vec<Vector3<f32>> {
        let slice = self.bytes[self.offset..self.offset + std::mem::size_of::<f32>() * 3 * n].as_ref().as_slice_of().unwrap();
        let mut values = Vec::with_capacity(n);
        for i in 0..n {
            values.push(Vector3::from_column_slice(&slice[i * 3..i * 3 + 3]));
        }
        self.offset += std::mem::size_of::<f32>() * 3 * n;
        values
    }

    fn read_quaternion_array(&mut self, n: usize) -> Vec<UnitQuaternion<f32>> {
        let slice = self.bytes[self.offset..self.offset + std::mem::size_of::<f32>() * 4 * n].as_ref().as_slice_of().unwrap();
        let mut values = Vec::with_capacity(n);
        for i in 0..n {
            values.push(
                UnitQuaternion::new_unchecked(
                    Quaternion::from_vector(
                        Vector4::from_column_slice(&slice[i * 4..i * 4 + 4])
                    )
                )
            );
        }
        self.offset += std::mem::size_of::<f32>() * 4 * n;
        values
    }
}

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
    pub limits: Option<IkChainAngleLimits>,
}

pub(crate) struct IkChainAngleLimits {
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

pub(crate) struct BoneMetadataReader {
    buffer: MetadataBuffer,
    count: u32,
}

impl BoneMetadataReader {
    pub fn new(mut buffer: MetadataBuffer) -> Self {
        let count = buffer.read::<u32>();

        Self {
            buffer,
            count,
        }
    }

    pub fn count(&self) -> u32 {
        self.count
    }

    pub fn enumerate(mut self, mut f: impl FnMut(u32, BoneMetadata)) -> MorphMetadataReader {
        for i in 0..self.count {
            let rest_position = self.buffer.read_vector();
            let parent_bone_index = self.buffer.read::<i32>();
            let transform_order = self.buffer.read::<i32>();
            let flag = self.buffer.read::<u16>();
            let append_transform = if flag & BoneFlag::LocalAppendTransform as u16 != 0 {
                Some(AppendTransformMetadata {
                    parent_index: self.buffer.read::<i32>(),
                    ratio: self.buffer.read::<f32>(),
                })
            } else {
                None
            };
            let ik = if flag & BoneFlag::IsIkEnabled as u16 != 0 {
                Some(Box::new(IkMetadata {
                    target: self.buffer.read::<i32>(),
                    iteration: self.buffer.read::<i32>(),
                    rotation_constraint: self.buffer.read::<f32>(),
                    links: {
                        let link_count = self.buffer.read::<i32>();
                        let mut links = Vec::with_capacity(link_count as usize);
                        for _ in 0..link_count {
                            links.push(IkLinkMetadata {
                                target: self.buffer.read::<i32>(),
                                limits: if flag & BoneFlag::HasAxisLimit as u16 != 0 {
                                    Some(IkChainAngleLimits {
                                        minimum_angle: self.buffer.read_vector(),
                                        maximum_angle: self.buffer.read_vector(),
                                    })
                                } else {
                                    None
                                },
                            });
                        }
                        links
                    },
                }))
            } else {
                None
            };
            f(i, BoneMetadata {
                rest_position,
                parent_bone_index,
                transform_order,
                flag,
                append_transform,
                ik,
            });
        }

        MorphMetadataReader::new(self.buffer)
    }
}

pub(crate) enum MorphMetadata {
    Bone(BoneMorphMetadata),
    Group(GroupMorphMetadata),
}

pub(crate) struct BoneMorphMetadata {
    pub indices: Vec<i32>,
    pub positions: Vec<Vector3<f32>>,
    pub rotations: Vec<UnitQuaternion<f32>>,
}

pub(crate) struct GroupMorphMetadata {
    pub indices: Vec<i32>,
    pub ratios: Vec<f32>,
}

enum MorphKind {
    GroupMorph = 0,
    BoneMorph = 2
}

pub(crate) struct MorphMetadataReader {
    buffer: MetadataBuffer,
    count: u32,
}

impl MorphMetadataReader {
    fn new(mut buffer: MetadataBuffer) -> Self {
        let count = buffer.read::<u32>();

        Self {
            buffer,
            count,
        }
    }

    pub fn count(&self) -> u32 {
        self.count
    }

    pub fn read(mut self) -> (Vec<MorphMetadata>, RigidbodyMetadataReader) {
        let mut morphs = Vec::with_capacity(self.count as usize);

        for _ in 0..self.count {
            let kind = self.buffer.read::<u8>();
            if kind == MorphKind::BoneMorph as u8 {
                let morph_count = self.buffer.read::<i32>();
                let indices = self.buffer.read_array::<i32>(morph_count as usize);
                let positions = self.buffer.read_vector_array(morph_count as usize);
                let rotations = self.buffer.read_quaternion_array(morph_count as usize);
                morphs.push(MorphMetadata::Bone(BoneMorphMetadata {
                    indices,
                    positions,
                    rotations,
                }));
            } else if kind == MorphKind::GroupMorph as u8 {
                let morph_count = self.buffer.read::<i32>();
                let indices = self.buffer.read_array::<i32>(morph_count as usize);
                let ratios = self.buffer.read_array::<f32>(morph_count as usize);
                morphs.push(MorphMetadata::Group(GroupMorphMetadata {
                    indices,
                    ratios,
                }));
            } else {
                unreachable!()
            }
        }

        (morphs, RigidbodyMetadataReader::new(self.buffer))
    }
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

pub(crate) struct RigidbodyMetadataReader {
    buffer: MetadataBuffer,
    count: u32,
}

impl RigidbodyMetadataReader {
    fn new(mut buffer: MetadataBuffer) -> Self {
        let count = buffer.read::<u32>();

        Self {
            buffer,
            count,
        }
    }

    pub fn count(&self) -> u32 {
        self.count
    }

    pub fn for_each(mut self, mut f: impl FnMut(RigidbodyMetadata)) -> JointMetadataReader {
        for _ in 0..self.count {
            let bone_index = self.buffer.read::<i32>();
            let collision_group = self.buffer.read::<u8>();
            let collision_mask = self.buffer.read::<u16>();
            let shape_type = self.buffer.read::<u8>();
            let shape_size = self.buffer.read_vector();
            let shape_position = self.buffer.read_vector();
            let shape_rotation = self.buffer.read_vector();
            let mass = self.buffer.read::<f32>();
            let linear_damping = self.buffer.read::<f32>();
            let angular_damping = self.buffer.read::<f32>();
            let repulsion = self.buffer.read::<f32>();
            let friction = self.buffer.read::<f32>();
            let physics_mode = self.buffer.read::<u8>();
            f(RigidbodyMetadata {
                bone_index,
                collision_group,
                collision_mask,
                shape_type,
                shape_size,
                shape_position,
                shape_rotation,
                mass,
                linear_damping,
                angular_damping,
                repulsion,
                friction,
                physics_mode,
            });
        }

        JointMetadataReader::new(self.buffer)
    }
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

pub(crate) struct JointMetadataReader {
    buffer: MetadataBuffer,
    count: u32,
}

impl JointMetadataReader {
    fn new(mut buffer: MetadataBuffer) -> Self {
        let count = buffer.read::<u32>();

        Self {
            buffer,
            count,
        }
    }

    pub fn count(&self) -> u32 {
        self.count
    }

    pub fn for_each(mut self, mut f: impl FnMut(JointMetadata)) {
        for _ in 0..self.count {
            let kind = self.buffer.read::<u8>();
            let rigidbody_index_a = self.buffer.read::<i32>();
            let rigidbody_index_b = self.buffer.read::<i32>();
            let position = self.buffer.read_vector();
            let rotation = self.buffer.read_vector();
            let position_min = self.buffer.read_vector();
            let position_max = self.buffer.read_vector();
            let rotation_min = self.buffer.read_vector();
            let rotation_max = self.buffer.read_vector();
            let spring_position = self.buffer.read_vector();
            let spring_rotation = self.buffer.read_vector();
            f(JointMetadata {
                kind,
                rigidbody_index_a,
                rigidbody_index_b,
                position,
                rotation,
                position_min,
                position_max,
                rotation_min,
                rotation_max,
                spring_position,
                spring_rotation,
            });
        }
    }
}
