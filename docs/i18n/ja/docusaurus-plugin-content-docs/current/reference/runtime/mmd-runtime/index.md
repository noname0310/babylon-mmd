---
sidebar_position: 2
sidebar_label: MMD ランタイム
---

# MMD ランタイム

## MmdRuntimeクラス

`MmdRuntime`は、babylon-mmdランタイムコンポーネントの**コアクラス**です。
`MmdRuntime`は、他のすべてのランタイムコンポーネントを参照し、制御して、MMDモデルにアニメーションを適用します。

`MmdRuntime`は以下の機能を提供します：
- **複数のMMDモデル**を同時に制御
- **複数のMMDカメラ**を同時に制御
- **カメラアニメーション**の適用
- **物理シミュレーション**の制御

`MmdRuntime`を作成するコードは以下の通りです：

```typescript
const mmdRuntime = new MmdRuntime(scene, null);
```

`MmdRuntime`のコンストラクタは2つの引数を取ります：
- `scene`：`Scene`オブジェクトが提供された場合、`MmdRuntime`のライフタイムは`Scene`オブジェクトに紐付けられます。つまり、`Scene`が破棄されると、`MmdRuntime`も**自動的に破棄**されます。`null`が提供された場合は、`MmdRuntime`の`dispose()`メソッドを**手動で呼び出す**必要があります。そうしないと**メモリーリーク**が発生する可能性があります。
- `physics`：物理シミュレーションインプリメンテーションを提供します。`null`が提供された場合、**物理シミュレーションは無効**になります。物理シミュレーションを有効にするには、`MmdBulletPhysics`、`MmdAmmoPhysics`、または`MmdPhysics`などの`IMmdPhysics`インターフェースを実装するクラスのインスタンスを提供する必要があります。

物理シミュレーションを処理するロジックは`MmdRuntime`に**含まれておらず**、**外部から注入**されることに注意してください。

この設計により、物理エンジンインプリメンテーションを**簡単に入れ替える**ことができ、独自の**カスタム物理エンジン**を実装し、使用するインプリメンテーションのみをバンドルして**バンドルサイズを削減**することが可能です。

### フレームアップデート

アニメーションを処理するには、アップデートファンクション`MmdRuntime.beforePhysics()`と`MmdRuntime.afterPhysics()`を**毎フレーム**呼び出す必要があります。

これら2つのメソッドは、物理シミュレーションが実行される**前と後**にそれぞれ呼び出される必要があります。

したがって、`MmdRuntime`を使用するアプリケーションは、次のようなフレームループを持つ必要があります：

```typescript
// sudo code for frame loop
for (; ;) {
    mmdRuntime.beforePhysics();
    simulatePhysics();
    mmdRuntime.afterPhysics();
    render();
}
```

これら2つのメソッドを毎フレーム呼び出す最も簡単な方法は、`Scene`の`onBeforeAnimationsObservable`と`onBeforeRenderObservable`イベントにコールバックを登録することです。

`MmdRuntime.register()`メソッドは`Scene`オブジェクトを引数として取り、内部的にこれら2つのイベントにコールバックを登録して、`beforePhysics()`と`afterPhysics()`が毎レンダリング時に**自動的に呼び出される**ようにします。

```typescript
mmdRuntime.register(scene);
```

`MmdRuntime`のアップデートを一時的に停止したい場合は、`MmdRuntime.unregister()`メソッドを呼び出して、登録されたコールバックを削除できます。

```typescript
mmdRuntime.unregister(scene);
```

### 再生制御

`MmdRuntime`のコア機能の1つは、MMDアニメーション再生の制御です。

