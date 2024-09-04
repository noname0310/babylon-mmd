# Troubleshooting Shading Artifacts

See: [Quick Start/Troubleshooting Shading Artifacts](../../quick-start/troubleshooting-shading-artifacts/)

In this tutorial, we will only apply `SdefInjector.OverrideEngineCreateEffect`.

```typescript title="src/sceneBuilder.ts"
SdefInjector.OverrideEngineCreateEffect(engine);
```

Outline rendering has already been disabled on [Load BPMX Model](../load-bpmx-model/) page.

```typescript title="src/sceneBuilder.ts"
const materialBuilder = new MmdStandardMaterialBuilder();
materialBuilder.loadOutlineRenderingProperties = (): void => { /* do nothing */ };
```
