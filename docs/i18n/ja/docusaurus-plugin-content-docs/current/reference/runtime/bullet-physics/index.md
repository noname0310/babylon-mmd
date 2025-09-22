---
sidebar_position: 6
sidebar_label: バレット物理演算
---

# バレット物理演算

このセクションでは、babylon-mmdで**Bullet Physics**エンジンバインディングを使用する方法について説明します。

## Bullet Physics概要

babylon-mmdは、MMDモデルの物理シミュレーションに**Bullet Physics**エンジンを使用します。

Bullet Physicsエンジンは、**C++**で書かれた**オープンソース物理エンジン**で、衝突検出とリジッドボディダイナミクスシミュレーションをサポートします。

通常、このエンジンを使用するには、**emscripten**を使用してC++コードをWebAssembly (WASM)にコンパイルしたAmmo.jsライブラリを使用します。

しかし、babylon-mmdは**emscriptenを使用しない**という異なるアプローチを取ります。代わりに、FFIを通じてBullet PhysicsエンジンをRustソースコードに統合し、その後wasm-bindgenを使用してWASMにコンパイルします。

このプロセスでは、すべてのBullet Physicsバインディングコードが**手動で書かれ**、Ammo.jsと比較して**優れたパフォーマンス**を提供します。

## Bullet Physics統合フォーム

Bullet Physicsエンジンは、babylon-mmdに**2つの主要なフォーム**で統合されています。

### Bullet Physics JavaScriptバインディング

このバインディングにより、Bullet PhysicsエンジンをJavaScriptから直接呼び出すことができます。バインディングは`babylon-mmd/esm/Runtime/Optimized/Physics/Bind`ディレクトリにあります。

このアプローチを使用してMMDランタイムを作成するコードは以下の通りです：

```typescript
const mmdWasmInstance = await getMmdWasmInstance(new MmdWasmInstanceTypeMPR());
const physicsRuntime = new MultiPhysicsRuntime(mmdWasmInstance);
physicsRuntime.setGravity(new Vector3(0, -9.8 * 10, 0));
physicsRuntime.register(scene);

const mmdRuntime = new MmdRuntime(scene, new MmdBulletPhysics(physicsRuntime));
```

この場合、`MultiPhysicsRuntime`クラスは**複数のモデルの物理シミュレーションを並列処理する**オブジェクトで、シミュレーションを制御できます。

### MmdWasmPhysicsの使用

このアプローチは、Rustで書かれた`MmdWasmRuntime`からBullet Physicsエンジンを呼び出します。このメソッドは**JavaScriptに公開されたバインディングを使用せず**、Rustから直接Bullet Physicsエンジンを呼び出して、**FFIオーバーヘッドを削減**します。

このアプローチを使用してMMDランタイムを作成するコードは以下の通りです：

```typescript
const mmdWasmInstance = await getMmdWasmInstance(new MmdWasmInstanceTypeMPR());
const mmdRuntime = new MmdWasmRuntime(scene, new MmdWasmPhysics(mmdWasmInstance));
```

この場合でも、`MultiPhysicsRuntime`と似た`MmdWasmPhysicsRuntimeImpl`クラスを使用して物理シミュレーションを制御できます：

```typescript
const physicsRuntime = mmdRuntime.physics!.getImpl(MmdWasmPhysicsRuntimeImpl);
```

主な違いは、`MultiPhysicsRuntime`が**WASMリソースを直接所有**するのに対し、`MmdWasmPhysicsRuntimeImpl`は`MmdWasmRuntime`が所有する**WASMリソースを参照**することです。

## Bullet Physicsバインディングオブジェクトのメモリー管理

Bullet Physicsエンジンバインディングは、メモリーを管理するために**FinalizationRegistry**を使用します。

したがって、`babylon-mmd/esm/Runtime/Optimized/Physics/Bind`ディレクトリのバインディングコードを直接使用する場合、**メモリーは自動的に解放**されます。

メモリー管理を手動で制御したい場合は、`dispose()`メソッドを呼び出してメモリーを明示的に解放できます。

```typescript
const rigidBody = new RigidBody(physicsRuntime, rbInfo);
// rigidBodyを使用
rigidBody.dispose(); // メモリーを明示的に解放
```

## Bullet Physics APIの使用

`babylon-mmd/esm/Runtime/Optimized/Physics/Bind`ディレクトリのBullet Physicsバインディングコードは、MMDモデルに関連しない**一般的な物理シミュレーション**にも使用できます。

以下は、Bullet Physicsバインディングを使用してキューブを地面に落下させる簡単な例です：