`MmdRuntime`は、アニメーションを制御するための以下のメソッドを提供します：
- `playAnimation(): Promise<void>`：アニメーション再生を**開始**します。
- `pauseAnimation(): void`：アニメーション再生を**一時停止**します。
- `seekAnimation(frameTime: number, forceEvaluate: boolean = false): Promise<void>`：アニメーションを特定のフレームに**移動**します。`forceEvaluate`が`true`に設定されている場合、移動後すぐにアニメーションが評価されます。そうでない場合は、次の`beforePhysics(): void`呼び出し時に評価されます。
- `setManualAnimationDuration(frameTimeDuration: Nullable<number>): void`：アニメーションの総フレーム時間を**手動で設定**します。デフォルトでは、アニメーションの総長は、評価に参加するすべてのMMDアニメーションの中で最も長いものに自動的に設定されます。このメソッドは、複数のアニメーションクリップがある場合やアニメーションクリップがない場合に便利です。`null`が提供された場合、自動モードに戻ります。

`MmdRuntime`は、アニメーション状態をチェックするための以下のプロパティを提供します：
- `isAnimationPlaying: boolean`：アニメーションが**現在再生中**かどうかを示すブール値。
- `timeScale: number`：**アニメーション再生速度**を制御する数値。デフォルトは`1.0`。
- `currentFrameTime: number`：アニメーションの**現在のフレーム時間**を示す数値。
- `currentTime: number`：アニメーションの**現在時間**を秒単位で示す数値。
- `animationFrameTimeDuration: number`：アニメーションの**総フレーム時間長**を示す数値。
- `animationDuration: number`：アニメーションの**総長**を秒単位で示す数値。

:::info
`MmdRuntime`は内部的に時間を表現するために**フレーム時間**を使用します。MMDアニメーションは**秒間30フレーム**で再生されるため、1秒は30フレーム時間に対応します。例えば、`currentFrameTime`が`60`の場合、アニメーションが2秒間再生されたことを意味します。
:::

### アニメータブル

`MmdRuntime`は、**任意のアニメータブルオブジェクト**を制御する機能を提供します。

MMDモデルに対しては、`MmdRuntime`が**直接アニメーション計算を処理**しますが、MMDモデル以外のオブジェクトについては、各オブジェクトが**委任されて**独自のアニメーションを計算します。

これらのオブジェクトは`IMmdRuntimeAnimatable`インターフェースを実装する必要があり、`MmdRuntime`の`addAnimatable()`メソッドを通じて登録できます。

`IMmdRuntimeAnimatable`インターフェースを実装する典型的な例は、`MmdCamera`クラスです。

以下は、`MmdCamera`オブジェクトを`MmdRuntime`に登録し、アニメーションを再生するサンプルコードです：

```typescript
// initialize MmdRuntime
const mmdRuntime = new MmdRuntime(scene, null);
mmdRuntime.register(scene);

// load VMD animation
const vmdLoader = new VmdLoader();
const mmdAnimation = await vmdLoader.loadAsync("motion", "path/to/motion.vmd");

// create MmdCamera and set animation
const camera = new MmdCamera();
const runtimeAnimation = camera.createRuntimeAnimation(mmdAnimation);
camera.setRuntimeAnimation(runtimeAnimation);

// add MmdCamera to MmdRuntime and play animation
mmdRuntime.addAnimatable(camera);
mmdRuntime.playAnimation();
```

## MmdModelクラス

`MmdModel`は、MMDモデルを表すクラスです。`MmdModel`は、MMDモデルの**ルートメッシュ**（MMDメッシュとも呼ばれる）をラップし、モデルの**ボーン、モーフ、物理シミュレーション**などを制御するインターフェースを提供します。

`MmdModel`は基本的に`MmdRuntime`によって制御され、`MmdRuntime`の`createMmdModel()`または`createMmdModelFromSkeleton()`メソッドを通じて**のみ作成**できます。

以下は、PMXモデルをロードして`MmdModel`を作成するサンプルコードです：

