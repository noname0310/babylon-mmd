use byte_slice_cast::{AsSliceOf, FromByteSlice};
use glam::{Quat, Vec3A};
use num_traits::FromBytes;

pub(crate) struct MetadataBuffer<'a> {
    bytes: &'a [u8],
    offset: usize,
}

impl<'a> MetadataBuffer<'a> {
    pub(crate) fn new(bytes: &'a [u8]) -> Self {
        Self {
            bytes,
            offset: 0,
        }
    }

    fn read<'b, T>(&'b mut self) -> T
    where
        T: FromBytes,
        <T as FromBytes>::Bytes: 'b,
        &'b [u8]: TryInto<&'b <T as FromBytes>::Bytes>,
        <&'b [u8] as TryInto<&'b <T as FromBytes>::Bytes>>::Error: std::fmt::Debug,
    {
        let value = T::from_le_bytes(self.bytes[self.offset..self.offset + std::mem::size_of::<T>()].as_ref().try_into().unwrap());
        self.offset += std::mem::size_of::<T>();
        value
    }

    fn read_array<'b, T>(&'b mut self, n: usize) -> Vec<T>
    where
        T: FromByteSlice + Clone + num_traits::FromBytes,
        <T as FromBytes>::Bytes: 'b,
        &'b [u8]: TryInto<&'b <T as FromBytes>::Bytes>,
        <&'b [u8] as TryInto<&'b <T as FromBytes>::Bytes>>::Error: std::fmt::Debug,
    {
        let vec = match self.bytes[self.offset..self.offset + std::mem::size_of::<T>() * n].as_ref().as_slice_of() {
            Ok(slice) => slice.to_vec(),
            Err(_) => {
                let mut vec = Vec::with_capacity(n);
                for _ in 0..n {
                    vec.push(T::from_le_bytes(self.bytes[self.offset..self.offset + std::mem::size_of::<T>()].as_ref().try_into().unwrap()));
                }
                vec
            }
        };
        self.offset += std::mem::size_of::<T>() * n;
        vec
    }

    fn read_vector(&mut self) -> Vec3A {
        let value = match self.bytes[self.offset..self.offset + std::mem::size_of::<f32>() * 3].as_ref().as_slice_of() {
            Ok(slice) => {
                self.offset += std::mem::size_of::<f32>() * 3;
                Vec3A::from_slice(slice)
            },
            Err(_) => {
                Vec3A::new(
                    self.read::<f32>(),
                    self.read::<f32>(),
                    self.read::<f32>(),
                )
            }
        };
        value
    }

    fn read_vector_array(&mut self, n: usize) -> Vec<Vec3A> {
        let mut values = Vec::with_capacity(n);
        match self.bytes[self.offset..self.offset + std::mem::size_of::<f32>() * 3 * n].as_ref().as_slice_of() {
            Ok(slice) => {
                for i in 0..n {
                    values.push(Vec3A::from_slice(&slice[i * 3..i * 3 + 3]));
                }
                self.offset += std::mem::size_of::<f32>() * 3 * n;
            },
            Err(_) => {
                for _ in 0..n {
                    values.push(self.read_vector());
                }
            }
        };
        values
    }

    fn read_quaternion_array(&mut self, n: usize) -> Vec<Quat> {
        let mut values = Vec::with_capacity(n);
        match self.bytes[self.offset..self.offset + std::mem::size_of::<f32>() * 4 * n].as_ref().as_slice_of() {
            Ok(slice) => {
                for i in 0..n {
                    values.push(Quat::from_slice(&slice[i * 4..i * 4 + 4]));
                }
                self.offset += std::mem::size_of::<f32>() * 4 * n;
            },
            Err(_) => {
                for _ in 0..n {
                    values.push(
                        Quat::from_xyzw(
                            self.read::<f32>(),
                            self.read::<f32>(),
                            self.read::<f32>(),
                            self.read::<f32>(),
                        )
                    );
                }
            }
        };
        values
    }
}

pub(crate) struct BoneMetadata {
    pub(crate) rest_position: Vec3A,
    pub(crate) parent_bone_index: i32,
    pub(crate) transform_order: i32,
    pub(crate) flag: u16,
    pub(crate) append_transform: Option<AppendTransformMetadata>,
    pub(crate) ik: Option<Box<IkMetadata>>,
}

pub(crate) struct AppendTransformMetadata {
    pub(crate) parent_index: i32,
    pub(crate) ratio: f32,
}

pub(crate) struct IkMetadata {
    pub(crate) target: i32,
    pub(crate) iteration: i32,
    pub(crate) rotation_constraint: f32,
    pub(crate) links: Vec<IkLinkMetadata>,
}

pub(crate) struct IkLinkMetadata {
    pub(crate) target: i32,
    pub(crate) limits: Option<IkChainAngleLimits>,
}

pub(crate) struct IkChainAngleLimits {
    pub(crate) minimum_angle: Vec3A,
    pub(crate) maximum_angle: Vec3A,
}

pub(crate) enum BoneFlag {
    // UseBoneIndexAsTailPosition = 0x0001,

    // IsRotatable = 0x0002,
    // IsMovable = 0x0004,
    // IsVisible = 0x0008,
    // IsControllable = 0x0010,
    IsIkEnabled = 0x0020,

    LocalAppendTransform = 0x0080,
    HasAppendRotate = 0x0100,
    HasAppendMove = 0x0200,
    // HasAxisLimit = 0x0400,
    // HasLocalVector = 0x0800,
    TransformAfterPhysics = 0x1000,
    // IsExternalParentTransformed = 0x2000,
}

pub(crate) struct BoneMetadataReader<'a> {
    buffer: MetadataBuffer<'a>,
    bone_count: u32,
    append_transform_count: u32,
    ik_count: u32,
}

