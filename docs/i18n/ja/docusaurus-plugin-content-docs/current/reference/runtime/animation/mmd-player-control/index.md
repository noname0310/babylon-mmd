---
sidebar_position: 3
sidebar_label: MMD Player Control
---

# MMD Player Control

This section explains how to **control MMD animations** using a GUI similar to a video player.

![playercontrol](@site/docs/reference/runtime/animation/mmd-player-control/playercontrol.png)

*This image shows an example of an MMD animation player configured with `MmdPlayerControl`. Model: YYB式初音ミク_10th_v1.02 by SANMUYYB*

## MmdPlayerControl

The `MmdPlayerControl` class provides a GUI for **controlling MMD animations**. This GUI includes features such as play, pause, frame navigation, volume control, and more.

```typescript
const playerControl = new MmdPlayerControl(scene, mmdRuntime, audioPlayer);
```

The `MmdPlayerControl` class takes **three arguments**:
- `scene`: A `Scene` object.
  - GUI HTML elements are added to `scene.getEngine().getInputElement()` of this scene.
  - The object's lifetime is **dependent on** the `Scene` object.
- `mmdRuntime`: An `IMmdRuntime` object.
  - Animations of this object are **controlled by** the `MmdPlayerControl`.
- `audioPlayer`: An audio player object implementing the `IPlayer` interface.
  - This argument is **optional**, and if not provided, audio volume control will be disabled.

### Methods

The `MmdPlayerControl` class provides the following methods:

- `dispose(): void`: Releases the `MmdPlayerControl` object. This method can be called **explicitly**, or it will be called **automatically** when the `Scene` object is released.

```typescript
playerControl.dispose();
```

- `showPlayerControl(): void`: **Displays** the player control GUI.

```typescript
playerControl.showPlayerControl();
```

- `hidePlayerControl(): void`: **Hides** the player control GUI.

```typescript
playerControl.hidePlayerControl();
```

Since the GUI is shown when the user hovers their cursor over it, the `showPlayerControl()` and `hidePlayerControl()` methods are **not typically used** by default.

:::warning
The `MmdPlayerControl` class is provided for **debugging purposes** and is **not designed** for use in production environments. Therefore, developing applications using this class is not recommended.

If you need a player control GUI for a production environment, it's best to **implement your own** by referencing the `MmdPlayerControl` class.
:::