```typescript
// initialize MmdRuntime
const mmdRuntime = new MmdRuntime(scene, null);
mmdRuntime.register(scene);

// load VMD animation
const vmdLoader = new VmdLoader();
const mmdAnimation = await vmdLoader.loadAsync("motion", "path/to/motion.vmd");

// load PMX model
const assetContainer = await LoadAssetContainerAsync("path/to/model.pmx", scene)
assetContainer.addAllToScene();
const rootMesh = assetContainer.meshes[0] as Mesh;

// create MmdModel and set animation
const mmdModel = mmdRuntime.createMmdModel(rootMesh);
const runtimeAnimation = mmdModel.createRuntimeAnimation(mmdAnimation);
mmdModel.setRuntimeAnimation(runtimeAnimation);

// play animation
mmdRuntime.playAnimation();
```

`MmdModel`インスタンスが作成された瞬間から、MMDメッシュの**様々なリソース**が`MmdModel`によって管理されます。これには`Mesh`、`Skeleton`、`Bone`、`Morph Target`、`Material`などが含まれます。

:::warning
`MmdModel`によって管理されるリソースを**直接アクセスしたり変更したりする**ことは**推奨されません**。
特に`Skeleton`については、`MmdModel`が内部的に計算メソッドをオーバーライドしているため、`MmdModel`によって管理される`Skeleton`や`Bone`オブジェクトのメソッドを直接呼び出すと、**予期しない動作**を引き起こす可能性があります。
:::

`MmdModel`を破棄すると、対応するMMDメッシュがランタイムから削除され、モデルによって管理されるすべてのリソースが解放されます。

```typescript
mmdRuntime.destroyMmdModel(mmdModel);
```

`MmdModel`オブジェクトの主なプロパティは以下の通りです：

- `mesh: MmdSkinnedMesh | TrimmedMmdSkinnedMesh`：MMDモデルの**ルートメッシュ**。
- `skeleton: IMmdLinkedBoneContainer`：MMDモデルの**スケルトン**。
- `worldTransformMatrices: Float32Array`：MMDモデルの**ワールドトランスフォームマトリックス**の配列。各ボーンのワールドトランスフォームマトリックスを含みます。
- `ikSolverStates: Uint8Array`：MMDモデルの**IKソルバー状態**の配列。各IKボーンのアクティベーション状態を含みます。
- `rigidBodyStates: Uint8Array`：MMDモデルの**リジッドボディ状態**の配列。各リジッドボディのアクティベーション状態を含みます。
- `runtimeBones: readonly IMmdRuntimeBone[]`：MMDモデルの**ボーン**を表す`MmdRuntimeBone`オブジェクトの配列。
- `morph: MmdMorphController`：MMDモデルの**モーフ**を制御する`MmdMorphController`オブジェクト。

### MmdModel作成オプション

`MmdRuntime`の`createMmdModel()`メソッドを使用して`MmdModel`を作成する際、**オプションオブジェクト**を第2引数として渡して、モデルの動作をカスタマイズできます。

```typescript
const mmdModel = mmdRuntime.createMmdModel(rootMesh, {
    materialProxyConstructor: null,
    buildPhysics: true,
    trimMetadata: true
});
```

オプションオブジェクトには以下のプロパティがあります：

- `materialProxyConstructor: Nullable<IMmdMaterialProxyConstructor<TMaterial>>`：マーテリアルプロキシのコンストラクタファンクション。提供された場合、MMDモデルの各マーテリアルに対してマーテリアルプロキシが作成され、マーテリアルパラメータの操作に使用されます。これにより**マーテリアルモーフィング**のサポートが可能になります。詳細については、[Enable Material Morphing](../enable-material-morphing)ドキュメントを参照してください。デフォルトは`null`です。
- `buildPhysics: IMmdModelPhysicsCreationOptions | boolean`：物理シミュレーション作成のオプション。`true`が提供された場合、MMDモデルのメタデータに基づいて**リジッドボディとコンストレイント**が作成されます。`IMmdModelPhysicsCreationOptions`タイプのオブジェクトが提供された場合、リジッドボディとコンストレイント作成のオプションを設定できます。詳細については、[Apply Physics To MMD Models](../apply-physics-to-mmd-models)ドキュメントを参照してください。デフォルトは`true`です。
- `trimMetadata: boolean`：`true`が提供された場合、MMDモデルの作成時にのみ使用される不要なメタデータが、モデル作成後に**MMDメッシュから削除**されます。これにより**メモリー使用量を削減**できます。ただし、後で同じMMDメッシュから`MmdModel`を再作成したい場合は、このオプションを`false`に設定する必要があります。デフォルトは`true`です。

