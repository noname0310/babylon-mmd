use crate::mmd_model::MmdModel;

pub(crate) struct MmdRuntime {
    mmd_models: Vec<MmdModel>,
}

impl MmdRuntime {
    pub fn new() -> Self {
        MmdRuntime {
            mmd_models: Vec::new(),
        }
    }
}
