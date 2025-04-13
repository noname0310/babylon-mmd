use byte_slice_cast::{AsSliceOf, FromByteSlice};
use glam::{Mat4, Quat, Vec3A, Vec4};
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
    pub(crate) absolute_inverse_bind_matrix: Mat4,
    pub(crate) parent_bone_index: i32,
    pub(crate) transform_order: i32,
    pub(crate) flag: u16,
    pub(crate) append_transform: Option<AppendTransformMetadata>,
    pub(crate) axis_limit: Option<Vec3A>,
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
    HasAxisLimit = 0x0400,
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
            let absolute_inverse_bind_matrix = Mat4::from_cols(
                Vec4::new(self.buffer.read::<f32>(), self.buffer.read::<f32>(), self.buffer.read::<f32>(), self.buffer.read::<f32>()),
                Vec4::new(self.buffer.read::<f32>(), self.buffer.read::<f32>(), self.buffer.read::<f32>(), self.buffer.read::<f32>()),
                Vec4::new(self.buffer.read::<f32>(), self.buffer.read::<f32>(), self.buffer.read::<f32>(), self.buffer.read::<f32>()),
                Vec4::new(self.buffer.read::<f32>(), self.buffer.read::<f32>(), self.buffer.read::<f32>(), self.buffer.read::<f32>()),
            );
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
            let axis_limit = if flag & BoneFlag::HasAxisLimit as u16 != 0 {
                Some(self.buffer.read_vector())
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
                absolute_inverse_bind_matrix,
                parent_bone_index,
                transform_order,
                flag,
                append_transform,
                axis_limit,
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

    // pub(crate) fn count(&self) -> u32 {
    //     self.count
    // }

    pub(crate) fn read(mut self) -> (Vec<MorphMetadata>, RigidBodyMetadataReader<'a>) {
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

        (morphs, RigidBodyMetadataReader::new(self.buffer))
    }
}

#[derive(Clone, Copy)]
pub(crate) enum PhysicsInfoKind {
    NoPhysics = 0,
    StripedRigidbodies = 1,
    FullPhysics = 2,
}

// for non physics build

#[cfg(not(feature = "physics"))]

pub(crate) enum RigidBodyPhysicsMode {
    FollowBone = 0,
}

#[cfg(not(feature = "physics"))]
pub(crate) struct RigidBodyMetadata {
    pub(crate) bone_index: i32,
    pub(crate) physics_mode: u8,
}

#[cfg(not(feature = "physics"))]
pub(crate) struct RigidBodyMetadataReader<'a> {
    buffer: MetadataBuffer<'a>,
    physics_info_kind: PhysicsInfoKind,
    count: u32,
}

#[cfg(not(feature = "physics"))]
impl<'a> RigidBodyMetadataReader<'a> {
    fn new(mut buffer: MetadataBuffer<'a>) -> Self {
        let physics_info_kind = buffer.read::<u8>();
        buffer.offset += 3; // padding

        let kind: PhysicsInfoKind;
        let count: u32;

        if physics_info_kind == PhysicsInfoKind::NoPhysics as u8 {
            kind = PhysicsInfoKind::NoPhysics;
            count = 0;
        } else if physics_info_kind == PhysicsInfoKind::StripedRigidbodies as u8 {
            kind = PhysicsInfoKind::StripedRigidbodies;
            count = buffer.read::<u32>();
        } else if physics_info_kind == PhysicsInfoKind::FullPhysics as u8 {
            // skip physics world info
            buffer.offset += 4; // physics world id (u32)
            let kinematic_shared_physics_world_id_count = buffer.read::<u32>();
            buffer.offset += 4 * kinematic_shared_physics_world_id_count as usize;
            buffer.offset += 16 * 4; // model initial world matrix
            
            kind = PhysicsInfoKind::FullPhysics;
            count = buffer.read::<u32>();
        } else {
            panic!("Invalid physics info kind");
        }
        
        Self {
            buffer,
            physics_info_kind: kind,
            count,
        }
    }

    pub(crate) fn physics_info_kind(&self) -> PhysicsInfoKind {
        self.physics_info_kind
    }

    // pub(crate) fn count(&self) -> u32 {
    //     self.count
    // }