impl<'a> BoneMetadataReader<'a> {
    pub(crate) fn new(mut buffer: MetadataBuffer<'a>) -> Self {
        let bone_count = buffer.read::<u32>();
        let append_transform_count = buffer.read::<u32>();
        let ik_count = buffer.read::<u32>();

        Self {
            buffer,
            bone_count,
            append_transform_count,
            ik_count,
        }
    }

    pub(crate) fn bone_count(&self) -> u32 {
        self.bone_count
    }

    pub(crate) fn append_transform_count(&self) -> u32 {
        self.append_transform_count
    }

    pub(crate) fn ik_count(&self) -> u32 {
        self.ik_count
    }

    pub(crate) fn enumerate(mut self, mut f: impl FnMut(u32, BoneMetadata)) -> MorphMetadataReader<'a> {
        for i in 0..self.bone_count {
            let rest_position = self.buffer.read_vector();
            let parent_bone_index = self.buffer.read::<i32>();
            let transform_order = self.buffer.read::<i32>();
            let flag = self.buffer.read::<u16>();
            self.buffer.offset += 2; // padding
            let append_transform = if flag & BoneFlag::HasAppendMove as u16 != 0 || flag & BoneFlag::HasAppendRotate as u16 != 0 {
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
                        let link_count = self.buffer.read::<u32>();
                        let mut links = Vec::with_capacity(link_count as usize);
                        for _ in 0..link_count {
                            let target = self.buffer.read::<i32>();
                            let has_limits = self.buffer.read::<u8>() != 0;
                            self.buffer.offset += 3; // padding

                            let limits = if has_limits {
                                Some(IkChainAngleLimits {
                                    minimum_angle: self.buffer.read_vector(),
                                    maximum_angle: self.buffer.read_vector(),
                                })
                            } else {
                                None
                            };

                            links.push(IkLinkMetadata {
                                target,
                                limits,
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
    pub(crate) indices: Vec<i32>,
    pub(crate) positions: Vec<Vec3A>,
    pub(crate) rotations: Vec<Quat>,
}

pub(crate) struct GroupMorphMetadata {
    pub(crate) indices: Vec<i32>,
    pub(crate) ratios: Vec<f32>,
}

enum MorphKind {
    GroupMorph = 0,
    BoneMorph = 2,
}

pub(crate) struct MorphMetadataReader<'a> {
    buffer: MetadataBuffer<'a>,
    count: u32,
}

impl<'a> MorphMetadataReader<'a> {
    fn new(mut buffer: MetadataBuffer<'a>) -> Self {
        let count = buffer.read::<u32>();

        Self {
            buffer,
            count,
        }
    }

    pub(crate) fn count(&self) -> u32 {
        self.count
    }

    pub(crate) fn read(mut self) -> (Vec<MorphMetadata>, RigidbodyMetadataReader<'a>) {
        let mut morphs = Vec::with_capacity(self.count as usize);

        for _ in 0..self.count {
            let kind = self.buffer.read::<u8>();
            self.buffer.offset += 3; // padding

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
    shape_size: Vec3A,
    shape_position: Vec3A,
    shape_rotation: Vec3A,
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

pub(crate) struct RigidbodyMetadataReader<'a> {
    buffer: MetadataBuffer<'a>,
    count: u32,
}

impl<'a> RigidbodyMetadataReader<'a> {
    fn new(mut buffer: MetadataBuffer<'a>) -> Self {
        let count = buffer.read::<u32>();

        Self {
            buffer,
            count,
        }
    }

    pub(crate) fn count(&self) -> u32 {
        self.count
    }

    pub(crate) fn for_each(mut self, mut f: impl FnMut(RigidbodyMetadata)) -> JointMetadataReader<'a> {
        for _ in 0..self.count {
            let bone_index = self.buffer.read::<i32>();
            let collision_group = self.buffer.read::<u8>();
            let shape_type = self.buffer.read::<u8>();
            let collision_mask = self.buffer.read::<u16>();
            let shape_size = self.buffer.read_vector();
            let shape_position = self.buffer.read_vector();
            let shape_rotation = self.buffer.read_vector();
            let mass = self.buffer.read::<f32>();
            let linear_damping = self.buffer.read::<f32>();
            let angular_damping = self.buffer.read::<f32>();
            let repulsion = self.buffer.read::<f32>();
            let friction = self.buffer.read::<f32>();
            let physics_mode = self.buffer.read::<u8>();
            self.buffer.offset += 3; // padding
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
    position: Vec3A,
    rotation: Vec3A,
    position_min: Vec3A,
    position_max: Vec3A,
    rotation_min: Vec3A,
    rotation_max: Vec3A,
    spring_position: Vec3A,
    spring_rotation: Vec3A,
}

pub(crate) enum JointKind {
    Spring6Dof = 0,
    // SixDof = 1,
    // P2p = 2,
    // ConeTwist = 3,
    // Slider = 4,
    // Hinge = 5,
}

pub(crate) struct JointMetadataReader<'a> {
    buffer: MetadataBuffer<'a>,
    count: u32,
}

impl<'a> JointMetadataReader<'a> {
    fn new(mut buffer: MetadataBuffer<'a>) -> Self {
        let count = buffer.read::<u32>();

        Self {
            buffer,
            count,
        }
    }

    #[inline]
    pub(crate) fn count(&self) -> u32 {
        self.count
    }

    pub(crate) fn for_each(mut self, mut f: impl FnMut(JointMetadata)) {
        for _ in 0..self.count {
            let kind = self.buffer.read::<u8>();
            self.buffer.offset += 3; // padding
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
