---
sidebar_position: 4
sidebar_label: マーテリアルモーフィングの有効化
---

# マーテリアルモーフィングの有効化

MMDモデルは**マーテリアルモーフィング**をサポートしており、これはアニメーションを通じてマーテリアルパラメータを制御できる機能です。

この機能は通常、アニメーションを通じてMMDモデルの一部をオンまたはオフにするために使用されます。

個別の完全なモジュールパスを使用する場合、この機能は**デフォルトで無効**ですが、`MmdModel`オブジェクトを作成する際にマーテリアルプロキシインプリメンテーションを渡すことで有効化できます。

```typescript
const mmdModel = mmdRuntime.createMmdModel(mmdMesh, {
    materialProxyConstructor: MmdStandardMaterialProxy
});
```

:::info
`babylon-mmd` パッケージルートは `RegisterMmdRuntimeSharedDefaultMaterialProxy()` を自動的に呼び出します。この関数は `MmdStandardMaterialProxy` をグローバルのデフォルトに設定し、互換性のあるモデルのマテリアルモーフィングを有効にします。

個別の完全なモジュールパスを使用しながら同じグローバルデフォルトを使用したい場合は、次のように明示的に呼び出します：

```typescript
import { RegisterMmdRuntimeSharedDefaultMaterialProxy } from "babylon-mmd/esm/Runtime/mmdRuntimeShared.pure";

RegisterMmdRuntimeSharedDefaultMaterialProxy();
```

モデルごとの挙動を明確にするには、上記のようにマテリアルプロキシを渡す方法を引き続き**推奨します**。
:::

## マーテリアルプロキシ

マーテリアルパラメータを操作する際、MMDランタイムは**マーテリアルに直接アクセスせず**、マーテリアルプロキシを通してアクセスします。

このアプローチにより、**任意のタイプのマーテリアル**を使用するMMDモデルでマーテリアルモーフィングのサポートが可能になります。

babylon-mmdは**2つのマーテリアルプロキシ**を提供しており、`IMmdMaterialProxy`インターフェースを実装するクラスを作成することで独自のものを実装することもできます。

- `MmdStandardMaterialProxy`：`MmdStandardMaterial`を使用するMMDモデル用のマーテリアルプロキシ
- `StandardMaterialProxy`：`StandardMaterial`を使用するMMDモデル用のマーテリアルプロキシ

:::warning
MMDモデルで使用されているマーテリアルと**互換性のない**マーテリアルプロキシを渡すと、ランタイムエラーが発生する可能性があります。
:::
