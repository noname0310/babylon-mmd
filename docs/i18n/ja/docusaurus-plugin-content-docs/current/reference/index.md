---
sidebar_position: 1
sidebar_label: リファレンス
---

# リファレンス概要

このセクションでは、babylon-mmdが提供する機能について詳細な説明を提供します。

babylon-mmdの中核機能は、PMX、PMD、VMD、およびVPDファイルを読み込み、MMDモデルをBabylon.jsシーンにシームレスに統合することです。

babylon-mmdは、MMD（MikuMikuDance）の動作を正確に再現しながら、Babylon.jsのレンダリングパイプラインとの互換性を確保するための様々なオプションを提供しています。

あなたは特定のユースケースに合った機能を選択的に使用し、Babylon.jsシーンに最適な設定を作成することができます。そのためには、MMDの動作方法とbabylon-mmdがこれらのメカニズムをどのように再現するかの両方を理解する必要があります。このセクションでは、これらの詳細を説明します。

:::info

MMDモデルの読み込みやアニメーションの再生に関する基本的な使い方を知りたい場合は、[はじめに](/docs/get-started)のセクションを参照してください。このセクションでは、babylon-mmdの基本的な使い方とセットアップについてのガイダンスを提供しています。

:::

リファレンスドキュメントには以下のトピックが含まれています：

## **[概要](/docs/reference/overview)**

このセクションでは、babylon-mmdを構成するコンポーネントとそれらの関係について説明します。

## **[MMDの動作を理解する](/docs/reference/understanding-mmd-behaviour)**

これらのセクションでは、MMDのアセット構造と動作を理解するために必要な情報を提供します。また、babylon-mmdがMMDの動作をどのように再現するかについての基本的な理解を構築するのに役立ちます。

- **[PMXとPMDの紹介](/docs/reference/understanding-mmd-behaviour/introduction-to-pmx-and-pmd)** - PMXとPMDファイルの構造と動作を理解するために必要な情報を提供します。
- **[VMDとVPDの紹介](/docs/reference/understanding-mmd-behaviour/introduction-to-vmd-and-vpd)** - VMDとVPDファイルの構造と動作を理解するために必要な情報を提供します。

## **[ローダー](/docs/reference/loader)**

これらのセクションでは、MMDモデルとアニメーションデータを読み込む方法について説明します。

- **[MMDモデルローダー（PmxLoader、PmdLoader）](/docs/reference/loader/mmd-model-loader)** - MMDモデルファイル（PMX、PMD）を読み込むために使用されるコンポーネントについて説明します。
  - **[Fix BMPテクスチャローダー](/docs/reference/loader/mmd-model-loader/fix-bmp-texture-loader)** - BMPテクスチャを持つMMDモデルを正しく読み込むためのコンポーネントについて説明します。
  - **[SDEFサポート](/docs/reference/loader/mmd-model-loader/sdef-support)** - 球面変形（SDEF）を持つMMDモデルを正しく読み込むためのコンポーネントについて説明します。
  - **[MMD スタンダードマテリアル](/docs/reference/loader/mmd-model-loader/mmd-standard-material)** - MMDモデルに使用される標準マテリアルについて説明します。
  - **[マテリアルビルダー](/docs/reference/loader/mmd-model-loader/material-builder)** - MMDモデルにマテリアルを割り当てる方法と、MMDのレンダリング方法を再現する方法について説明します。
    - **[独自のMMDマテリアルビルダーを構築する](/docs/reference/loader/mmd-model-loader/material-builder/build-your-own-mmd-material-builder)** - MMDモデルのマテリアル割り当てをカスタマイズする方法について説明します。
  - **[Babylon PMXフォーマット](/docs/reference/loader/mmd-model-loader/the-babylon-pmx-format)** - babylon-mmdが提供するPMXファイルの変種であるBPMXファイル形式について説明します。
    - **[PMXをBPMX形式に変換する](/docs/reference/loader/mmd-model-loader/the-babylon-pmx-format/convert-pmx-to-bpmx-format)** - PMXファイルをBPMX形式に変換する方法について説明します。
    - **[BPMXローダー](/docs/reference/loader/mmd-model-loader/the-babylon-pmx-format/bpmx-loader)** - BPMXファイルを読み込む方法について説明します。

