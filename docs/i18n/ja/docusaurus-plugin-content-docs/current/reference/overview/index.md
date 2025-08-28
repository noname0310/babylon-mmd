---
sidebar_position: 0
sidebar_label: 概要
---

# 概要

このセクションではbabylon-mmdが提供する機能の概要を説明します。

## ライブラリ概要

babylon-mmdはTypeScriptで書かれたライブラリで、Babylon.jsにMikuMikuDance（MMD）モデルとアニメーションのローダーとランタイムを提供します。現在はnpmパッケージとして配布されています。

このライブラリはESMまたはUMDモジュールとして使用できます。UMDビルドはBabylon.js Playgroundのような環境で使用できます。

このドキュメントはwebpackのようなバンドラーを使用するESMモジュールベースのプロジェクトでの使用法に基づいて書かれています。

## babylon-mmdのハローワールド

このセクションでは、簡単な例を通じてbabylon-mmdの概要を見ていきます。
この例では、MMDモデルのロード方法、カメラとライティングのセットアップ方法、オーディオ付きのアニメーション再生方法を示しています。

:::info

例を簡潔にするため、サイドエフェクト以外のインポート文は省略されています。

:::

```typescript showLineNumbers
// ローダーを登録するサイドエフェクト
import "babylon-mmd/esm/Loader/pmxLoader";

// アニメーションランタイムを登録するサイドエフェクト
import "babylon-mmd/esm/Runtime/Animation/mmdRuntimeCameraAnimation";
import "babylon-mmd/esm/Runtime/Animation/mmdRuntimeModelAnimation";

async function build(canvas: HTMLCanvasElement, engine: Engine): Scene {
    const scene = new Scene(engine);
    scene.ambientColor = new Color3(0.5, 0.5, 0.5);

    const camera = new MmdCamera("mmdCamera", new Vector3(0, 10, 0), scene);

    const directionalLight = new DirectionalLight("DirectionalLight", new Vector3(0.5, -1, 1), scene);
    directionalLight.intensity = 1.0;
    
    const ground = CreateGround("ground1", { width: 60, height: 60, subdivisions: 2, updatable: false }, scene);
    
    const mmdWasmInstance = await GetMmdWasmInstance(new MmdWasmInstanceTypeSPR());
    const physicsRuntime = new MultiPhysicsRuntime(mmdWasmInstance);
    physicsRuntime.setGravity(new Vector3(0, -98, 0));
    physicsRuntime.register(scene);
    
    // モーフ、アペンド変換、IK、アニメーション、物理演算を処理するMMDランタイム
    const mmdRuntime = new MmdRuntime(scene, new MmdBulletPhysics(physicsRuntime));
    mmdRuntime.register(scene);
    
    // 同期オーディオ再生のため
    const audioPlayer = new StreamAudioPlayer(scene);
    audioPlayer.source = "your_audio_path.mp3";
    mmdRuntime.setAudioPlayer(audioPlayer);
    
    // ロード前にアニメーションを実行することもできます。これによりオーディオが先に実行されます。
    mmdRuntime.playAnimation();

    // YouTubeのようなプレイヤーコントロールを作成
    new MmdPlayerControl(scene, mmdRuntime, audioPlayer);
    
    const vmdLoader = new VmdLoader(scene);

    const cameraAnimation = await vmdLoader.loadAsync("camera_motion", "your_camera_motion_path.vmd");
    const cameraRuntimeAnimationHandle = camera.createRuntimeAnimation(cameraAnimation);
    camera.setRuntimeAnimation(cameraRuntimeAnimationHandle);
    mmdRuntime.addAnimatable(camera);

    const assetContainer = await LoadAssetContainerAsync("path/to/your_file.pmx", scene);
    assetContainer.addAllToScene();
    const mmdMesh = assetContainer.meshes[0] as MmdMesh;

    const mmdModel = mmdRuntime.createMmdModel(mmdMesh);
    const modelMotion = await vmdLoader.loadAsync("model_motion", "your_model_motion_path.vmd");
    const modelRuntimeAnimationHandle = mmdModel.createRuntimeAnimation(modelMotion);
    mmdModel.setRuntimeAnimation(modelRuntimeAnimationHandle);

    return scene;
}
```

Babylon.js Playgroundで試すことができます。https://www.babylonjs-playground.com/#S7XDNP

それぞれの要素が提供する機能を見ていきましょう。

