#[derive(Copy, Clone, PartialEq, Eq)]
pub(crate) enum TemporalKinematicState {
    Disabled = 0,
    Idle = 1,
    WaitForChange = 2,
    WaitForRestore = 3,
}