### MmdRuntimeBoneクラス

`MmdRuntimeBone`は、**MMDモデルのボーン**を表すクラスです。Babylon.jsの`Bone`クラスをラップし、ボーンの**モーフ、IK、アペンドトランスフォーム**などを制御するインターフェースを提供します。

`MmdRuntimeBone`オブジェクトには、`MmdModel.runtimeBones`プロパティを通じてアクセスできます。

`MmdRuntimeBone`オブジェクトの主なプロパティは以下の通りです：

- `linkedBone: Bone`：`MmdRuntimeBone`によってラップされるBabylon.jsの`Bone`オブジェクト。
- `name: string`：ボーンの名前。
- `parentBone: Nullable<MmdRuntimeBone>`：親ボーン。ルートボーンの場合は`null`。
- `childBones: readonly MmdRuntimeBone[]`：子ボーンの配列。
- `transformOrder: number`：ボーンのトランスフォーム順序。
- `flag: number`：PMXボーンフラグ値。
- `transformAfterPhysics: boolean`：物理シミュレーション後にトランスフォームが適用されるかどうか。
- `worldMatrix: Float32Array`：ボーンのワールドトランスフォームマトリックス。これは`MmdModel.worldTransformMatrices`配列の一部を参照します。
- `ikSolverIndex: number`：ボーンのIKソルバーインデックス。IKボーンでない場合は`-1`。`MmdModel.ikSolverStates`配列を通じてボーンのIKアクティベーション状態をチェックできます。
- `rigidBodyIndices: readonly number[]`：ボーンに接続されたリジッドボディのインデックス配列。各リジッドボディのアクティベーション状態は`MmdModel.rigidBodyStates`配列を通じてチェックできます。

`MmdRuntimeBone`は以下のメソッドも提供します：

- `getWorldMatrixToRef(target: Matrix): Matrix`：ボーンの**ワールドトランスフォームマトリックス**を`target`マトリックスにコピーします。
- `getWorldTranslationToRef(target: Vector3): Vector3`：ボーンの**ワールド位置**を`target`ベクターにコピーします。
- `setWorldTranslation(source: DeepImmutable<Vector3>): void`：ボーンの**ワールド位置**を`source`ベクターに設定します。

`MmdRuntimeBone`のこれらのプロパティとメソッドは、ボーンの状態を**読み取りまたは設定**するために使用できます。

以下は、`MmdRuntimeBone`のメソッドを使用してMMDモデルのセンターボーンのワールド位置を出力するサンプルコードです：

```typescript
const meshWorldMatrix = mmdModel.mesh.getWorldMatrix();
const boneWorldMatrix = new Matrix();

const centerBone = mmdModel.runtimeBones.find(bone => bone.name === "センター")!;

// The bone world matrix is based on model space, so you need to multiply the mesh world matrix.
centerBone.getWorldMatrixToRef(boneWorldMatrix).multiplyToRef(meshWorldMatrix, boneWorldMatrix);

const centerPosition = new Vector3();
boneWorldMatrix.getTranslationToRef(centerPosition);

console.log(`Center bone world position: ${centerPosition.toString()}`);
```

### MmdMorphControllerクラス

`MmdMorphController`は、**MMDモデルのモーフ**を制御するクラスです。
`MmdMorphController`は、**バーテックスモーフ、ボーンモーフ、UVモーフ、マーテリアルモーフ**などを制御するインターフェースを提供します。

