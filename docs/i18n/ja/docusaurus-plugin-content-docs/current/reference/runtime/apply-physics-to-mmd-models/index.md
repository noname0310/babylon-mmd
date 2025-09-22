---
sidebar_position: 5
sidebar_label: MMDモデルに物理を適用
---

# MMDモデルに物理を適用

このセクションでは、MMDモデルに**物理シミュレーション**を適用する方法について説明します。

MMDモデルは**物理シミュレーション**をサポートしており、物理エンジンを使用してモデルのボーンに物理効果を適用できます。

babylon-mmdは、これを実装するための**様々なオプション**を提供します。各オプションの特性を確認し、使用シナリオに最も適したものを選択できます。

## 物理エンジンオプション

babylon-mmdは、MMD物理シミュレーションを処理するために**3つの物理エンジン**をサポートします：

- **Bullet Physics**：MMDで使用される物理エンジン。Rust wasm-bindgenを使用してWebAssemblyにコンパイルされ、babylon-mmdパッケージに含まれています。
- **Ammo.js**：Bullet PhysicsのEmscriptenベースのJavaScriptポート。EmscriptenでコンパイルされたWebAssemblyバイナリとして提供されます。
- **Havok Physics**：Babylon.jsでサポートされる商用物理エンジン。WebAssemblyバイナリとして提供されます。

MMDモデルに適用した場合の各物理エンジンの特性は以下の通りです：

| 物理エンジン   | パフォーマンス       | 安定性        | ポータビリティ      | 使いやすさ      |
|------------------|-------------------|------------------|------------------|------------------|
| Bullet Physics | ★★★★☆ - **最適化されたバインディング** | ★★★★★ - **優秀なMMD動作再現** | ★★★☆☆ - WebAssemblyをサポートする環境でのみ利用可能 | ★★★☆☆ - APIで開発者エクスペリエンスの配慮が相対的に少ない |
| Ammo.js | ★★★☆☆ - 自動生成バインディングによるパフォーマンス低下 | ★★★☆☆ - 良好なMMD動作再現、しかし相対的に高いクラッシュ可能性 | ★★★★★ - **asm.jsビルドを使用時、WebAssemblyサポートなしの環境でも使用可能** | ★★★★★ - **Babylon.jsとの良好な互換性と利便性** |
| Havok Physics | ★★★★★ - **最適化されたバインディング、より高速なエンジンパフォーマンス** | ★☆☆☆☆ - 悪いMMD動作再現、深刻な数値不安定性 | ★★★☆☆ - WebAssemblyをサポートする環境でのみ利用可能 | ★★★★★ - **Babylon.jsとの良好な互換性と利便性** |

以下、各物理エンジンの初期化方法について説明します。

### Bullet Physicsインプリメンテーション

Bullet Physicsエンジンを使用してMMD物理シミュレーションを処理できます。

このBullet Physicsエンジンは、C++からRustへの**FFIバインディング**後にWebAssemblyにコンパイルされ、babylon-mmdパッケージの一部として含まれています。

Ammo.jsとは**完全に独立したバインディング**で、**優れたパフォーマンスと安定性**を提供します。

以下は、Bullet Physicsエンジンを使用して`MmdRuntime`を作成するサンプルコードです：

```typescript
const mmdWasmInstance = await getMmdWasmInstance(new MmdWasmInstanceTypeSPR());
const physicsRuntime = new MultiPhysicsRuntime(mmdWasmInstance);
physicsRuntime.setGravity(new Vector3(0, -9.8 * 10, 0));
physicsRuntime.register(scene);

const mmdRuntime = new MmdRuntime(scene, new MmdBulletPhysics(physicsRuntime));
```

Bullet Physicsエンジンを使用するには、まずbabylon-mmdが提供する**WebAssemblyバイナリをロード**する必要があります。これは`getMmdWasmInstance()`ファンクションを使用して行うことができます。

ここで、**4つのWebAssemblyインスタンスタイプ**のうち1つを選択できます：
- `MmdWasmInstanceTypeSPR`：**シングルスレッド、フィジックス、リリースビルド**
- `MmdWasmInstanceTypeSPD`：**シングルスレッド、フィジックス、デバッグビルド**
- `MmdWasmInstanceTypeMPR`：**マルチスレッド、フィジックス、リリースビルド**
- `MmdWasmInstanceTypeMPD`：**マルチスレッド、フィジックス、デバッグビルド**

