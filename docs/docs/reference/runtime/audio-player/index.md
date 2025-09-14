---
sidebar_position: 8
sidebar_label: Audio Player
---

# Audio Player

This section explains how to play music by adding an Audio Player component to the MMD Runtime.

## IPlayer interface

MMD Runtime **updates animations** by default using the `Engine.getDeltaTime()` method.

However, when playing audio, the playback speed of the MMD Runtime must be **synchronized with the audio playback speed**. This is because the audio object serves as a kind of timer.

babylon-mmd defines the methods that an (audio) player must implement through the `IPlayer` interface. By implementing all of these methods, the player can be used as a **synchronization target** for the MMD Runtime.

Below is an example of setting up a `StreamAudioPlayer` class that implements the `IPlayer` interface in `MmdRuntime`:

```typescript
const audioPlayer = new StreamAudioPlayer();
mmdRuntime.setAudioPlayer(audioPlayer);
```

## Audio Synchronization Method

When an audio player is set, the MMD Runtime uses **quite complex logic** to update animations.

Strictly speaking, when using an audio player, the MMD Runtime still uses the `Engine.getDeltaTime()` method to update animations by default. However, if the playback position of the audio player is **not synchronized** with the animation playback position, the animation playback position is adjusted to match the audio player's playback position.

In other words, when an audio player is set, the MMD Runtime **adjusts the animation's playback position** to match the audio player's playback position, but **does not use** the audio player as the main timer.

Additionally, if the animation is longer than the audio, the animation should continue playing until the end even after the audio stops. Therefore, the audio itself **cannot be the main timer** for the MMD Runtime's playback.

## StreamAudioPlayer

babylon-mmd provides the `StreamAudioPlayer` class that implements the `IPlayer` interface.

This class uses `HTMLAudioElement` internally to play audio.

Here's an example of how to use it:

```typescript
const audioPlayer = new StreamAudioPlayer(scene);
audioPlayer.source = "path/to/audio/file.mp3";
mmdRuntime.setAudioPlayer(audioPlayer);
```

The `StreamAudioPlayer` class takes a `Scene` object as an argument when created. This is to **bind the lifetime** of the `HTMLAudioElement` to the `Scene` object.

:::warning
If you specify `null` as the first argument of the `StreamAudioPlayer` class constructor, be aware that the `HTMLAudioElement` may **remain in memory** until the `dispose()` method is called.
:::
