---
sidebar_position: 1
sidebar_label: Fix BMP テクスチャローダー
---

# Fix BMP テクスチャローダー

**BMPテクスチャを使用したモデルの読み込み**に問題が発生した場合は、このドキュメントを参照して問題を解決できます。

## 問題の診断

![不正確に読み込まれたBMPテクスチャの例](@site/docs/reference/loader/mmd-model-loader/fix-bmp-texture-loader/2025-08-14-211741.png)
*[MMDスクールオーディトリアムステージ](https://www.deviantart.com/maddoktor2/art/DL-MMD-School-Auditorium-Stage-665280215)ステージモデルからの**不正確に読み込まれたテクスチャ**の例。*

**BMPテクスチャ**を使用したモデルを読み込む際、**アルファチャンネルを持つBMPファイルが正しく表示されない**ケースがあります。

## 原因

この問題は、**ブラウザとMMDがBMPテクスチャファイルを読み込む方法の違い**によって発生します。（Babylon.jsはブラウザのBMPテクスチャ読み込み実装を使用しています。）

問題は、テクスチャにアルファチャンネルがあっても、**ブラウザがアルファチャンネルを無視してRGBチャンネルのみを読み取る**ことです。これにより**アルファチャンネルの損失**が発生します。

## 解決策

babylon-mmdは、BMPテクスチャを正しく読み込むための**追加処理を行うBMPテクスチャローダー**を提供しています。

これを使用するには、babylon-mmdのBMPテクスチャローダーをBabylon.jsのテクスチャローダーのグローバルステートに**登録する必要があります**。

```typescript
import { RegisterDxBmpTextureLoader } from "babylon-mmd/esm/Loader/registerDxBmpTextureLoader";

RegisterDxBmpTextureLoader();
```

**`RegisterDxBmpTextureLoader`関数は、babylon-mmdのBMPテクスチャローダー**をBabylon.jsのテクスチャローダーに登録します。この関数は**最初の呼び出し時にのみ有効**です。

:::info
この関数は、**インデックスをインポートすると実行されるサイドエフェクト**です。例：`import { MmdRuntime } from "babylon-mmd";`

したがって、**babylon-mmdのインデックスを一度でもインポートする**と、`DxBmpTextureLoader`はすでに登録されています。
:::

![正しく読み込まれたBMPテクスチャの例](@site/docs/reference/loader/mmd-model-loader/fix-bmp-texture-loader/2025-08-14-212535.png)
*MMDスクールオーディトリアムステージモデルからの**正しく読み込まれたテクスチャ**の例。*