マルチスレッドバージョンは**`SharedArrayBuffer`**をサポートする環境でのみ動作します。環境に応じて適切なバイナリを選択してください。

上記の例では、**シングルスレッドリリースビルド**を使用しています。
```typescript
const mmdWasmInstance = await getMmdWasmInstance(new MmdWasmInstanceTypeSPR());
```

`MultiPhysicsRuntime`クラスは、Bullet Physicsエンジンを使用して物理シミュレーションを処理するランタイムクラスです。`MultiPhysicsRuntime`のインスタンスを作成した後、**重力ベクターを設定**し、`Scene`に**アップデートコールバックを登録**します。

```typescript
const physicsRuntime = new MultiPhysicsRuntime(mmdWasmInstance);
physicsRuntime.setGravity(new Vector3(0, -9.8 * 10, 0));
physicsRuntime.register(scene);
```

`MultiPhysicsRuntime`が提供する様々なメソッドを使用して、**重力の設定**や**リジッドボディやコンストレイントの直接追加**など、物理シミュレーションを制御できます。詳細については、[Bullet Physics](../bullet-physics)ドキュメントを参照してください。

:::info
`MmdWasmRuntime`を使用している場合は、代わりに`MmdWasmPhysics`を使用できます。

これは内部的に同じコードを使用しますが、**JavaScriptからWASMへのバインディング**レイヤーを排除し、**優れたパフォーマンス**を提供します。

```typescript
const mmdRuntime = new MmdWasmRuntime(mmdWasmInstance, scene, new MmdWasmPhysics(scene));

const physicsRuntime = mmdRuntime.physics!.getImpl(MmdWasmPhysicsRuntimeImpl);

// MMD WASMランタイムによって作成された物理ワールドの重力は
// デフォルトで(0, -9.8*10, 0)に設定されるため、このコードは省略可能です
physicsRuntime.setGravity(new Vector3(0, -9.8 * 10, 0));
```
:::

### Ammo.jsインプリメンテーション

Ammo.jsは、EmscriptenでコンパイルされたBullet Physicsエンジンの**JavaScriptポート**です。これを使用してMMD物理シミュレーションを処理できます。

以下は、Ammo.jsを使用して`MmdRuntime`を作成するサンプルコードです：

```typescript
import ammo from "babylon-mmd/esm/Runtime/Physics/External/ammo.wasm";

const physicsInstance = await ammo();
const physicsPlugin = new MmdAmmoJSPlugin(true, physicsInstance);
scene.enablePhysics(new Vector3(0, -9.8 * 10, 0), physicsPlugin);

const mmdRuntime = new MmdRuntime(scene, new MmdAmmoPhysics(scene));
```

babylon-mmdパッケージには、Emscriptenでコンパイルされた**Bullet Physics 3.25バージョン**が`ammo.wasm`バイナリとして含まれています。これは`"babylon-mmd/esm/Runtime/Physics/External/ammo.wasm"`パスからインポートできます。

:::info
Ammo.jsは特定のデータに対して**コンストレイントの不安定性問題**があるため、可能であればBullet Physicsエンジンの使用が推奨されます。
:::

