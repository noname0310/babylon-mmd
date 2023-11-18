use nalgebra::{UnitQuaternion, Vector3};

use crate::mmd_runtime_bone::MmdRuntimeBone;

struct IkChain<'a> {
    bone: &'a mut MmdRuntimeBone<'a>,
    minimum_angle: Option<Vector3<f32>>,
    maximum_angle: Option<Vector3<f32>>,
    prev_angle: Vector3<f32>,
    saved_ik_rotation: UnitQuaternion<f32>,
    plane_mode_angle: f32,
}

impl<'a> IkChain<'a> {
    fn new(
        bone: &'a mut MmdRuntimeBone<'a>,
        minimum_angle: Option<Vector3<f32>>,
        maximum_angle: Option<Vector3<f32>>,
    ) -> IkChain<'a> {
        IkChain {
            bone,
            minimum_angle,
            maximum_angle,
            prev_angle: Vector3::zeros(),
            saved_ik_rotation: UnitQuaternion::identity(),
            plane_mode_angle: 0.0,
        }
    }
}

pub(crate) struct IkSolver<'a> {
    pub enabled: bool,

    pub iteration: i32,
    pub limit_angle: f32,

    ik_bone: &'a mut MmdRuntimeBone<'a>,
    target_bone: &'a mut MmdRuntimeBone<'a>,
    ik_chains: Vec<IkChain<'a>>,
}

impl<'a> IkSolver<'a> {
    pub fn new(
        ik_bone: &'a mut MmdRuntimeBone<'a>,
        target_bone: &'a mut MmdRuntimeBone<'a>,
    ) -> IkSolver<'a> {
        IkSolver {
            enabled: true,
            iteration: 0,
            limit_angle: 0.0,
            ik_bone,
            target_bone,
            ik_chains: Vec::new(),
        }
    }

    pub fn add_ik_chain(
        &mut self,
        bone: &'a mut MmdRuntimeBone<'a>,
        minimum_angle: Option<Vector3<f32>>,
        maximum_angle: Option<Vector3<f32>>,
    ) {
        bone.ik_rotation = Some(UnitQuaternion::identity());
        let ik_chain = IkChain::new(bone, minimum_angle, maximum_angle);
        self.ik_chains.push(ik_chain);
    }

    pub fn solve(&mut self) {
        if !self.enabled {
            return;
        }

        self.ik_chains.iter_mut().for_each(|ik_chain| {
            ik_chain.prev_angle = Vector3::zeros();
            ik_chain.saved_ik_rotation = UnitQuaternion::identity();
            ik_chain.plane_mode_angle = 0.0;

            ik_chain.bone.update_local_matrix();
            ik_chain.bone.update_world_matrix();

        });

        
    }
}