    pub(crate) fn enumerate(&mut self, mut f: impl FnMut(u32, RigidBodyMetadata)) {
        match self.physics_info_kind {
            PhysicsInfoKind::NoPhysics => {},
            PhysicsInfoKind::StripedRigidbodies => {
                for i in 0..self.count {
                    let bone_index = self.buffer.read::<i32>();
                    let physics_mode = self.buffer.read::<u8>();
                    self.buffer.offset += 3; // padding
                    f(i, RigidBodyMetadata {
                        bone_index,
                        physics_mode,
                    });
                }
            },
            PhysicsInfoKind::FullPhysics => {
                for i in 0..self.count {
                    let bone_index = self.buffer.read::<i32>();
                    self.buffer.offset +=
                        1 + // collision_group
                        1 + // shape_type
                        2 + // collision_mask
                        4 * 4 + // shape_size
                        3 * 4 + // shape_position
                        3 * 4 + // shape_rotation
                        4 + // mass
                        4 + // linear_damping
                        4 + // angular_damping
                        4 + // repulsion
                        4; // friction
                    let physics_mode = self.buffer.read::<u8>();
                    self.buffer.offset += 3; // padding
                    f(i, RigidBodyMetadata {
                        bone_index,
                        physics_mode,
                    });
                }
            },
        }
    }
}

// for physics build

#[cfg(feature = "physics")]
pub(crate) struct RigidBodyMetadata {
    pub(crate) bone_index: i32,
    pub(crate) collision_group: u8,
    pub(crate) collision_mask: u16,
    pub(crate) shape_type: u8,
    pub(crate) shape_size: Vec4,
    pub(crate) shape_position: Vec3A,
    pub(crate) shape_rotation: Vec3A,
    pub(crate) mass: f32,
    pub(crate) linear_damping: f32,
    pub(crate) angular_damping: f32,
    pub(crate) repulsion: f32,
    pub(crate) friction: f32,
    pub(crate) physics_mode: u8,
}

#[cfg(feature = "physics")]
pub(crate) enum RigidBodyShapeType {
    Sphere = 0,
    Box = 1,
    Capsule = 2,
    StaticPlane = 5,
}

#[cfg(feature = "physics")]
#[derive(Clone, Copy, PartialEq, Eq)]
pub(crate) enum RigidBodyPhysicsMode {
    FollowBone = 0,
    Physics = 1,
    PhysicsWithBone = 2,
    Static = 3,
}

#[cfg(feature = "physics")]
pub(crate) struct RigidBodyMetadataReader<'a> {
    buffer: MetadataBuffer<'a>,
    buffer_start_offset: usize,
    physics_info_kind: PhysicsInfoKind,
    physics_world_id: u32,
    kinematic_shared_physics_world_ids: Vec<u32>,
    model_initial_world_matrix: Mat4,
    force_disable_offset_for_constraint_frame: bool,
    count: u32,
}

#[cfg(feature = "physics")]
impl<'a> RigidBodyMetadataReader<'a> {
    fn new(mut buffer: MetadataBuffer<'a>) -> Self {
        let physics_info_kind = buffer.read::<u8>();
        buffer.offset += 3; // padding

        let kind: PhysicsInfoKind;
        let mut physics_world_id = 0;
        let mut kinematic_shared_physics_world_ids = Vec::new();
        let mut model_initial_world_matrix = Mat4::IDENTITY;
        let mut force_disable_offset_for_constraint_frame = false;
        let count: u32;

        if physics_info_kind == PhysicsInfoKind::NoPhysics as u8 {
            kind = PhysicsInfoKind::NoPhysics;
            count = 0;
        } else if physics_info_kind == PhysicsInfoKind::StripedRigidbodies as u8 {
            kind = PhysicsInfoKind::StripedRigidbodies;
            count = buffer.read::<u32>();
        } else if physics_info_kind == PhysicsInfoKind::FullPhysics as u8 {
            // skip physics world info
            physics_world_id = buffer.read::<u32>();
            let kinematic_shared_physics_world_id_count = buffer.read::<u32>();
            kinematic_shared_physics_world_ids = buffer.read_array::<u32>(kinematic_shared_physics_world_id_count as usize);
            model_initial_world_matrix = Mat4::from_cols(
                Vec4::new(buffer.read::<f32>(), buffer.read::<f32>(), buffer.read::<f32>(), buffer.read::<f32>()),
                Vec4::new(buffer.read::<f32>(), buffer.read::<f32>(), buffer.read::<f32>(), buffer.read::<f32>()),
                Vec4::new(buffer.read::<f32>(), buffer.read::<f32>(), buffer.read::<f32>(), buffer.read::<f32>()),
                Vec4::new(buffer.read::<f32>(), buffer.read::<f32>(), buffer.read::<f32>(), buffer.read::<f32>()),
            );
            force_disable_offset_for_constraint_frame = buffer.read::<u8>() != 0;
            buffer.offset += 3; // padding
            kind = PhysicsInfoKind::FullPhysics;
            count = buffer.read::<u32>();
        } else {
            panic!("Invalid physics info kind");
        }

        let buffer_start_offset = buffer.offset;
        
        Self {
            buffer,
            buffer_start_offset,
            physics_info_kind: kind,
            physics_world_id,
            kinematic_shared_physics_world_ids,
            model_initial_world_matrix,
            force_disable_offset_for_constraint_frame,
            count,
        }
    }

