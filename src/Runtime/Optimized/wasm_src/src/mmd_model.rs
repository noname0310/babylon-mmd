use crate::{mmd_runtime_bone::{MmdRuntimeBone, MmdRuntimeBoneArena}, mmd_model_metadata::{MetadataBuffer, BoneMetadataReader, BoneFlag}, append_transform_solver::{AppendTransformSolver, AppendTransformSolverArena}, ik_solver::{IkSolver, IkSolverArena}, animation_arena::AnimationArena, mmd_morph_controller::MmdMorphController};

pub(crate) struct MmdModel {
    animation_arena: AnimationArena,
    bone_arena: MmdRuntimeBoneArena,
    append_transform_solver_arena: AppendTransformSolverArena,
    ik_solver_arena: IkSolverArena,
    morph_controller: MmdMorphController,
    sorted_runtime_bones: Box<[usize]>,
    sorted_runtime_root_bones: Box<[usize]>,
}

impl MmdModel {
    pub fn new(buffer: MetadataBuffer) -> Self {
        let reader = BoneMetadataReader::new(buffer);

        let mut bone_arena: Vec<MmdRuntimeBone> = Vec::with_capacity(reader.bone_count() as usize);
        for i in 0..reader.bone_count() {
            bone_arena.push(MmdRuntimeBone::new(i as usize));
        }
        let mut bone_arena = bone_arena.into_boxed_slice();

        let mut append_transform_solver_arena = Vec::with_capacity(reader.append_transform_count() as usize);
        let mut ik_solver_arena = Vec::with_capacity(reader.ik_count() as usize);
        
        let reader = reader.enumerate(|i, metadata| {
            let i = i as usize;

            {
                let bone = &mut bone_arena[i];
                bone.rest_position = metadata.rest_position;
                bone.transform_order = metadata.transform_order;
                bone.transform_after_physics = metadata.flag & BoneFlag::TransformAfterPhysics as u16 != 0;
            }

            if 0 <= metadata.parent_bone_index && metadata.parent_bone_index < bone_arena.len() as i32 {
                let parent_bone = &mut bone_arena[metadata.parent_bone_index as usize];
                parent_bone.child_bones.push(i);
                let bone: &mut MmdRuntimeBone = &mut bone_arena[i];
                bone.parent_bone = Some(metadata.parent_bone_index as usize);
            }
            
            if let Some(append_transform) = metadata.append_transform {
                let target_bone_index = append_transform.parent_index;
                if 0 <= target_bone_index && target_bone_index < bone_arena.len() as i32 {
                    let append_transform_solver = AppendTransformSolver::new(
                        target_bone_index as usize,
                        metadata.flag,
                        append_transform.ratio,
                    );
                    let bone = &mut bone_arena[i];
                    bone.append_transform_solver = Some(append_transform_solver_arena.len());
                    append_transform_solver_arena.push(append_transform_solver);
                } else {
                    // todo diagnostic
                    panic!();
                }
            }

            if let Some(ik) = metadata.ik {
                if 0 <= ik.target && ik.target < bone_arena.len() as i32 {
                    let mut ik_solver = IkSolver::new(
                        ik.iteration,
                        ik.rotation_constraint,
                        i,
                        ik.target as usize,
                        ik.links.len(),
                    );

                    for link in ik.links {
                        if 0 <= link.target && link.target < bone_arena.len() as i32 {
                            ik_solver.add_ik_chain(
                                &mut bone_arena,
                                link.target as usize,
                                link.limits,
                            );
                        } else {
                            // todo diagnostic
                            panic!();
                        }
                    }
                    bone_arena[i].ik_solver = Some(ik_solver_arena.len());
                    ik_solver_arena.push(ik_solver);
                } else {
                    // todo diagnostic
                    panic!();
                }
            }
        });
    
        let (morphs, reader) = reader.read();
        let animation_arena = AnimationArena::new(bone_arena.len(), ik_solver_arena.len(), morphs.len());
        let morph_controller = MmdMorphController::new(morphs.into_boxed_slice());

        let reader = reader.for_each(|_metadata| {
            // todo add physics
        });

        reader.for_each(|_metadata| {
            // todo add physics
        });

        let mut sorted_runtime_bones = Vec::with_capacity(bone_arena.len());
        for i in 0..bone_arena.len() {
            sorted_runtime_bones.push(i);
        }
        sorted_runtime_bones.sort_by(|a, b| {
            let a = &bone_arena[*a];
            let b = &bone_arena[*b];
            a.transform_order.cmp(&b.transform_order)
        });

        let mut sorted_runtime_root_bones = Vec::with_capacity(bone_arena.len());
        for i in 0..bone_arena.len() {
            let bone = &bone_arena[sorted_runtime_bones[i]];
            if bone.parent_bone.is_none() {
                sorted_runtime_root_bones.push(i);
            }
        }

        let mut bone_max_depth = 0;
        for root in sorted_runtime_root_bones.iter() {
            fn calc_depth(bone_arena: &[MmdRuntimeBone], bone: usize, depth: usize) -> usize {
                let bone = &bone_arena[bone];
                let mut max_depth = depth;
                for child_bone in &bone.child_bones {
                    max_depth = max_depth.max(calc_depth(bone_arena, *child_bone, depth + 1));
                }
                max_depth
            }
            bone_max_depth = bone_max_depth.max(calc_depth(&bone_arena, sorted_runtime_bones[*root], 1));
        }

        MmdModel {
            animation_arena,
            bone_arena: MmdRuntimeBoneArena::new(bone_arena, Vec::with_capacity(bone_max_depth)),
            append_transform_solver_arena: AppendTransformSolverArena::new(append_transform_solver_arena.into_boxed_slice()),
            ik_solver_arena: IkSolverArena::new(ik_solver_arena.into_boxed_slice()),
            morph_controller,
            sorted_runtime_bones: sorted_runtime_bones.into_boxed_slice(),
            sorted_runtime_root_bones: sorted_runtime_root_bones.into_boxed_slice(),
        }
    }

