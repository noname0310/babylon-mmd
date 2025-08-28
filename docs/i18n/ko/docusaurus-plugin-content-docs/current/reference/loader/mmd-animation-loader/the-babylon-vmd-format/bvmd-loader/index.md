---
sidebar_position: 2
sidebar_label: BVMD Loader
---

# BVMD Loader

This section explains how to load **Babylon VMD (BVMD)** animation files.

## BvmdLoader

You can use **`BvmdLoader`** to load **BVMD** files as **`MmdAnimation`** objects. **`BvmdLoader`** provides an interface almost identical to **`VmdLoader`**.

```typescript
const bvmdLoader = new BvmdLoader();
const mmdAnimation: MmdAnimation = await bvmdLoader.loadAsync("motion1", "path/to/motion1.bvmd");
```

The parameters received by the **`loadAsync`** method are as follows:

- **`name`**: The name of the animation.
- **`fileOrUrl`**: The URL of the BVMD file as a `string` or `File`.
- **`onProgress`**: A callback function that is called periodically with the loading progress.

Additionally, you can use the **`load`** method to load **BVMD** files with **`onLoad`** and **`onError`** callbacks.

You can also load **BVMD** files from an **`ArrayBuffer`** using the **`loadFromBuffer`** method.

```typescript
const arrayBuffer = await fetch("path/to/motion1.bvmd")
    .then(response => response.arrayBuffer());

const bvmdLoader = new BvmdLoader();
const mmdAnimation = bvmdLoader.loadFromBuffer("motion1", arrayBuffer);
```

Due to the efficient structure of the **BVMD** format, parsing time is very short, so **`loadFromBuffer`** doesn't provide an **`onProgress`** callback and is not an asynchronous operation.

Additionally, you can enable logging using **`BvmdLoader.loggingEnabled`**. The default value is `false`. When set to `false`, no logs are output.