```typescript
const mmdWasmInstance = await getMmdWasmInstance(new MmdWasmInstanceTypeSPR());
const physicsRuntime = new NullPhysicsRuntime(mmdWasmInstance);
const physicsWorld = new PhysicsWorld(physicsRuntime);

// create ground mesh
const ground = CreatePlane("ground", { size: 120 }, scene);
ground.rotationQuaternion = Quaternion.RotationAxis(new Vector3(1, 0, 0), Math.PI / 2);

// create ground rigid body with static plane shape
const groundShape = new PhysicsStaticPlaneShape(runtime, new Vector3(0, 0, -1), 0);
const groundRbInfo = new RigidBodyConstructionInfo(wasmInstance);
groundRbInfo.shape = groundShape;
groundRbInfo.setInitialTransform(ground.getWorldMatrix());
groundRbInfo.motionType = MotionType.Static;

const groundRigidBody = new RigidBody(runtime, groundRbInfo);
world.addRigidBody(groundRigidBody);

// create box mesh
const baseBox = CreateBox("box", { size: 2 }, scene);
baseBox.position = new Vector3(0, 20, 0);
baseBox.rotationQuaternion = Quaternion.Identity();

// create box rigid body with box shape
const boxShape = new PhysicsBoxShape(runtime, new Vector3(1, 1, 1));
const boxRbInfo = new RigidBodyConstructionInfo(wasmInstance);
boxRbInfo.shape = boxShape;
boxRbInfo.setInitialTransform(baseBox.getWorldMatrix());
boxRbInfo.motionType = MotionType.Dynamic;

// create box rigid body
const boxRigidBody = new RigidBody(runtime, boxRbInfo);
world.addRigidBody(boxRigidBody);

const matrix = new Matrix();

// register onBeforeRenderObservable to update physics simulation
scene.onBeforeRenderObservable.add(() => {
    world.stepSimulation(1 / 60, 10, 1 / 60);

    boxRigidBody.getTransformMatrixToRef(matrix);
    matrix.getTranslationToRef(baseBox.position);
    Quaternion.FromRotationMatrixToRef(matrix, baseBox.rotationQuaternion!);
});
```

Bullet Physicsバインディングは**いくつかのコンポーネント**で構成されており、状況に応じて必要なコンポーネントのみを選択して使用できます。

- `PhysicsShape`：物理シミュレーションで使用される衝突シェイプを表すクラス。
  - Bullet Physicsの`btCollisionShape`に対応。
- `RigidBody`：物理シミュレーションで使用されるリジッドボディを表すクラス。
  - Bullet Physicsの`btRigidBody`に対応。
- `RigidBodyConstructionInfo`：リジッドボディ作成のための情報を含むクラス。
  - Bullet Physicsの`btRigidBody::btRigidBodyConstructionInfo`に対応。
- `Constraint`：物理シミュレーションで使用されるコンストレイントを表すクラス。
  - Bullet Physicsの`btTypedConstraint`に対応。
- `PhysicsWorld`：物理シミュレーションを管理するクラス。
  - Bullet Physicsの`btDynamicsWorld`に対応。
- `PhysicsRuntime`：バッファード評価を処理するロジックを含む`PhysicsWorld`のラッパークラス。

### フィジックスシェイプ

フィジックスシェイプは、物理シミュレーションで使用される衝突シェイプを表すクラスです。

babylon-mmdは以下のフィジックスシェイプクラスを提供します：

- `PhysicsBoxShape`：ボックス衝突シェイプを表すクラス。
  - Bullet Physicsの`btBoxShape`に対応。
- `PhysicsSphereShape`：スフィア衝突シェイプを表すクラス。
  - Bullet Physicsの`btSphereShape`に対応。
- `PhysicsCapsuleShape`：カプセル衝突シェイプを表すクラス。
  - Bullet Physicsの`btCapsuleShape`に対応。
- `PhysicsStaticPlaneShape`：無限プレーン衝突シェイプを表すクラス。
  - Bullet Physicsの`btStaticPlaneShape`に対応。

Bullet Physicsは他にも多くのフィジックスシェイプをサポートしていますが、babylon-mmdでは**MMDモデルに必要な衝突シェイプバインディングのみ**を実装しています。

### リジッドボディ

リジッドボディは、物理シミュレーションで使用されるリジッドボディを表します。

リジッドボディクラスを作成するには、`RigidBodyConstructionInfo`オブジェクトを使用して**初期化する必要**があります。

リジッドボディクラスは**2つのタイプのインプリメンテーション**で提供されます：
- `RigidBody`：単一のリジッドボディオブジェクトを表すクラス。
- `RigidBodyBundle`：複数のリジッドボディオブジェクトを単一のオブジェクトとしてバンドルして処理できるクラス。

