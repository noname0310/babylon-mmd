---
sidebar_position: 1
sidebar_label: VMDからBVMDフォーマットへの変換
---

# VMDからBVMDフォーマットへの変換

このセクションでは、**VMD**ファイルを**BVMD**ファイルに変換する方法について説明します。

**VMD**ファイルを**BVMD**ファイルに変換するには、以下の2つの方法があります：

- ウェブアプリケーションを使用して変換する方法
- プログラムによって変換する方法

**どちらの方法も同じ結果が得られます。**

## コンバーターアプリケーションを使用する

**babylon-mmd**は**VMD**ファイルを**BVMD**ファイルに変換するためのウェブアプリケーションを提供しています。

以下のリンクからアプリケーションを使用できます。

[VMD to BVMD コンバーター](https://noname0310.github.io/babylon-mmd/vmd_converter/)

![コンバーターUI](@site/docs/reference/loader/mmd-animation-loader/the-babylon-vmd-format/convert-vmd-to-bvmd-format/bvmd-converter-ui.png)
***VMD to BVMD コンバーター**のスクリーンショット。*

1. **1つ以上のVMDファイルをドラッグ＆ドロップします。**
    - 複数の**VMD**ファイルをドロップした場合、それらはマージされ、最初にドロップされたファイルのキーフレームが優先されます。

2. **変換を実行します。**

## プログラムによる変換

**BVMD**変換は**`BvmdConverter`** クラスを使用して行われます。

**`BvmdConverter`** は**`MmdAnimation`** オブジェクトを入力として受け取り、それを**BVMD**フォーマットデータに変換します。

```typescript
const vmdLoader = new VmdLoader();
const mmdAnimation: MmdAnimation = await vmdLoader.loadAsync("path/to/your/file.vmd");

const arrayBuffer = BvmdConverter.Convert(mmdAnimation);
```

この方式はウェブアプリケーション版と全く同じように動作します。