    pub(crate) fn physics_info_kind(&self) -> PhysicsInfoKind {
        self.physics_info_kind
    }

    pub(crate) fn physics_world_id(&self) -> u32 {
        self.physics_world_id
    }

    pub(crate) fn take_kinematic_shared_physics_world_ids(&mut self) -> Vec<u32> {
        std::mem::take(&mut self.kinematic_shared_physics_world_ids)
    }

    pub(crate) fn model_initial_world_matrix(&self) -> &Mat4 {
        &self.model_initial_world_matrix
    }

    pub(crate) fn force_disable_offset_for_constraint_frame(&self) -> bool {
        self.force_disable_offset_for_constraint_frame
    }

    pub(crate) fn count(&self) -> u32 {
        self.count
    }

    pub(crate) fn enumerate(&mut self, mut f: impl FnMut(u32, RigidBodyMetadata)) {
        self.buffer.offset = self.buffer_start_offset;

        match self.physics_info_kind {
            PhysicsInfoKind::NoPhysics => { },
            PhysicsInfoKind::StripedRigidbodies => {
                for i in 0..self.count {
                    let bone_index = self.buffer.read::<i32>();
                    let physics_mode = self.buffer.read::<u8>();
                    self.buffer.offset += 3; // padding
                    f(i, RigidBodyMetadata {
                        bone_index,
                        collision_group: 0,
                        collision_mask: 0,
                        shape_type: 0,
                        shape_size: Vec4::ZERO,
                        shape_position: Vec3A::ZERO,
                        shape_rotation: Vec3A::ZERO,
                        mass: 0.0,
                        linear_damping: 0.0,
                        angular_damping: 0.0,
                        repulsion: 0.0,
                        friction: 0.0,
                        physics_mode,
                    });
                }
            },
            PhysicsInfoKind::FullPhysics => {
                for i in 0..self.count {
                    let bone_index = self.buffer.read::<i32>();
                    let collision_group = self.buffer.read::<u8>();
                    let shape_type = self.buffer.read::<u8>();
                    let collision_mask = self.buffer.read::<u16>();
                    let shape_size = Vec4::new(
                        self.buffer.read::<f32>(), 
                        self.buffer.read::<f32>(), 
                        self.buffer.read::<f32>(), 
                        self.buffer.read::<f32>()
                    );
                    let shape_position = self.buffer.read_vector();
                    let shape_rotation = self.buffer.read_vector();
                    let mass = self.buffer.read::<f32>();
                    let linear_damping = self.buffer.read::<f32>();
                    let angular_damping = self.buffer.read::<f32>();
                    let repulsion = self.buffer.read::<f32>();
                    let friction = self.buffer.read::<f32>();
                    let physics_mode = self.buffer.read::<u8>();
                    self.buffer.offset += 3; // padding
                    f(i, RigidBodyMetadata {
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
            },
        }
    }

    pub(crate) fn next(self) -> Option<JointMetadataReader<'a>> {
        match self.physics_info_kind {
            PhysicsInfoKind::NoPhysics => None,
            PhysicsInfoKind::StripedRigidbodies => None,
            PhysicsInfoKind::FullPhysics => {
                Some(JointMetadataReader::new(self.buffer))
            },
        }
    }
}

#[cfg(feature = "physics")]
pub(crate) struct JointMetadata {
    pub(crate) kind: u8,
    pub(crate) rigidbody_index_a: i32,
    pub(crate) rigidbody_index_b: i32,
    pub(crate) position: Vec3A,
    pub(crate) rotation: Vec3A,
    pub(crate) position_min: Vec3A,
    pub(crate) position_max: Vec3A,
    pub(crate) rotation_min: Vec3A,
    pub(crate) rotation_max: Vec3A,
    pub(crate) spring_position: Vec3A,
    pub(crate) spring_rotation: Vec3A,
}

#[cfg(feature = "physics")]
pub(crate) enum JointKind {
    Spring6Dof = 0,
    // SixDof = 1,
    // P2p = 2,
    // ConeTwist = 3,
    // Slider = 4,
    // Hinge = 5,
}

#[cfg(feature = "physics")]
pub(crate) struct JointMetadataReader<'a> {
    buffer: MetadataBuffer<'a>,
    count: u32,
}

#[cfg(feature = "physics")]
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

    pub(crate) fn enumerate(&mut self, mut f: impl FnMut(u32, JointMetadata)) {
        for i in 0..self.count {
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
            f(i, JointMetadata {
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
