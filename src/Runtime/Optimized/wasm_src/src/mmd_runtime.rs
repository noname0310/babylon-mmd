use crate::mmd_model::MmdModel;

pub(crate) struct MmdRuntime {
    mmd_models: Vec<MmdModel>,
}

impl MmdRuntime {
    pub fn new() -> MmdRuntime {
        MmdRuntime {
            mmd_models: Vec::new(),
        }
    }

}
