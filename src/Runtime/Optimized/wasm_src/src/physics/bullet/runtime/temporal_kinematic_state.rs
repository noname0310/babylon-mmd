#[derive(Copy, Clone, PartialEq, Eq)]
pub(crate) enum TemporalKinematicState {
    Disabled = 0,
    Idle = 1,
    WaitForRestore = 2,
    Restoring = 3,
}
