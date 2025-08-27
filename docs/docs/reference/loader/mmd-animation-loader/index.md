---
sidebar_position: 2
sidebar_label: MMD Animation Loader (VmdLoader, VpdLoader)
---

# MMD Animation Loader (VmdLoader, VpdLoader)

This section explains the components used to load **MMD animation files** (**VMD**, **VPD**).

**MMD animations** can be loaded with **`VmdLoader`**, and pose data can also be loaded as animations using **`VpdLoader`**.

## VmdLoader

**`VmdLoader`** is used to load **Vocaloid Motion Data (VMD)** files, which are MMD animation file formats. This loader reads the animation data from VMD files and loads it in a way that can be applied to the babylon-mmd Runtime.

**`VmdLoader`** provides several methods that parse VMD files and return **`MmdAnimation`** instances, with the most basic method being **`loadAsync`**.

```typescript
const vmdLoader = new VmdLoader();
const mmdAnimation: MmdAnimation = vmdLoader.loadAsync("motion1", "path/to/motion1.vmd");
```

The parameters received by the **`loadAsync`** method are as follows:

- **`name`**: The name of the animation.
- **`fileOrUrl`**: The URL of the VMD file as a `string` or `string[]` or `File` or `File[]`.
  
An important point to note here is that we can receive multiple animation sources to create a single **`MmdAnimation`** instance. For example, multiple VMD files can be loaded into one **`MmdAnimation`**.

```typescript
const vmdLoader = new VmdLoader();
const mmdAnimation: MmdAnimation = vmdLoader.loadAsync("motion1", [
  "path/to/motion1.vmd",
  "path/to/motion2.vmd"
]);
```

In this case, the two motions are combined, with the motion that appears first in the array taking precedence. This means that if both motions have keyframes for the same frame, the keyframe from the motion that appears first in the array will be used.

You can also load using the browser's **File API**.

In addition, the following methods are provided:

