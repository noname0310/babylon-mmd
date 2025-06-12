#[derive(Copy, Clone, PartialEq, Eq)]
pub(crate) enum TemporalKinematicState {
    Disabled = 0,
    Idle = 1,
    // WaitForChange = 2,
    WaitForTemporalChange = 3,
    // Changed = 4,
    WaitForRestore = 5,
}
