#[inline]
fn get_unchecked<T>(slice: &[T], index: u32) -> &T {
    #[cfg(debug_assertions)]
    {
        &slice[index as usize]
    }
    #[cfg(not(debug_assertions))]
    {
        unsafe { slice.get_unchecked(index as usize) }
    }
}

#[inline]
fn get_unchecked_mut<T>(slice: &mut [T], index: u32) -> &mut T {
    #[cfg(debug_assertions)]
    {
        &mut slice[index as usize]
    }
    #[cfg(not(debug_assertions))]
    {
        unsafe { slice.get_unchecked_mut(index as usize) }
    }
}

pub(crate) struct UncheckedSlice<'a, T> {
    slice: &'a [T],
}

impl<'a, T> UncheckedSlice<'a, T> {
    #[inline]
    pub(crate) fn new(slice: &'a [T]) -> Self {
        Self { slice }
    }

    #[inline]
    pub(crate) fn get(&self, index: u32) -> Option<&T> {
        self.slice.get(index as usize)
    }
}

impl<T> std::ops::Index<u32> for UncheckedSlice<'_, T> {
    type Output = T;

    #[inline]
    fn index(&self, index: u32) -> &Self::Output {
        get_unchecked(self.slice, index)
    }
}

impl<T> std::ops::Deref for UncheckedSlice<'_, T> {
    type Target = [T];

    #[inline]
    fn deref(&self) -> &Self::Target {
        self.slice
    }
}

pub(crate) struct UncheckedSliceMut<'a, T> {
    slice: &'a mut [T],
}

impl<'a, T> UncheckedSliceMut<'a, T> {
    #[inline]
    pub(crate) fn new(slice: &'a mut [T]) -> Self {
        Self { slice }
    }

    #[inline]
    pub(crate) fn get(&self, index: u32) -> Option<&T> {
        self.slice.get(index as usize)
    }

    #[inline]
    pub(crate) fn get_mut(&mut self, index: u32) -> Option<&mut T> {
        self.slice.get_mut(index as usize)
    }
}

impl<T> std::ops::Index<u32> for UncheckedSliceMut<'_, T> {
    type Output = T;

    #[inline]
    fn index(&self, index: u32) -> &Self::Output {
        get_unchecked(self.slice, index)
    }
}

impl<T> std::ops::IndexMut<u32> for UncheckedSliceMut<'_, T> {
    #[inline]
    fn index_mut(&mut self, index: u32) -> &mut Self::Output {
        get_unchecked_mut(self.slice, index)
    }
}

impl<T> std::ops::Deref for UncheckedSliceMut<'_, T> {
    type Target = [T];

    #[inline]
    fn deref(&self) -> &Self::Target {
        self.slice
    }
}

impl<T> std::ops::DerefMut for UncheckedSliceMut<'_, T> {
    #[inline]
    fn deref_mut(&mut self) -> &mut Self::Target {
        self.slice
    }
}
