// ref: https://github.com/RReverser/wasm-bindgen-rayon/blob/main/src/lib.rs

use wasm_bindgen::prelude::*;
use crossbeam_channel::{Receiver, Sender, bounded};

use rayon::{ThreadBuilder, ThreadPoolBuilder};

#[wasm_bindgen]
pub struct WorkerPoolBuilder {
    num_threads: usize,
    sender: Sender<ThreadBuilder>,
    receiver: Receiver<ThreadBuilder>,
}

#[wasm_bindgen]
impl WorkerPoolBuilder {
    pub(crate) fn new(num_threads: usize) -> Self {
        let (sender, receiver) = bounded::<ThreadBuilder>(num_threads);
        Self { 
            num_threads,
            sender,
            receiver
        }
    }

    #[wasm_bindgen(js_name = "receiver")]
    pub fn receiver(&self) -> *const Receiver<ThreadBuilder> {
        &self.receiver as *const Receiver<ThreadBuilder>
    }

    // This should be called by the JS side once all the Workers are spawned.
    // Important: it must take `self` by reference, otherwise
    // `start_worker_thread` will try to receive a message on a moved value.
    #[wasm_bindgen(js_name = "build")]
    pub fn build(&self) {
        ThreadPoolBuilder::new()
            .num_threads(self.num_threads)
            // We could use postMessage here instead of Rust channels,
            // but currently we can't due to a Chrome bug that will cause
            // the main thread to lock up before it even sends the message:
            // https://bugs.chromium.org/p/chromium/issues/detail?id=1075645
            .spawn_handler(move |thread| {
                // Note: `send` will return an error if there are no receivers.
                // We can use it because all the threads are spawned and ready to accept
                // messages by the time we call `build()` to instantiate spawn handler.
                self.sender.send(thread).unwrap_throw();
                Ok(())
            })
            .build_global()
            .unwrap();
    }
}

pub(crate) fn worker_entry(receiver: *const Receiver<ThreadBuilder>)
where
    // Statically assert that it's safe to accept `Receiver` from another thread.
    Receiver<ThreadBuilder>: Sync,
{
    // This is safe, because we know it came from a reference to PoolBuilder,
    // allocated on the heap by wasm-bindgen and dropped only once all the
    // threads are running.
    //
    // The only way to violate safety is if someone externally calls
    // `exports.worker_entry(garbageValue)`, but then no Rust tools
    // would prevent us from issues anyway.
    let receiver = unsafe { &*receiver };
    receiver.recv().unwrap().run();
}