Babylon.js PhysicsPluginV1インターフェースを使用してAmmo.js物理エンジンを管理することもできます。詳細については、[Babylon.js Physics](https://doc.babylonjs.com/legacy/physics/)ドキュメントを参照してください。

### Havok Physicsインプリメンテーション

**Havok Physicsエンジン**を使用してMMD物理シミュレーションを処理できます。

以下は、Havok Physicsエンジンを使用して`MmdRuntime`を作成するサンプルコードです：

```typescript
import havok from "@babylonjs/havok";

const physicsInstance = await havok();
const physicsPlugin = new HavokPlugin(true, physicsInstance);
scene.enablePhysics(new Vector3(0, -9.8 * 10, 0), havokPlugin);

const mmdRuntime = new MmdRuntime(scene, new MmdPhysics(scene));
```

:::info
Havok Physicsエンジンは**良好な数値安定性**を持たないため、MMD物理シミュレーションには**適さない可能性**があります。可能であればBullet Physicsエンジンの使用が推奨されます。
:::

Babylon.js PhysicsPluginV2インターフェースを使用してHavok Physicsエンジンを管理することもできます。詳細については、[Babylon.js Physics V2](https://doc.babylonjs.com/features/featuresDeepDive/physics/usingPhysicsEngine)ドキュメントを参照してください。

## MMDモデルの物理ビルド

上記の物理エンジンのいずれかで`MmdRuntime`インスタンスを作成した後、`buildPhysics`オプションを`true`に設定して`MmdModel`インスタンスを作成することで、MMDモデルで**物理シミュレーションを有効**にできます。

```typescript
const mmdModel = mmdRuntime.createMmdModel(mmdMesh, {
    buildPhysics: true
});
```

`buildPhysics`オプションが`true`に設定されると、MMDランタイムは**PMXファイルで定義された物理データ**に基づいて、MMDモデルのリジッドボディとコンストレイントを**自動的に作成**します。

## 物理ビルドオプション

物理を有効にして`MmdModel`インスタンスを作成する際、物理シミュレーションをカスタマイズするための**追加オプション**を渡すことができます。

```typescript
const mmdModel = mmdRuntime.createMmdModel(mmdMesh, {
    buildPhysics: {
        worldId: undefined,
        kinematicSharedWorldIds: [],
        disableOffsetForConstraintFrame: false
    }
});
```

利用可能なオプションは以下の通りです：
- `worldId`：物理シミュレーションの**カスタムワールドID**を指定できます。指定されない場合、新しいワールドIDが自動的に割り当てられます。
- `kinematicSharedWorldIds`：**キネマティックオブジェクトを共有する**ワールドIDの配列を指定できます。これは、複数のMMDモデル間でキネマティックオブジェクトを共有したい場合に便利です。
- `disableOffsetForConstraintFrame`：コンストレイントフレームのオフセットを無効にするかどうかを指定できます。モデルのコンストレイントが**正しく動作しない**場合、このオプションを`true`に設定してみてください。

### マルチワールド物理シミュレーション

まず、`worldId`と`kinematicSharedWorldIds`オプションは物理シミュレーションワールドを制御します。これらのオプションは**Bullet Physicsを物理バックエンドとして使用する場合にのみ有効**です。babylon-mmdのBullet Physics APIは、**複数の物理ワールド**を作成し、マルチスレッドで処理し、ワールド間で同期する機能を提供します。

デフォルトでは、MMDモデルが作成されるたびに、各モデルは**独自の独立した物理ワールド**を取得します。しかし、`worldId`オプションを使用して特定のIDを指定すると、そのIDの物理ワールドが既に存在する場合はそのワールドを再利用します。これにより、**複数のMMDモデルが同じ物理ワールドを共有**できます。

さらに、異なるワールド間でキネマティックオブジェクトを共有したい場合は、`kinematicSharedWorldIds`オプションを使用して共有するワールドIDのリストを指定できます。このオプションにより、異なるワールドに属するMMDモデルの**キネマティックボディ**が、それぞれのワールドで**相互作用**できるようになります。

### コンストレイント動作の修正

`disableOffsetForConstraintFrame`オプションは、MMDモデルのコンストレイントが**正しく動作しない**場合に使用されます。デフォルトでは、このオプションは`false`に設定されています。

MMDは**Bullet Physics バージョン2.75**を使用して物理シミュレーションを処理します。しかし、新しいBullet Physics バージョン3.25では、コンストレイントの動作が変更されており、一部のMMDモデルでコンストレイントが正しく動作しない問題が発生する可能性があります。

このオプションを`true`に設定すると、コンストレイントソルバーが**バージョン2.75と同じ方法**で動作し、これらの問題を解決できます。MMDモデルのコンストレイントが期待通りに動作しない場合は、このオプションを`true`に設定してみてください。

ただし、古いコンストレイントソルバーは**より深刻な数値不安定性**を持つ傾向があることに注意してください。
