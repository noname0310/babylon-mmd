---
sidebar_position: 3
sidebar_label: The Babylon VMD format
---

# The Babylon VMD format

This section explains the **Babylon VMD (BVMD)** format, which is a variation of the **VMD** format.

## Key Differences

The main differences from the original **VMD** format are as follows:

- **Smaller file size**: The **BVMD** format has about 3 times smaller file size.
- **Faster loading time**: The **BVMD** format has a structure that allows for very fast parsing.

These differences occur because the **VMD** format stores **bone binding information** for each keyframe when storing animation keyframe data, whereas the **BVMD** format stores keyframe information in tracks and stores bone binding information only once per track.

## Not Compatible with Any Other Software

Additionally, the **BVMD** format is designed by **babylon-mmd** and is not compatible with any other 3D software.

This is intentional, and as a result, you can protect your assets by converting the **VMD** format to the **BVMD** format.

:::info
The **BVMD** format is not designed to be exposed to users. Therefore, designs that require users to convert **VMD** format to **BVMD** for use in applications are not use cases intended by babylon-mmd.
:::

## Conclusion

The **BVMD** format is a variation of the **VMD** format with improved file size and loading time. Also, using the **BVMD** format can help protect your assets.

The following two sections explain how to utilize the **BVMD** format.

- [Convert VMD to BVMD format](./convert-vmd-to-bvmd-format) - Explains how to convert **VMD** format to **BVMD** format.
- [BVMD Loader](./bvmd-loader) - Explains how to load the **BVMD** format.
