---
sidebar_position: 5
sidebar_label: The Babylon PMX format
---

# The Babylon PMX format

The **Babylon PMX (BPMX)** format is a variation of the **PMX** format that solves problems encountered when loading models in a web environment and provides improved performance.

## Single-File Format

Unlike the **PMX** format, the **BPMX** format stores all resources, including textures, in a single binary file.

This solves the problem of loading failures during the **Texture Resolution** process due to differences between URLs and file systems.

Additionally, the **BPMX** format performs some optimizations during the **PMX to BPMX** conversion process to improve loading speed.

## Not Compatible with Any Other Software

The **BPMX** format is a proprietary format designed by **babylon-mmd** and is not compatible with other 3D software such as **Blender** or **Unity**.

This is intentional, and as a result, converting **PMX** format to **BPMX** format can protect your assets.

## Usable for 3D Model Caching

Converting from **PMX** format to **BPMX** format is a simple way to serialize the **PMX** format without loss.

This allows you to cache **PMX** models in various storage locations such as the browser's **IndexedDB**, **Persistent Storage**, or a server.

:::info
The **BPMX** format is designed with asset protection and caching in mind, and it is not intended to be exposed to users.

For example, it is not the intended use for an application to require users to directly convert **PMX** files to **BPMX** files and upload them to the application.
:::

## Conclusion

The **BPMX** format is a variation of the **PMX** format, designed to solve model loading issues in a web environment, protect assets, and improve performance.

The next two sections explain how to utilize the **BPMX** format.

- [Convert PMX to BPMX format](./convert-pmx-to-bpmx-format) - Explains how to convert **PMX** files to **BPMX** files.
- [BPMX Loader](./bpmx-loader) - Explains how to load **BPMX** files.
