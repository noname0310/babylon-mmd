#[repr(u8)]
#[derive(Copy, Clone, PartialEq, Eq)]
pub(crate) enum TemporalKinematicState {
    // pre shifted by 4 bits for reduce computation
    
    Disabled = 0 << 4,
    Idle = 1 << 4,
    WaitForChange = 2 << 4,
    WaitForRestore = 3 << 4,
}

#[repr(u8)]
#[derive(Copy, Clone, PartialEq, Eq)]
pub(crate) enum KinematicToggleState {
    Disabled = 0,
    #[allow(dead_code)]
    Enabled = 1,
}

pub(crate) struct KinematicState {
    nibble_pair: u8
}

impl KinematicState {
    pub(crate) fn new(temporal_state: TemporalKinematicState, toggle_state: KinematicToggleState) -> Self {
        let mut state = KinematicState { nibble_pair: 0 };
        state.set_temporal_state(temporal_state);
        state.set_toggle_state(toggle_state);
        state
    }

    #[inline]
    pub(crate) fn set_temporal_state(&mut self, state: TemporalKinematicState) {
        self.nibble_pair = (self.nibble_pair & 0x0F) | (state as u8);
    }

    #[inline]
    pub(crate) fn get_temporal_state(&self) -> TemporalKinematicState {
        let value = self.nibble_pair & 0xF0;
        unsafe {
            std::mem::transmute::<u8, TemporalKinematicState>(value)
        }
    }

    #[inline]
    pub(crate) fn set_toggle_state(&mut self, state: KinematicToggleState) {
        self.nibble_pair = (self.nibble_pair & 0xF0) | (state as u8);
    }

    #[inline]
    pub(crate) fn get_toggle_state(&self) -> KinematicToggleState {
        let value = self.nibble_pair & 0x0F;
        unsafe {
            std::mem::transmute::<u8, KinematicToggleState>(value)
        }
    }
}