- **[MMDアニメーションローダー（VmdLoader、VpdLoader）](/docs/reference/loader/mmd-animation-loader)** - MMDアニメーションファイル（VMD、VPD）を読み込むために使用されるコンポーネントについて説明します。
  - **[Babylon VMDフォーマット](/docs/reference/loader/mmd-animation-loader/the-babylon-vmd-format)** - babylon-mmdが提供するVMDファイルの変種であるBVMDファイル形式について説明します。
    - **[VMDをBVMD形式に変換する](/docs/reference/loader/mmd-animation-loader/the-babylon-vmd-format/convert-vmd-to-bvmd-format)** - VMDファイルをBVMD形式に変換する方法について説明します。
    - **[BVMDローダー](/docs/reference/loader/mmd-animation-loader/the-babylon-vmd-format/bvmd-loader)** - BVMDファイルを読み込む方法について説明します。

## **[ランタイム](/docs/reference/runtime)**

これらのセクションでは、MMDモデルとアニメーションを実行するために必要なランタイムコンポーネントについて説明します。

- **[MMDカメラ](/docs/reference/runtime/mmd-camera)** - MMDカメラの設定と使用方法について説明します。
- **[MMDランタイム](/docs/reference/runtime/mmd-runtime)** - MMDモデルとアニメーションを実行するためのランタイム環境について説明します。
- **[MMD WebAssemblyランタイム](/docs/reference/runtime/mmd-webassembly-runtime)** - WebAssemblyを使用してMMDアニメーションを実行する方法について説明します。
- **[マテリアルモーフィングを有効にする](/docs/reference/runtime/enable-material-morphing)** - MMDモデルのマテリアルモーフィングを有効にする方法について説明します。
- **[物理演算をMMDモデルに適用する](/docs/reference/runtime/apply-physics-to-mmd-models)** - MMDモデルの物理演算を設定する方法について説明します。
- **[バレット物理演算](/docs/reference/runtime/bullet-physics)** - バレット物理演算ワールドの制御方法について説明します。
- **[アニメーション](/docs/reference/runtime/animation/mmd-animation)** - MMDモデルのアニメーションを設定および制御する方法について説明します。
  - **[MMDアニメーション](/docs/reference/runtime/animation/mmd-animation)** - MMDアニメーションの設定と使用方法について説明します。
  - **[Babylon.jsアニメーションランタイムを使用する](/docs/reference/runtime/animation/use-babylonjs-animation-runtime)** - Babylon.jsアニメーションランタイムを使用してMMDモデルをアニメーション化する方法について説明します。
  - **[MMDプレイヤーコントロール](/docs/reference/runtime/animation/mmd-player-control)** - ビデオプレイヤーに似たGUIを使用してMMDアニメーションを制御する方法について説明します。
  - **[アニメーションブレンディング](/docs/reference/runtime/animation/animation-blending)** - 複数のアニメーションをブレンドする方法について説明します。
- **[オーディオプレイヤー](/docs/reference/runtime/audio-player)** - アニメーションと同期したオーディオプレイヤーの設定方法について説明します。
- **[MMD以外のモデルにMMDアニメーションを適用する](/docs/reference/runtime/apply-mmd-animation-on-non-mmd-model)** - MMD以外のモデルにMMDアニメーションを適用する方法について説明します。
<!-- - **[ランタイムなしでMMDモデルを使用する](/docs/reference/runtime/use-mmd-model-without-runtime)** - ランタイムなしでMMDモデルを使用する方法について説明します。 -->
