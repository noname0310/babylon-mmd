---
sidebar_position: 4
sidebar_label: Enable Material Morphing
---

# Enable Material Morphing

MMD models support **material morphing**, a feature that allows controlling material parameters through animation.

This feature is typically used to turn parts of the MMD model on and off through animation.

When using individual full module paths, this feature is **disabled by default**, but can be activated by passing a material proxy implementation when creating an `MmdModel` object.

```typescript
const mmdModel = mmdRuntime.createMmdModel(mmdMesh, {
    materialProxyConstructor: MmdStandardMaterialProxy
});
```

:::info
The `babylon-mmd` package root automatically calls `RegisterMmdRuntimeSharedDefaultMaterialProxy()`, which makes `MmdStandardMaterialProxy` the global default and enables material morphing for compatible models.

When using individual full module paths and you want the same global default, call it explicitly:

```typescript
import { RegisterMmdRuntimeSharedDefaultMaterialProxy } from "babylon-mmd/esm/Runtime/mmdRuntimeShared.pure";

RegisterMmdRuntimeSharedDefaultMaterialProxy();
```

For explicit per-model behavior, it is still **recommended to pass a material proxy** as shown above.
:::

## Material Proxy

When manipulating material parameters, the MMD runtime **doesn't access materials directly** but rather through a material proxy.

This approach enables support for material morphing on MMD models that use **any type of material**.

babylon-mmd provides **two material proxies**, and you can also implement your own by creating a class that implements the `IMmdMaterialProxy` interface.

- `MmdStandardMaterialProxy`: A material proxy for MMD models using `MmdStandardMaterial`
- `StandardMaterialProxy`: A material proxy for MMD models using `StandardMaterial`

:::warning
If you pass a material proxy that's **not compatible** with the materials used by the MMD model, runtime errors may occur.
:::