- **`load`**: Loads VMD files synchronously, supporting onLoad and onError callbacks.
- **`loadFromBufferAsync`**/**`loadFromBuffer`**: Parses multiple **`ArrayBuffer`** instances to load an **`MmdAnimation`**.
- **`loadFromVmdDataAsync`**/**`loadFromVmdData`**: Loads an **`MmdAnimation`** from multiple **`VmdData`** instances.
- **`loadFromVmdObjectAsync`**/**`loadFromVmdObject`**: Loads an **`MmdAnimation`** from multiple **`VmdObject`** instances.

When we summarize all these methods, we can organize the input data formats supported by **`VmdLoader`** as follows:

- VMD files (**`File`** or **`File[]`**, **`string`** or **`string[]`**)
- ArrayBuffer (**`ArrayBuffer`** or **`ArrayBuffer[]`**)
- VMD data (**`VmdData`** or **`VmdData[]`**)
- VMD objects (**`VmdObject`** or **`VmdObject[]`**)

Here, **`VmdData`** and **`VmdObject`** are the following types:

- **`VmdData`**: A container type representing a buffer with VMD data
- **`VmdObject`**: A VMD data object that is lazily parsed

We can use these to explicitly call parsing methods to create an **`MmdAnimation`**:

```typescript
const arrayBuffer = await fetch("path/to/motion1.vmd")
    .then(response => response.arrayBuffer());

const vmdData = VmdData.CheckedCreate(arrayBuffer);
if (vmdData === null) {
    throw new Error("VMD data Validation failed");
}

const vmdObject = VmdObject.Parse(vmdData);

const vmdLoader = new VmdLoader();
vmdLoader.loadFromVmdObject("motion1", vmdObject);
```

By allowing all processes to be explicitly called and loaded in this way, babylon-mmd provides extensibility that enables modifications during the loading process or writing new logic to load into completely different containers.

In addition, **`VmdLoader`** provides the following options:

- **`VmdLoader.optimizeEmptyTracks`**: Sets whether to optimize and remove tracks that have no effect on the animation. The default is `true`.
- **`VmdLoader.loggingEnabled`**: Enables log output during the loading process. If the value is `false`, no logs are generated for any problems that occur. The default is `false`.

## VpdLoader

**`VpdLoader`** is used to load **Vocaloid Pose Data (VPD)** files, which are MMD pose data file formats. This loader reads the pose data from VPD files and loads it in a way that can be applied to the babylon-mmd Runtime.

**`VpdLoader`** also provides several methods that return **`MmdAnimation`** in a similar way to **`VmdLoader`**. The most basic method is **`loadAsync`**.

```typescript
const vpdLoader = new VpdLoader();
const mmdAnimation: MmdAnimation = vpdLoader.loadAsync("pose1", "path/to/pose1.vpd");
```

The animation created at this time is a one-frame animation.

Other load methods provided include:

- **`load`**: Loads VPD files synchronously, supporting onLoad and onError callbacks.
- **`loadFromBufferAsync`**/**`loadFromBuffer`**: Parses an **`ArrayBuffer`** instance to load an **`MmdAnimation`**.
- **`loadFromVpdObjectAsync`**/**`loadFromVpdObject`**: Loads an **`MmdAnimation`** from a **`VpdObject`** instance.

Unlike **`VmdLoader`**, **`VpdLoader`** does not support loading multiple VPD files at once.

The input data formats supported by **`VpdLoader`** are as follows:

- VPD files (**`File`** or **`string[]`**)
- ArrayBuffer (**`ArrayBuffer`**)
- VPD objects (**`VpdObject`**)

Here, **`VpdObject`** is an object that represents data parsed from a VPD file.

Unlike VMD, VPD files do not support Lazy Parsing, so VpdObject is represented as a javascript object, not a class.

Using this, we can explicitly call parsing methods to create an **`MmdAnimation`** as follows:

```typescript
const arrayBuffer = await fetch("path/to/pose1.vpd")
    .then(response => response.arrayBuffer());

const textDecoder = new TextDecoder("shift_jis");

const text = textDecoder.decode(arrayBuffer);

const vpdObject = VpdReader.Parse(text);

const vpdLoader = new VpdLoader();
vpdLoader.loadFromVpdObject("pose1", vpdObject);
```

In addition, you can enable log output during the loading process through the **`VpdLoader.loggingEnabled`** option. The default value of this option is `false`.

## MmdAnimation

Basically, **MMD animations** run in a separate animation runtime from the Babylon.js animation runtime. This is because the specification difference between MMD animations and the Babylon.js animation runtime is too large to integrate.

Therefore, the container for storing MMD animations also uses **`MmdAnimation`** provided by babylon-mmd instead of Babylon.js's **`Animation`** and **`AnimationGroup`** by default.

The properties of **`MmdAnimation`** are as follows:

|Property Name|Type|Description|
|---|---|---|
|**`name`**|**`string`**|Name of the animation|
|**`boneTracks`**|**`MmdBoneAnimationTrack[]`**|List of bone Position and Rotation animation tracks|
|**`movableBoneTracks`**|**`MmdMovableBoneAnimationTrack[]`**|List of bone Rotation animation tracks|
|**`morphTracks`**|**`MmdMorphAnimationTrack[]`**|List of Morph animation tracks|
|**`propertyTrack`**|**`MmdPropertyAnimationTrack`**|Visibility and Ik toggle animation track|
|**`cameraTrack`**|**`MmdCameraAnimationTrack`**|Camera animation track|

:::info
All animation tracks are represented by TypedArrays and are assumed to be immutable by default.

This is a constraint to facilitate optimization related to WebAssembly, which will be mentioned later. If you know it's safe to modify the data, you can modify the track values without any problems.
:::

A notable aspect of **`MmdAnimation`** is that the four track types representing model animation (**`boneTracks`**, **`movableBoneTracks`**, **`morphTracks`**, **`propertyTrack`**) and the **`cameraTrack`** representing camera animation are separated.

Therefore, when loading vmd animations, model animations and camera animations can be loaded into a single **`MmdAnimation`** instance.

```typescript
const vmdLoader = new VmdLoader();
const mmdAnimation: MmdAnimation = vmdLoader.loadAsync("motion1", [
    "path/to/model/anim.vmd",
    "path/to/camera/anim.vmd"
]);
```

In this case, the animation can later be applied to both MMD models and cameras.
