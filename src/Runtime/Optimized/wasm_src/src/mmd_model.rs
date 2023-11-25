use crate::{mmd_runtime_bone::MmdRuntimeBone, mmd_model_metadata::{MetadataBuffer, BoneMetadataReader}, append_transform_solver::AppendTransformSolver, ik_solver::IkSolver};

pub(crate) struct MmdModel {
    bone_arena: Box<[MmdRuntimeBone]>,
    sorted_runtime_bones: Box<[usize]>,
    sorted_runtime_root_bones: Box<[usize]>,
    bone_stack: Vec<usize>,
}

impl MmdModel {
    pub fn new(buffer: MetadataBuffer) -> Self {
        let reader = BoneMetadataReader::new(buffer);

        let mut arena: Vec<MmdRuntimeBone> = Vec::with_capacity(reader.count() as usize);
        for _ in 0..reader.count() {
            arena.push(MmdRuntimeBone::new());
        }
        let mut arena = arena.into_boxed_slice();
        
        let reader = reader.enumerate(|i, metadata| {
            let i = i as usize;

            arena[i].rest_position = metadata.rest_position;

            if 0 <= metadata.parent_bone_index && metadata.parent_bone_index < arena.len() as i32 {
                let parent_bone = &mut arena[metadata.parent_bone_index as usize];
                parent_bone.child_bones.push(i);
                let bone = &mut arena[i];
                bone.parent_bone = Some(metadata.parent_bone_index as usize);
            }
            
            if let Some(append_transform) = metadata.append_transform {
                let target_bone_index = append_transform.parent_index;
                if 0 <= target_bone_index && target_bone_index < arena.len() as i32 {
                    let append_transform_solver = Some(AppendTransformSolver::new(
                        target_bone_index as usize,
                        metadata.flag,
                        append_transform.ratio,
                    ));
                    let bone = &mut arena[i];
                    bone.append_transform_solver = append_transform_solver;
                } else {
                    // todo diagnostic
                    panic!();
                }
            }

            if let Some(ik) = metadata.ik {
                if 0 <= ik.target && ik.target < arena.len() as i32 {
                    let mut ik_solver = IkSolver::new(
                        i,
                        ik.target as usize,
                        ik.links.len(),
                    );
                    ik_solver.iteration = ik.iteration;
                    ik_solver.limit_angle = ik.rotation_constraint;

                    for link in ik.links {
                        if 0 <= link.target && link.target < arena.len() as i32 {
                            ik_solver.add_ik_chain(
                                &mut arena,
                                link.target as usize,
                                link.limits,
                            );
                        } else {
                            // todo diagnostic
                            panic!();
                        }
                    }
                    arena[i].ik_solver = Some(ik_solver);
                } else {
                    // todo diagnostic
                    panic!();
                }
            }
        });

        unimplemented!()
    }

    pub fn bone_arena(&mut self) -> &mut [MmdRuntimeBone] {
        &mut self.bone_arena
    }

    pub fn update_world_matrix(&mut self, root: usize) {
        let stack = &mut self.bone_stack;
        stack.push(root);

        while let Some(bone) = stack.pop() {
            if let Some(parent_bone) = self.bone_arena[bone].parent_bone {
                let parent_world_matrix = self.bone_arena[parent_bone].world_matrix;

                let bone = &mut self.bone_arena[bone];
                bone.world_matrix = parent_world_matrix * bone.local_matrix;
            } else {
                let bone = &mut self.bone_arena[bone];
                bone.world_matrix = bone.local_matrix;
            }

            let bone = &self.bone_arena[bone];
            for child_bone in &bone.child_bones {
                stack.push(*child_bone);
            }
        }
    }
}
