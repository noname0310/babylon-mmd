---
sidebar_position: 4
sidebar_label: Enable Material Morphing
---

# Enable Material Morphing

MMD models support **material morphing**, a feature that allows controlling material parameters through animation.

This feature is typically used to turn parts of the MMD model on and off through animation.

This feature is **disabled by default** in babylon-mmd, but can be activated by passing a material proxy implementation when creating an `MmdModel` object.

```typescript
const mmdModel = mmdRuntime.createMmdModel(mmdMesh, {
    materialProxyConstructor: MmdStandardMaterialProxy
});
```

:::info
If you import the "babylon-mmd" package root, material morphing will be **automatically enabled** through side-effects.

While this is a convenience feature for ease of use, it's **recommended to explicitly enable** it by passing a material proxy as shown above.
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
