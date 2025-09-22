---
sidebar_position: 1
sidebar_label: MMD カメラ
---

# MMD カメラ

このセクションでは、MMDのカメラ動作を再現する**`MmdCamera`**クラスと**`IMmdCamera`**インターフェースについて説明します。

## MmdCameraクラス

![Orbit Camera](@site/docs/reference/runtime/mmd-camera/orbit-camera.png)
*MMDカメラのオービットパスの視覚的表現*

MMDのカメラは、センターポジションを中心に回転する**オービットカメラ**です。
**`MmdCamera`**クラスはこれを再現しており、そのためカメラを制御するパラメータは以下の通りです：

- **position** (Vector3) - オービットセンターポジション
- **rotation** (Vector3) - ヨー ピッチ ロール
- **distance** (number) - オービットセンターからの距離
- **fov** (number) - ラジアン単位のフィールドオブビュー

**`MmdCamera`**クラスは、Babylon.jsの**`Camera`**クラスを継承しています。そのため、他のBabylon.jsカメラと同様に、シーンに追加して使用できます。

## カメラの作成

以下のコードで**`MmdCamera`**を作成し、シーンに追加できます：

```typescript
const mmdCamera = new MmdCamera("mmdCamera", new Vector3(0, 10, 0), scene, true);
```

各パラメータは順に以下を意味します：
- **name**：カメラ名
- **position**：初期オービットセンター値（デフォルト：(0, 10, 0)）
- **scene**：カメラを追加するシーン（デフォルト：Engine.LastCreatedScene）
- **setActiveOnSceneIfNoneActive**：作成後に他のカメラが定義されていない場合、このカメラをシーンのアクティブカメラに設定するかどうか（デフォルト：true）

## アニメーションバインディング

**`MmdCamera`**は、VMDまたはBVMDファイルから作成された**`MmdAnimation`**をバインドして使用できます。

```typescript
const vmdLoader = new VmdLoader();
const mmdAnimation = await vmdLoader.loadAsync("path/to/file.vmd");

const mmdCamera = new MmdCamera("camera", new Vector3(0, 10, 0), scene);
const animationHandle: MmdRuntimeAnimationHandle = mmdCamera.createRuntimeAnimation(mmdAnimation);
```

上記のコードは、VMDファイルをロードして**`MmdAnimation`**を作成し、**`MmdCamera`**にバインドする例です。

**`MmdCamera.createRuntimeAnimation`**メソッドを使用して、バインドされた「ランタイムアニメーション」を作成できます。ファンクションによって返される結果は、実際のランタイムアニメーションオブジェクトではなく、オブジェクトへのハンドルです。

### runtimeAnimations

作成されたランタイムアニメーションオブジェクトは**`MmdCamera.runtimeAnimations`**に追加されます。

これにより、プロキシではなく実際のランタイムアニメーションオブジェクトにアクセスして、より低レベルの制御が可能になります。

## アニメーションの使用

バインドされたランタイムアニメーションを使用するには、**`MmdCamera.setRuntimeAnimation`**メソッドを呼び出します：

```typescript
mmdCamera.setRuntimeAnimation(animationHandle);
```

デフォルトでは、**`MmdCamera`**オブジェクトは一度に1つのアニメーションのみを再生できます。

現在設定されているアニメーションを削除するには、引数として**`null`**を渡します：

```typescript
mmdCamera.setRuntimeAnimation(null);
```

現在設定されているアニメーションは、**`MmdCamera.currentAnimation`**プロパティを通じてアクセスできます。

## ランタイムアニメーションの破棄

**`MmdCamera`**にバインドされたランタイムアニメーションを破棄するには、**`destroyRuntimeAnimation`**メソッドを呼び出します：

```typescript
mmdCamera.destroyRuntimeAnimation(animationHandle);
```

使用されなくなったカメラランタイムアニメーションを破棄しない場合、メモリーリークは発生しませんが、特殊なケースでランタイムエラーが発生する可能性があります。

## アニメーションの評価

現在設定されているアニメーションを評価するには、**`MmdCamera.animate()`**メソッドを使用できます。

このメソッドは**通常直接呼び出されません**が、MMDランタイムによって呼び出されます。

MmdCameraを手動で制御している場合は、このメソッドを呼び出してアニメーションを評価できます：

```typescript
let sec = 0;
scene.onBeforeRenderObservable.add(() => {
    const frameTime = sec * 30; // MMDは30fpsで動作します
    mmdCamera.animate(frameTime); // アニメーションを評価します。30フレーム単位でスケールされた時間をパラメータとして渡します
    sec += engine.getDeltaTime() / 1000;
});
```

## IMmdCameraインターフェース

babylon-mmdは、ユーザーが独自のMMDカメラを実装できるように**`IMmdCamera`**インターフェースを提供します。

babylon-mmdのすべてのコンポーネントは、MMDカメラオブジェクトを参照または渡す際に、**`MmdCamera`**クラスタイプではなく**`IMmdCamera`**インターフェースを使用します。
