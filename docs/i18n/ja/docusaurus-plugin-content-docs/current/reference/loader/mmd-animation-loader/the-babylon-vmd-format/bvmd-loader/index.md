---
sidebar_position: 2
sidebar_label: BVMD ローダー
---

# BVMD ローダー

このセクションでは、**Babylon VMD (BVMD)** アニメーションファイルのロード方法について説明します。

## BvmdLoader

**`BvmdLoader`** を使用して、**BVMD** ファイルを **`MmdAnimation`** オブジェクトとしてロードできます。**`BvmdLoader`** は **`VmdLoader`** とほぼ同じインターフェースを提供します。

```typescript
const bvmdLoader = new BvmdLoader();
const mmdAnimation: MmdAnimation = await bvmdLoader.loadAsync("motion1", "path/to/motion1.bvmd");
```

**`loadAsync`** メソッドが受け取るパラメータは以下の通りです：

- **`name`**: アニメーションの名前。
- **`fileOrUrl`**: BVMD ファイルの URL を `string` または `File` として指定。
- **`onProgress`**: ロードの進行状況を定期的に通知するコールバック関数。

さらに、**`load`** メソッドを使用して、**`onLoad`** と **`onError`** コールバックを指定して **BVMD** ファイルをロードすることもできます。

また、**`loadFromBuffer`** メソッドを使用して **`ArrayBuffer`** から **BVMD** ファイルをロードすることも可能です。

```typescript
const arrayBuffer = await fetch("path/to/motion1.bvmd")
    .then(response => response.arrayBuffer());

const bvmdLoader = new BvmdLoader();
const mmdAnimation = bvmdLoader.loadFromBuffer("motion1", arrayBuffer);
```

**BVMD** フォーマットの効率的な構造により、パース時間は非常に短いため、**`loadFromBuffer`** は **`onProgress`** コールバックを提供せず、非同期操作でもありません。

また、**`BvmdLoader.loggingEnabled`** を使用してロギングを有効にすることができます。デフォルト値は `false` です。`false` に設定されている場合、ログは出力されません。
