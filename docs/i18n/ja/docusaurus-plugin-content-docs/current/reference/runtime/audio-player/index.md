---
sidebar_position: 8
sidebar_label: オーディオプレイヤー
---

# オーディオプレイヤー

このセクションでは、MMDランタイムにオーディオプレイヤーコンポーネントを追加して音楽を再生する方法について説明します。

## IPlayerインターフェース

MMDランタイムは、デフォルトで`Engine.getDeltaTime()`メソッドを使用して**アニメーションを更新**します。

しかし、オーディオを再生する際は、MMDランタイムの再生速度がオーディオ再生速度と**同期**していなければなりません。これは、オーディオオブジェクトが一種のタイマーとして機能するためです。

babylon-mmdは、（オーディオ）プレイヤーが実装しなければならないメソッドを`IPlayer`インターフェースを通じて定義しています。これらのメソッドをすべて実装することで、プレイヤーはMMDランタイムの**同期ターゲット**として使用できます。

以下は、`IPlayer`インターフェースを実装する`StreamAudioPlayer`クラスを`MmdRuntime`に設定する例です：

```typescript
const audioPlayer = new StreamAudioPlayer();
mmdRuntime.setAudioPlayer(audioPlayer);
```

## オーディオ同期メソッド

オーディオプレイヤーが設定されると、MMDランタイムは**非常に複雑なロジック**を使用してアニメーションを更新します。

厳密に言うと、オーディオプレイヤーを使用する場合でも、MMDランタイムはデフォルトで`Engine.getDeltaTime()`メソッドを使用してアニメーションを更新します。ただし、オーディオプレイヤーの再生位置がアニメーション再生位置と**同期していない**場合、アニメーション再生位置がオーディオプレイヤーの再生位置に合わせて調整されます。

つまり、オーディオプレイヤーが設定されると、MMDランタイムは**アニメーションの再生位置を調整**してオーディオプレイヤーの再生位置に合わせますが、オーディオプレイヤーをメインタイマーとして**使用しません**。

さらに、アニメーションがオーディオよりも長い場合、オーディオが停止した後でもアニメーションは最後まで再生を続ける必要があります。したがって、オーディオ自体がMMDランタイムの再生の**メインタイマーになることはできません**。

## StreamAudioPlayer

babylon-mmdは、`IPlayer`インターフェースを実装する`StreamAudioPlayer`クラスを提供します。

このクラスは内部的に`HTMLAudioElement`を使用してオーディオを再生します。

使用方法の例は以下の通りです：

```typescript
const audioPlayer = new StreamAudioPlayer(scene);
audioPlayer.source = "path/to/audio/file.mp3";
mmdRuntime.setAudioPlayer(audioPlayer);
```

`StreamAudioPlayer`クラスは、作成時に`Scene`オブジェクトを引数として取ります。これは、`HTMLAudioElement`のライフタイムを`Scene`オブジェクトに**バインド**するためです。

:::warning
`StreamAudioPlayer`クラスのコンストラクタの第1引数として`null`を指定すると、`dispose()`メソッドが呼び出されるまで`HTMLAudioElement`が**メモリーに残る**可能性があることに注意してください。
:::