`RigidBodyBundle`クラスは、複数のリジッドボディオブジェクトを一度に作成する際にリジッドボディオブジェクト間のメモリーローカリティを改善することで**優れたパフォーマンス**を提供します。

`RigidBodyBundle`を効率的に初期化するために、`RigidBodyConstructionInfoList`クラスも提供されています。

`RigidBodyConstructionInfoList`クラスは、複数のRigidBodyConstructionInfoオブジェクトを単一のオブジェクトとしてバンドルして処理できるクラスです。

以下は`RigidBodyBundle`を使用する例です：

```typescript
const boxShape = new PhysicsBoxShape(runtime, new Vector3(1, 1, 1));

const rbCount = 10;
const rbInfoList = new RigidBodyConstructionInfoList(wasmInstance, rbCount);
for (let k = 0; k < rbCount; ++k) {
    rbInfoList.setShape(k, boxShape);
    const initialTransform = Matrix.TranslationToRef(xOffset, 1 + k * 2, zOffset, matrix);
    rbInfoList.setInitialTransform(k, initialTransform);
    rbInfoList.setFriction(k, 1.0);
    rbInfoList.setLinearDamping(k, 0.3);
    rbInfoList.setAngularDamping(k, 0.3);
}
const boxRigidBodyBundle = new RigidBodyBundle(runtime, rbInfoList);
world.addRigidBodyBundle(boxRigidBodyBundle, worldId);
```

### コンストレイント

コンストレイントは、物理シミュレーションで使用されるコンストレイントを表します。

babylon-mmdは以下のコンストレイントクラスを提供します：

- `Generic6DofConstraint`：6自由度コンストレイントを表すクラス。
  - Bullet Physicsの`btGeneric6DofConstraint`に対応。
- `Generic6DofSpringConstraint`：スプリング付き6自由度コンストレイントを表すクラス。
  - Bullet Physicsの`btGeneric6DofSpringConstraint`に対応。

Bullet Physicsは他にも多くのコンストレイントをサポートしていますが、babylon-mmdでは**MMDモデルに必要なコンストレイントバインディングのみ**を実装しています。

### フィジックスワールド

フィジックスワールドは、物理シミュレーションを管理するクラスです。

フィジックスワールドクラスは**2つのタイプのインプリメンテーション**で提供されます：
- `PhysicsWorld`：単一の物理シミュレーションワールドを表すクラス。
- `MultiPhysicsWorld`：複数の物理シミュレーションワールドを並列処理するクラス。
  - 各ワールド間の相互作用のためのAPIが提供されています。

リジッドボディとコンストレイントオブジェクトは、物理シミュレーションに参加するために、フィジックスワールドまたはマルチフィジックスワールドオブジェクトに**追加する必要**があります。

### フィジックスランタイム

フィジックスランタイムは、**バッファード評価**を処理するロジックを含むフィジックスワールドのラッパークラスです。

フィジックスランタイムクラスは**3つのタイプのインプリメンテーション**で提供されます：

- `NullPhysicsRuntime`：ランタイムなしでフィジックスワールドを使用するためのクラス。
- `PhysicsRuntime`：フィジックスワールドを処理するクラス。
- `MultiPhysicsRuntime`：マルチフィジックスワールドを処理するクラス。

`PhysicsRuntime`と`MultiPhysicsRuntime`クラスはバッファード評価をサポートします。これは、**マルチスレッディングが可能な**環境で`PhysicsRuntime.evaluationType`プロパティが`PhysicsRuntimeEvaluationType.Buffered`に設定された場合、物理シミュレーションが**別のワーカースレッド**で処理されることを意味します。

```typescript
physicsRuntime.evaluationType = PhysicsRuntimeEvaluationType.Buffered;
```

:::info
`PhysicsWorld`または`MultiPhysicsWorld`オブジェクトは、ロックを使用した適切な同期処理のタスクを実行しますが、これを直接実装することは**非常に困難**です。

したがって、バッファード評価を使用する際にランタイムなしで`NullPhysicsRuntime`を使用して物理シミュレーションを制御することは**非常に複雑なタスク**であり、推奨されません。
:::

:::info
MMDランタイムと互換性のあるフィジックスランタイムは`MultiPhysicsRuntime`であり、他のフィジックスランタイムはMMDランタイムと**互換性がありません**。
:::

## 追加リソース

Bullet Physicsバインディングは、最初に`babylon-bulletphysics`リポジトリで開発され、後にbabylon-mmdに統合されました。

したがって、`babylon-bulletphysics`リポジトリでBullet Physicsバインディングの[より多くの例とテストコード](https://github.com/noname0310/babylon-bulletphysics/tree/main/src/Test/Scene)を確認できます。
