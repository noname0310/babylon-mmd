---
sidebar_position: 1
sidebar_label: MMD Camera
---

# MMD Camera

This section describes the **`MmdCamera`** class and the **`IMmdCamera`** interface, which reproduce the camera behavior of MMD.

## MmdCamera class

![Orbit Camera](./orbit-camera.png)

The camera in MMD is an **Orbit Camera** that rotates around a center position.
The **`MmdCamera`** class reproduces this, and therefore the parameters for controlling the camera are as follows:

- **position** (Vector3) - Orbit center position
- **rotation** (Vector3) - Yaw Pitch Roll
- **distance** (number) - Distance from the Orbit center
- **fov** (number) - Field of view in radians

The **`MmdCamera`** class inherits from Babylon.js **`Camera`** class.

## IMmdCamera interface
