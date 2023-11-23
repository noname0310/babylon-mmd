pub(crate) struct MmdMorphController {
    morph_index_map: Box<[Box<[usize]>]>,
    morph_weights: Box<[f32]>,
}