- [**1-6行目**](#サイドエフェクト-1-6行目): シーンのロードに必要なサイドエフェクトを登録します。

- [**9-17行目**](#シーン作成-9-17行目): シーンを作成し、カメラとライティングをセットアップします。

- [**19-34行目**](#mmdランタイム作成-19-34行目): MMDランタイムを作成し、物理エンジンをセットアップします。また、オーディオとアニメーションを同期させるためのオーディオプレーヤーも設定します。

- [**36-37行目**](#mmdプレイヤーコントロールの作成-36-37行目): MMDプレイヤーコントロールを作成します。

- [**39-44行目**](#vmdローダー-39-44行目): VMDローダーを使用してカメラアニメーションをロードし、カメラにランタイムアニメーションを設定します。

- [**46-53行目**](#pmxローダー-46-53行目): PMXローダーを使用してMMDモデルをロードし、VMDローダーでモデルアニメーションをロードします。そしてランタイムアニメーションをセットアップします。

## サイドエフェクト (1-6行目)

```typescript
// ローダーを登録するサイドエフェクト
import "babylon-mmd/esm/Loader/pmxLoader";

// アニメーションランタイムを登録するサイドエフェクト
import "babylon-mmd/esm/Runtime/Animation/mmdRuntimeCameraAnimation";
import "babylon-mmd/esm/Runtime/Animation/mmdRuntimeModelAnimation";
```

このコードはbabylon-mmdのPMXローダーとアニメーションランタイムをBabylon.jsのシーンローダーに登録します。これによりPMXファイルのロードとカメラやモデルのアニメーション再生が可能になります。

PMXローダーだけでなく、他のMMDモデルローダーも同じ方法で使用できます。例えば、PMDローダーを使用するには、以下のように追加します：

```typescript
import "babylon-mmd/esm/Loader/pmdLoader";
```

あるいは、BPMXローダーを使用するには、以下のように追加します：
```typescript
import "babylon-mmd/esm/Loader/Optimized/bpmxLoader";
```

:::warning

"babylon-mmd"パスから1つのシンボルがインポートされるだけでも、可能なすべてのサイドエフェクトが適用されます。

これはBabylon.jsの規約に従っています。
したがって、ツリーシェイキングが正しく機能するためには、すべてのインポートが完全なパスで記述される必要があります。

ツリーシェイキングを適切に行うには、[このBabylon.jsドキュメント](https://doc.babylonjs.com/setup/frameworkPackages/es6Support#side-effects)を参照してください。

:::

## シーン作成 (9-17行目)

```typescript
const scene = new Scene(engine);
scene.ambientColor = new Color3(0.5, 0.5, 0.5);

const camera = new MmdCamera("mmdCamera", new Vector3(0, 10, 0), scene);

const directionalLight = new DirectionalLight("DirectionalLight", new Vector3(0.5, -1, 1), scene);
directionalLight.intensity = 1.0;

CreateGround("ground1", { width: 60, height: 60, subdivisions: 2, updatable: false }, scene);
```

このコードはBabylon.jsのシーンを作成し、基本的なライティングとカメラをセットアップします。

ここでは、シーンのambientColorをrgb(0.5, 0.5, 0.5)に設定しています。**これは任意の値ではなく**、MMDマテリアルの実装と同じ動作を再現するために設定されています。MMDマテリアルはアンビエントカラーを0-0.5の範囲にマッピングします。

ディレクショナルライトを使用する理由も、MMDマテリアルのライティングモデルを再現するためであり、任意の設定ではありません。

## MMDランタイム作成 (19-34行目)

```typescript
const mmdWasmInstance = await GetMmdWasmInstance(new MmdWasmInstanceTypeSPR());
const physicsRuntime = new MultiPhysicsRuntime(mmdWasmInstance);
physicsRuntime.setGravity(new Vector3(0, -98, 0));
physicsRuntime.register(scene);

// モーフ、アペンド変換、IK、アニメーション、物理演算を処理するMMDランタイム
const mmdRuntime = new MmdRuntime(scene, new MmdBulletPhysics(physicsRuntime));
mmdRuntime.register(scene);

// 同期オーディオ再生のため
const audioPlayer = new StreamAudioPlayer(scene);
audioPlayer.source = "your_audio_path.mp3";
mmdRuntime.setAudioPlayer(audioPlayer);

// ロード前にアニメーションを実行することもできます。これによりオーディオが先に実行されます。
mmdRuntime.playAnimation();
```

このコードはMMDランタイムを作成し、物理エンジンをセットアップします。また、オーディオとアニメーションを同期させるためのオーディオプレーヤーも設定します。

### WebAssemblyバイナリ

最初の`GetMmdWasmInstance`関数はbabylon-mmdのWASMバイナリをロードします。

babylon-mmdは処理パフォーマンスを向上させるためにRustで書かれWASMバイナリにコンパイルされた一部の機能を提供しています。
WebAssembly部分に対応するTypeScript実装も存在するため、オプションで使用することができます。

例えば、TypeScriptで書かれたMMDランタイム`MmdRuntime`と同じ機能を提供する`MmdWasmRuntime`というWASMランタイムがあります。

WebAssemblyバイナリは主にMMDモデルアニメーション処理ロジックを提供し、さらにBullet Physicsエンジンも提供します。

```typescript
const mmdWasmInstance = await GetMmdWasmInstance(new MmdWasmInstanceTypeSPR());
```
この例では、WASMバイナリのタイプを決定するために`MmdWasmInstanceTypeSPR`を使用しています。SPRはそれぞれSingle threaded（シングルスレッド）、Physics Engine Included（物理エンジン含む）、Release Build（リリースビルド）を表します。

つまり、使用しているバイナリは物理エンジンを含むシングルスレッドのリリースビルドです。

他のWASMバイナリタイプには`SR`、`SPD`などがあります。`SR`はSingle threaded、Release Buildを意味し、物理エンジンを含まないバイナリです。`SPD`はSingle threaded、Physics Engine Included、Debug Buildを意味します。

```typescript
const physicsRuntime = new MultiPhysicsRuntime(mmdWasmInstance);
physicsRuntime.setGravity(new Vector3(0, -98, 0));
physicsRuntime.register(scene);
```

babylon-mmdのWASMバイナリが提供するBullet Physicsエンジンを使用して物理エンジンのインスタンスを作成します。

ここでは重力加速度を一般的な地球の重力加速度である-9.8 m/s²ではなく、-98 m/s²に設定しています。この値はMMDの物理エンジンの設定に合わせるために設定されています。

```typescript
// モーフ、アペンド変換、IK、アニメーション、物理演算を処理するMMDランタイム
const mmdRuntime = new MmdRuntime(scene, new MmdBulletPhysics(physicsRuntime));
mmdRuntime.register(scene);

// 同期オーディオ再生のため
const audioPlayer = new StreamAudioPlayer(scene);
audioPlayer.source = "your_audio_path.mp3";
mmdRuntime.setAudioPlayer(audioPlayer);

// ロード前にアニメーションを実行することもできます。これによりオーディオが先に実行されます。
mmdRuntime.playAnimation();
```

次にMMDランタイムを作成します。

MMDランタイムはMMDアニメーションに参加する要素を同期し調整します。

```typescript
// ロード前にアニメーションを実行することもできます。これによりオーディオが先に実行されます。
mmdRuntime.playAnimation();
```

3Dモデルやアニメーションのロードには時間がかかるため、待機中に先行してオーディオを再生開始するために`MmdRuntime.playAnimation()`を呼び出すことができます。

アニメーション再生中にモデル、カメラ、アニメーションを`MmdRuntime`に動的に追加することができます。

## MMDプレイヤーコントロールの作成 (36-37行目)

```typescript
// YouTubeのようなプレイヤーコントロールを作成
new MmdPlayerControl(scene, mmdRuntime, audioPlayer);
```

このコードはMMDプレイヤーコントロールを作成します。このコントロールはMMDアニメーションの再生、一時停止、オーディオ調整のためのUIを提供します。

このコードはクイックテスト目的で提供されており、本番環境では独自のものを実装することをお勧めします。

## VMDローダー (39-44行目)

```typescript
const vmdLoader = new VmdLoader(scene);

const cameraAnimation = await vmdLoader.loadAsync("camera_motion", "your_camera_motion_path.vmd");
const cameraRuntimeAnimationHandle = camera.createRuntimeAnimation(cameraAnimation);
camera.setRuntimeAnimation(cameraRuntimeAnimationHandle);
mmdRuntime.addAnimatable(camera);
```

このコードはVMDローダーを使用してカメラアニメーションをロードし、そのアニメーションをカメラにバインドします。

### babylon-mmdのアニメーションシステム

babylon-mmdはデフォルトではBabylon.jsのアニメーションシステムを使用せず、独自のアニメーションシステムを実装しています。

これはBabylon.jsのアニメーションシステムが大量のアニメーションデータの処理に最適化されておらず、MMDのアニメーションランタイム仕様を完全にサポートできないためです。

babylon-mmdが提供するアニメーションシステムは`MmdAnimation`コンテナでアニメーションデータを管理します。そしてアニメーションは再生するために特定のオブジェクトにバインドされる必要があります。

```typescript
const cameraRuntimeAnimationHandle = camera.createRuntimeAnimation(cameraAnimation);
```

バインドされたアニメーションは`MmdRuntimeAnimation`と呼ばれます。これらのオブジェクトは一般的に直接アクセスすることは推奨されないため、`MmdCamera.createRuntimeAnimation`はそれらにアクセスするためのハンドルを返します。

## PMXローダー (46-53行目)

```typescript
const assetContainer = await LoadAssetContainerAsync("path/to/your_file.pmx", scene);
assetContainer.addAllToScene();
const mmdMesh = assetContainer.meshes[0] as MmdMesh;

const mmdModel = mmdRuntime.createMmdModel(mmdMesh);
const modelMotion = await vmdLoader.loadAsync("model_motion", "your_model_motion_path.vmd");
const modelRuntimeAnimationHandle = mmdModel.createRuntimeAnimation(modelMotion);
mmdModel.setRuntimeAnimation(modelRuntimeAnimationHandle);
```

このコードはPMXローダーを使用してMMDモデルをロードし、VMDローダーでモデルアニメーションをロードします。そしてランタイムアニメーションをセットアップします。

### MMDモデルローダー

babylon-mmdはPMX、PMD、BPMXなどの様々なMMDモデル形式をサポートしています。この例ではPMXローダーを使用してモデルをロードしています。

```typescript
const assetContainer = await LoadAssetContainerAsync("path/to/your_file.pmx", scene);
assetContainer.addAllToScene();
const mmdMesh = assetContainer.meshes[0] as MmdMesh;
```

このコードはBabylon.jsのシーンローダーを使用してPMXファイルをロードします。

前に`import "babylon-mmd/esm/Loader/pmxLoader";`でPMXローダーを登録したため、`LoadAssetContainerAsync`関数は正しくPMXファイルをロードできます。

次に、使用するためにassetContainerのロードされたメッシュの最初のものを`MmdMesh`タイプにキャストします。

MMDモデルローダーは常にMMDモデルのルートメッシュを`meshes[0]`に配置するため、このキャストは常に有効です。

### MMDモデルをランタイムに追加する

```typescript
const mmdModel = mmdRuntime.createMmdModel(mmdMesh);
const modelMotion = await vmdLoader.loadAsync("model_motion", "your_model_motion_path.vmd");
const modelRuntimeAnimationHandle = mmdModel.createRuntimeAnimation(modelMotion);
mmdModel.setRuntimeAnimation(modelRuntimeAnimationHandle);
```

`MmdRuntime.createMmdModel`関数を使用してMMDメッシュからランタイムによって制御されるMMDモデルを作成できます。
MmdModelが作成されると、MMDルートメッシュの下のすべてのメッシュとマテリアルがMMDランタイムによって制御されます。

MmdModelにアニメーションをバインドする方法はカメラアニメーションと同じです。

## 結論

このセクションでは、babylon-mmdの基本的な使用方法を見てきました。

新しく紹介された概念は以下の通りです：

- **MmdRuntime**: MMDアニメーションを処理するランタイム。MMDモデルとアニメーションを管理し、物理エンジンとオーディオプレーヤーを統合します。
- **MmdWasmInstance**: MMDアニメーション処理用のWebAssemblyインスタンス。WASMバイナリを使用してパフォーマンスを向上させます。使用はオプションです。
- **MmdAnimation**: MMDアニメーションデータを管理するコンテナ。ランタイムアニメーションを作成してバインドできます。
- **MmdMesh**: MMDモデルのメッシュを表すオブジェクト。PMX、PMD、BPMXなどの様々なMMDモデル形式をサポートしています。
- **MmdModel**: MMDモデルをランタイムに追加してアニメーションをバインドするオブジェクト。MMDモデルのルートメッシュの下にあるすべてのメッシュとマテリアルを制御します。
- **MmdPlayerControl**: MMDアニメーションを制御するためのUIコントロール。再生、一時停止、オーディオ調整などができます。
