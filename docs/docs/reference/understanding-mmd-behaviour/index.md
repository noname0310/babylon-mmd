---
sidebar_position: 1
sidebar_label: Understanding MMD Behavior
---

# Understanding MMD Behavior

This section explains what information PMX, PMD, VMD, and VPD files contain respectively, how MMD interprets that information, and explores how babylon-mmd implements MMD's behavior.

Those who have some experience with MMD probably know roughly that PMX and PMD are files that store 3D models, VMD stores motion data, and VPD stores pose data.

However, we need to understand in detail exactly what information these files contain.
This is because babylon-mmd attempts to process the information provided by MMD files in the same way that MMD interprets them, and various features have been implemented based on this approach.