    pub fn animation_arena(&mut self) -> &mut AnimationArena {
        &mut self.animation_arena
    }

    pub fn bone_arena(&mut self) -> &mut MmdRuntimeBoneArena {
        &mut self.bone_arena
    }

    pub fn before_physics(&mut self) {
        self.morph_controller.update(&mut self.bone_arena, self.animation_arena.morph_arena());
        self.update(false);
    }

    pub fn after_physics(&mut self) {
        self.update(true);
    }

    pub fn update_local_matrices(&mut self) {
        for bone in self.sorted_runtime_bones.iter() {
            let bone = &mut self.bone_arena[*bone];
            bone.update_local_matrix(&self.animation_arena, &self.append_transform_solver_arena);
        }
    }

    fn update(&mut self, after_physics_stage: bool) {
        for bone in self.sorted_runtime_bones.iter() {
            let bone = &mut self.bone_arena[*bone];
            if bone.transform_after_physics != after_physics_stage {
                continue;
            }

            bone.update_local_matrix(&self.animation_arena, &self.append_transform_solver_arena);
        }

        for i in 0..self.sorted_runtime_root_bones.len() {
            let bone_index = self.sorted_runtime_root_bones[i];
            let bone = &mut self.bone_arena[bone_index];
            if bone.transform_after_physics != after_physics_stage {
                continue;
            }

            self.bone_arena.update_world_matrix(bone_index);
        }

        for i in 0..self.sorted_runtime_bones.len() {
            let bone_index = self.sorted_runtime_bones[i];
            let bone = &self.bone_arena[bone_index];
            if bone.transform_after_physics != after_physics_stage {
                continue;
            }

            if let Some(append_transform_solver) = bone.append_transform_solver {
                self.append_transform_solver_arena.update(append_transform_solver, &self.animation_arena, &self.bone_arena);
                let bone = &mut self.bone_arena[bone_index];
                bone.update_local_matrix(&self.animation_arena, &self.append_transform_solver_arena);
                self.bone_arena.update_world_matrix(bone_index);
            }

            let bone = &self.bone_arena[bone_index];
            if let Some(ik_solver) = bone.ik_solver {
                if self.animation_arena.iksolver_state_arena()[ik_solver] != 0 {
                    let ik_solver = &mut self.ik_solver_arena[ik_solver];
                    ik_solver.solve(&self.animation_arena, &mut self.bone_arena, &self.append_transform_solver_arena);
                    self.bone_arena.update_world_matrix(bone_index);
                }
            }
        }

        for i in 0..self.sorted_runtime_root_bones.len() {
            let bone_index = self.sorted_runtime_root_bones[i];
            let bone = &mut self.bone_arena[bone_index];
            if bone.transform_after_physics != after_physics_stage {
                continue;
            }

            self.bone_arena.update_world_matrix(bone_index);
        }
    }
}
