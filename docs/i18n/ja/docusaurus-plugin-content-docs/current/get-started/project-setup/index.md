---
sidebar_position: 0
sidebar_label: プロジェクトのセットアップ
---

# プロジェクトのセットアップ

まず、**babylon-mmd** を使用するための **SPA プロジェクト**をセットアップする必要があります。このチュートリアルでは [**webpack**](https://webpack.js.org/) ベースのプロジェクトテンプレートを使用します。

次のコマンドでプロジェクトをクローンすることから始めます:

```bash
git clone https://github.com/noname0310/babylon-mmd-template
```

このプロジェクトには、**TypeScript**、**Webpack**、**ESLint**、**Babylon.js**、および **babylon-mmd** を使用するための設定が含まれています。

具体的なビルドおよび開発環境の設定は以下の通りです:

- **TypeScript** (tsconfig.json)
  - src フォルダーを参照するための **"@/" エイリアス**
  - その他の厳密な型チェックとともに **Strict モード**が有効

- **Webpack** (webpack.config.ts)
  - **Dev サーバー**の設定 (https, localhost:20310)
  - **SharedArrayBuffer** が有効 (cross-origin-isolated)
  - **res フォルダー**内のすべてのリソースを fetch 経由で読み込み可能 (CopyWebpackPlugin)
  - 保存時に **ESLint auto fix**
  - **シェーダーコードのチャンク分割**
  - **SourceMap** が有効 (dev モード)

- **ESLint** (eslint.config.mjs)
  - **Babylon.js コーディングスタイルガイド**に準拠した設定

このプロジェクトのソース構造は以下の通りです:

```
/ (root)
├── /res: PMX モデル、VMD アニメーション、MP3 オーディオなどを含むフォルダー
├── /src: プロジェクトのソースコードを含むフォルダー
│   ├── /baseRuntime.ts: Babylon.js エンジンの作成とレンダリングループのセットアップコード
│   ├── /index.html: HTML テンプレート
│   ├── /index.ts: エントリーポイント、シーンビルダーを使用してシーンを作成し、レンダリングループを開始
│   └── /sceneBuilder.ts: シーンを構成するコード
```

**MMD シーン**を構成するために、**sceneBuilder.ts** ファイルのみを変更します。

まず、プロジェクトの依存関係をインストールし、開発サーバーを起動します:

```bash
npm install
npm start
```

ブラウザで [https://localhost:20310](https://localhost:20310) を開くと、次のエラーが表示されます:

![first run](@site/docs/get-started/project-setup/first_run.png)

**sceneBuilder.ts** ファイルには、デフォルトで **WebXR を使用した babylon-mmd の例**が含まれています。
しかし、読み込むべき **MMD モデルとアニメーションがない**ため、エラーが発生します。

MMD シーンを構成するために、sceneBuilder.ts ファイルを**完全に書き直します**。

次のように**空の `build` メソッド**から始めます:

```typescript title="src/sceneBuilder.ts"
import type { AbstractEngine } from "@babylonjs/core/Engines/abstractEngine";
import { Scene } from "@babylonjs/core/scene";

import type { ISceneBuilder } from "./baseRuntime";

export class SceneBuilder implements ISceneBuilder {
    public async build(_canvas: HTMLCanvasElement, engine: AbstractEngine): Promise<Scene> {
        const scene = new Scene(engine);
        return scene;
    }
}
```