`MmdMorphController`オブジェクトには、`MmdModel.morph`プロパティを通じてアクセスできます。

`MmdMorphController`オブジェクトの主なメソッドは以下の通りです：

- `setMorphWeight(morphName: string, weight: number): void`：名前が`morphName`のモーフの**ウェイトを設定**し、`weight`にします。指定された名前のモーフが存在しない場合、何も起こりません。
- `getMorphWeight(morphName: string): number`：名前が`morphName`のモーフの**現在のウェイト**を返します。指定された名前のモーフが存在しない場合、`0`を返します。
- `getMorphIndices(morphName: string): readonly number[] | undefined`：名前が`morphName`のモーフの**インデックス配列**を返します。指定された名前のモーフが存在しない場合、`undefined`を返します。
- `setMorphWeightFromIndex(morphIndex: number, weight: number): void`：**インデックス**`morphIndex`のモーフのウェイトを`weight`に設定します。指定されたインデックスのモーフが存在しない場合、何も起こりません。
- `getMorphWeightFromIndex(morphIndex: number): number`：**インデックス**`morphIndex`のモーフの現在のウェイトを返します。指定されたインデックスのモーフが存在しない場合、`undefined`を返します。
- `getMorphWeights(): Readonly<ArrayLike<number>>`：すべてのモーフの**ウェイト配列**を返します。
- `resetMorphWeights(): void`：すべてのモーフのウェイトを`0`に**初期化**します。
- `update(): void`：モーフの**状態を更新**します。通常は`MmdRuntime`によって自動的に呼び出されるため、直接呼び出す必要はありません。

:::info
デフォルトでは、`MmdMorphController`は**内部的にインデックス**を使用してモーフを制御します。そのため、モーフ名を使用してウェイトを設定または取得するメソッドは、内部的に名前をインデックスに変換するため、**パフォーマンスが重要な状況**では、**インデックスを直接使用する**メソッドを使用する方が良いでしょう。
:::

## フィジックス

`MmdRuntime`は、物理シミュレーションのために注入された**外部の物理エンジン**インプリメンテーションを使用します。babylon-mmdは**3つの物理エンジンインプリメンテーション**を提供します：
- `MmdBulletPhysics`：**Bullet Physics**エンジンを使用します。Bullet PhysicsはC++で書かれた物理エンジンで、babylon-mmdは最適化された**WebAssemblyコンパイル版**を提供します。
- `MmdAmmoPhysics`：**Ammo.js**エンジンを使用します。
- `MmdPhysics`：**Havok Physics**エンジンを使用します。

`MmdRuntime`で物理シミュレーションを有効にするには、`MmdRuntime`作成時にこれらのクラスのいずれかのインスタンスを提供する必要があります。

物理シミュレーション設定の詳細については、[Apply Physics To MMD Models](../apply-physics-to-mmd-models)ドキュメントを参照してください。

## WebAssemblyインプリメンテーション

`MmdRuntime`でのIKソルブ、アペンドトランスフォーム、モーフ処理は、すべて**TypeScript**で実装され、ブラウザのJavaScriptエンジンによって処理されます。

babylon-mmdは、**より高速なパフォーマンス**のために**WebAssembly (WASM)**で実装された`MmdWasmRuntime`も提供します。`MmdWasmRuntime`は`MmdRuntime`とほぼ同じAPIを提供し、IKソルブ、アペンドトランスフォーム、モーフ、物理シミュレーションをWebAssemblyで処理して**優れたパフォーマンス**を実現します。

ただし、WASMインプリメンテーションは**任意にカスタマイズすることが困難**で、**特殊なランタイム環境**（例：React Native）では**制限される**可能性があります。

詳細については、[MMD WebAssembly Runtime](../mmd-webassembly-runtime)ドキュメントを参照してください。
