---
sidebar_position: 3
sidebar_label: MMD StandardMaterial
---

# MMD スタンダードマテリアル

このセクションでは、babylon-mmdが提供する**`MmdStandardMaterial`** によるMMDのシェーディングモデルの再現について説明します。

**`MmdStandardMaterial`** はBabylon.jsの**`StandardMaterial`** をベースに**`MaterialPlugin`** を使用してシェーダーを変更し、MMDのシェーディングモデルを実装しています。

## MMDのシェーディングモデルと`MmdStandardMaterial`

### ライティング

MMDでは、シーン内にグローバルに存在する**1つのディレクショナルライト**が常に存在し、追加のライトはありません。

babylon-mmdの**`MmdStandardMaterial`** はMMDのこのシェーディングモデルを再現しており、シーン内に**1つのディレクショナルライト**だけが存在する状況で最適に機能します。他のシナリオでも動作するように設計されていますが、視覚的に魅力的でない場合があります。

### グラウンドシャドウ

MMDでは、メッシュを地面に**投影**することで、地面上の影を特別に実装しています。これを**グラウンドシャドウ**と呼びます。

babylon-mmdはこれを実装していません（要望があれば後で追加される可能性があります）。
代わりに、Babylon.jsの**ShadowGenerator**を使用して影を実装することができます。

### シャドウ

MMDでは、メッシュが**シャドウをキャストするか受け取るか**をマテリアルプロパティで制御します。babylon-mmdはこれを実装しておらず、シャドウ制御の責任はユーザーにあります（これも要望があれば後で追加される可能性があります）。

### レンダリングメソッド

MMDは**フォワードレンダリング**アプローチを使用します。各メッシュの**描画順序**は常にマテリアル順に固定され、すべてのマテリアルは**デプスライトとデプステスト**を実行し、**アルファブレンディング**を使用して描画されます。

## MMD マテリアルプロパティ

MMDマテリアルには様々なプロパティがあり、**`MmdStandardMaterial`** クラスはMMDマテリアルの各プロパティに対応するプロパティを提供します。

MMDマテリアルのプロパティと**`MmdStandardMaterial`** の対応するプロパティは以下の通りです：

| MMDマテリアルプロパティ | `MmdStandardMaterial`プロパティ | 説明 |
|-----------------|----------------------------|------|
| diffuse(rgba) | diffuseColor(rgb), alpha(a) | 拡散反射色と透明度 |
| specular(rgb) | specularColor | 鏡面反射色 |
| ambient(rgb) | ambientColor | アンビエントライト色 |
| reflect | specularPower | 反射強度 |
|-----------------|----------------------------|------|
| is double sided | backFaceCulling | メッシュの両面をレンダリングするかどうか |
| ground shadow | N/A | 実装されていません |
| draw shadow | N/A | 実装されていません |
| receive shadow | N/A | 実装されていません |
| toon edge | renderOutline | アウトラインをレンダリングするかどうか |
| vertex color (PMX 2.1 spec) | N/A | 実装されていません |
| point draw (PMX 2.1 spec) | N/A | 実装されていません |
| line draw (PMX 2.1 spec) | N/A | 実装されていません |
|-----------------|----------------------------|------|
| edge color(rgba) | outlineColor(rgb), outlineAlpha(a) | アウトラインの色と透明度 |
| edge size | outlineWidth | アウトラインの太さ |
| texture | diffuseTexture | テクスチャ |
| sphere texture | sphereTexture | 球面環境マッピングに使用されるテクスチャ、反射材質表現に使用 |
| sphere texture mode | sphereTextureBlendMode | スフィアテクスチャのブレンドモード |
| toon texture | toonTexture | ランプテクスチャシェーディングに使用されるテクスチャ |

さらに、マテリアルモーフィングによって適用されるプロパティがあります。これらはMMDの表面には公開されておらず、マテリアルモーフィングを通してのみ変更できるパラメーターです。

| `MmdStandardMaterial`プロパティ | 説明 |
|----------------------------|------|
| textureMultiplicativeColor(rgba) | 拡散テクスチャに乗算される色値 |
| textureAdditiveColor(rgba) | 拡散テクスチャに加算される色値 |
| sphereTextureMultiplicativeColor(rgba) | スフィアテクスチャに乗算される色値 |
| sphereTextureAdditiveColor(rgba) | スフィアテクスチャに加算される色値 |
| toonTextureMultiplicativeColor(rgba) | トゥーンテクスチャに乗算される色値 |
| toonTextureAdditiveColor(rgba) | トゥーンテクスチャに加算される色値 |

## MMD マテリアル実装

それでは、MMDスタンダードマテリアルで実際に使用されているフラグメントシェーダーコードを通じて、各プロパティが計算にどのように参加するかを見てみましょう。

このドキュメントではGLSL(WebGL)シェーダーに基づいて説明していますが、WGSL(WebGPU)コードも同様に動作します。

:::tip
**実際のシェーダーは多数の#ifdefブランチで複数のケースに対する最適化を行っていることに注意してください**。これはプリプロセッサが適用された後の簡略化された例です。
:::

これはMMDスタンダードマテリアル用にBabylon.jsランタイムによって生成されたGLSLフラグメントシェーダーの**main関数**です。主要な部分を個別に見ていきましょう。
```cpp
void main(void) {
    vec3 toonNdl;
#define CUSTOM_FRAGMENT_MAIN_BEGIN
    vec3 viewDirectionW = normalize(vEyePosition.xyz - vPositionW);
    vec4 baseColor = vec4(1., 1., 1., 1.);
    
    // 拡散色とアンビエント色の合計が拡散色として使用されます。
    // これはMMDのシェーダーと同じ結果を得るためであり、一般的なアプローチではありません。
    // この時点で、シェーダーには見えませんが、vAmbientColorの値はscene.ambientColor * material.ambientColorです。
    // したがって、MMDがアンビエント色のプロパティに適用する0.5のスケーリングと同じ実装をするには、
    // scene.ambientColorの値を(0.5, 0.5, 0.5)にする必要があります。
    vec3 diffuseColor = clamp(vDiffuseColor.rgb + vAmbientColor, 0.0, 1.0);
    float alpha = clamp(vDiffuseColor.a, 0.0, 1.0);

    vec3 normalW = normalize(vNormalW);
    vec2 uvOffset = vec2(0.0, 0.0);
    baseColor = texture(diffuseSampler, (vDiffuseUV + uvOffset));

    // マテリアル拡散テクスチャカラーモーフィングを適用します。
    baseColor.rgb = mix(
        vec3(1.0),
        baseColor.rgb * textureMultiplicativeColor.rgb,
        textureMultiplicativeColor.a
    );
    baseColor.rgb = clamp(
        baseColor.rgb + (baseColor.rgb - vec3(1.0)) * textureAdditiveColor.a,
        0.0,
        1.0
    ) + textureAdditiveColor.rgb;

#define CUSTOM_FRAGMENT_UPDATE_ALPHA
    baseColor.rgb *= vDiffuseInfos.y;
#define CUSTOM_FRAGMENT_UPDATE_DIFFUSE
    vec3 baseAmbientColor = vec3(1., 1., 1.);
#define CUSTOM_FRAGMENT_BEFORE_LIGHTS
    float glossiness = vSpecularColor.a;
    vec3 specularColor = vSpecularColor.rgb;
    vec3 diffuseBase = vec3(0., 0., 0.);
    lightingInfo info;
    vec3 specularBase = vec3(0., 0., 0.);
    float shadow = 1.;
    float aggShadow = 0.;
    float numLights = 0.;
    vec4 diffuse0 = light0.vLightDiffuse;
#define CUSTOM_LIGHT0_COLOR
    // ディレクショナルライト用のBlinn-Phongモデルを使用してシェーディングを計算します。
    info = computeLighting(viewDirectionW, normalW, light0.vLightData, diffuse0.rgb, light0.vLightSpecular.rgb, diffuse0.a, glossiness);
    // ここでは、パーセンテージクローザーフィルタリング（PCF）を使用して影が計算されます。これはShadowGeneratorの設定によって異なります。
    shadow = computeShadowWithPCF3(vPositionFromLight0, vDepthMetric0, shadowTexture0, light0.shadowsInfo.yz, light0.shadowsInfo.x, light0.shadowsInfo.w);
    aggShadow += shadow;
    numLights += 1.0;
    // シャドウが適用されたBlinn-Phongモデル値をトゥーンテクスチャにマッピングしてランプテクスチャシェーディングを適用します。
    toonNdl = vec3(clamp(info.ndl * shadow, 0.02, 0.98));
    toonNdl.r = texture(toonSampler, vec2(0.5, toonNdl.r)).r;
    toonNdl.g = texture(toonSampler, vec2(0.5, toonNdl.g)).g;
    toonNdl.b = texture(toonSampler, vec2(0.5, toonNdl.b)).b;
    diffuseBase += mix(info.diffuse * shadow, toonNdl * info.diffuse, info.isToon);
    // info.specularはハーフベクトルによって近似されたr dot l値です。
    specularBase += info.specular * shadow;
    aggShadow = aggShadow / numLights;
    vec4 refractionColor = vec4(0., 0., 0., 1.);
    vec4 reflectionColor = vec4(0., 0., 0., 1.);
    vec3 emissiveColor = vEmissiveColor;
    vec3 finalDiffuse = clamp(diffuseBase * diffuseColor + emissiveColor, 0.0, 1.0) * baseColor.rgb;
    vec3 finalSpecular = specularBase * specularColor;
    vec4 color = vec4(finalDiffuse * baseAmbientColor + finalSpecular + reflectionColor.rgb + refractionColor.rgb, alpha);
#define CUSTOM_FRAGMENT_BEFORE_FOG
    vec3 viewSpaceNormal = normalize(mat3(view) * vNormalW);

    // 球面環境マッピング用のUV座標を計算します。
    vec2 sphereUV = viewSpaceNormal.xy * 0.5 + 0.5;

    vec4 sphereReflectionColor = texture(sphereSampler, sphereUV);
    // スフィアテクスチャカラーモーフィングを適用します。
    sphereReflectionColor.rgb = mix(
        vec3(1.0),
        sphereReflectionColor.rgb * sphereTextureMultiplicativeColor.rgb,
        sphereTextureMultiplicativeColor.a
    );
    sphereReflectionColor.rgb = clamp(
        sphereReflectionColor.rgb + (sphereReflectionColor.rgb - vec3(1.0)) * sphereTextureAdditiveColor.a,
        0.0,
        1.0
    ) + sphereTextureAdditiveColor.rgb;
    sphereReflectionColor.rgb *= diffuseBase;
    // スフィアテクスチャをアドブレンドモードとして適用します。乗算ブレンドモードを使用する場合は異なるコードが適用されます。
    color = vec4(color.rgb + sphereReflectionColor.rgb, color.a); 
    color.rgb = max(color.rgb, 0.);
    color.a *= visibility;
#define CUSTOM_FRAGMENT_BEFORE_FRAGCOLOR
    glFragColor = color;
#define CUSTOM_FRAGMENT_MAIN_END
}
```

視覚化を助けるために、サンプルモデルとして**YYB式初音ミク_10th_v1.02 by SANMUYYB**を使用します。

### baseColor

まず、**`baseColor`にテクスチャからサンプリングされた色の結果が格納されます**。
このプロセスでは以下の要素が考慮されます：

- `MmdStandardMaterial.textureMultiplicativeColor`
- `MmdStandardMaterial.textureAdditiveColor`
- `BaseTexture.level`

```cpp
    vec4 baseColor = vec4(1., 1., 1., 1.);
    
    // ...
    
    // UVモーフィングが適用されている場合、シェーダーコード生成中にuvOffset変数に追加の計算が追加されます。
    vec2 uvOffset = vec2(0.0, 0.0);
    baseColor = texture(diffuseSampler, (vDiffuseUV + uvOffset));

    // `textureMultiplicativeColor`を適用
    baseColor.rgb = mix(
        vec3(1.0),
        baseColor.rgb * textureMultiplicativeColor.rgb,
        textureMultiplicativeColor.a
    );
    // `textureAdditiveColor`を適用
    baseColor.rgb = clamp(
        baseColor.rgb + (baseColor.rgb - vec3(1.0)) * textureAdditiveColor.a,
        0.0,
        1.0
    ) + textureAdditiveColor.rgb;

#define CUSTOM_FRAGMENT_UPDATE_ALPHA
    baseColor.rgb *= vDiffuseInfos.y; // vDiffuseInfos.yは`BaseTexture.level`の値です
```

![baseColor](@site/docs/reference/loader/mmd-model-loader/mmd-standard-material/baseColor.png)
*`baseColor`をレンダリングした結果。*

### lightingInfo

**Blinn-Phongモデル**を使用してライティング情報を計算するために**computeLighting関数**が呼び出されます。

```cpp
struct lightingInfo {
    float ndl;
    float isToon;
    vec3 diffuse;
    vec3 specular;
};
// ...

    lightingInfo info;
    // ...
    vec4 diffuse0 = light0.vLightDiffuse;
#define CUSTOM_LIGHT0_COLOR
    info = computeLighting(viewDirectionW, normalW, light0.vLightData, diffuse0.rgb, light0.vLightSpecular.rgb, diffuse0.a, glossiness);
```

`computeLighting`関数は、以下のパラメータを使用してディレクショナルライトのシェーディングを計算します：

- 視線方向 (**viewDirectionW**)
- 表面法線 (**normalW**)
- `DirectionalLight.direction` (**light0.vLightData**)
- `DirectionalLight.diffuse` (**diffuse0.rgb**)
- `DirectionalLight.specular` (**light0.vLightSpecular.rgb**)
- ライト範囲（ディレクショナルライトでは減衰が考慮されないため使用されません）
- `specularPower` (**glossiness**)

結果の`ndl`、`diffuse`、`specular`値は以下のように視覚化されます：

|ndl|diffuse|specular|
|---|-------|--------|
|![ndl](@site/docs/reference/loader/mmd-model-loader/mmd-standard-material/ndl.png)|![diffuse](@site/docs/reference/loader/mmd-model-loader/mmd-standard-material/diffuse.png)|![specular](@site/docs/reference/loader/mmd-model-loader/mmd-standard-material/specular.png)|

*各画像は`computeLighting`関数の結果として計算された`ndl`、`diffuse`、`specular`値を視覚化したものです。*

`isToon`値はシェーダーインジェクションの失敗時に正常に動作するためのパラメータであり、常に1.0の値を持ちます。シェーダーインジェクションが失敗した場合、この値は0.0になり、この値を使用して将来的にフォールバック処理が実行されます。

このセクションでは、説明のために`isToon`値が0.0のケースは考慮しません。

### shadow

シャドウはパーセンテージクローザーフィルタリング（PCF）メソッドを使用して計算されます。これは`ShadowGenerator`の設定によって大きく異なる場合があります。

```cpp
    float shadow = 1.;
    // ...
    shadow = computeShadowWithPCF3(vPositionFromLight0, vDepthMetric0, shadowTexture0, light0.shadowsInfo.yz, light0.shadowsInfo.x, light0.shadowsInfo.w);
```

`shadow`値は以下のように視覚化されます：

![shadow](@site/docs/reference/loader/mmd-model-loader/mmd-standard-material/shadow.png)
*`shadow`をレンダリングした結果。*

### diffuseBase

最終的なシェーディングは`ndl`と`shadow`を乗算して計算されます。その後、結果はトゥーンテクスチャにマッピングされます。

```cpp
    vec3 toonNdl;
    // ...
    vec3 diffuseBase = vec3(0., 0., 0.);
    // ...
    toonNdl = vec3(clamp(info.ndl * shadow, 0.02, 0.98));
    toonNdl.r = texture(toonSampler, vec2(0.5, toonNdl.r)).r;
    toonNdl.g = texture(toonSampler, vec2(0.5, toonNdl.g)).g;
    toonNdl.b = texture(toonSampler, vec2(0.5, toonNdl.b)).b;
    diffuseBase += mix(info.diffuse * shadow, toonNdl * info.diffuse, info.isToon);
    // ...
```

![ndlShadow](@site/docs/reference/loader/mmd-model-loader/mmd-standard-material/ndlShadow.png)
*`info.ndl * shadow`をレンダリングした結果。*

![toonNdl](@site/docs/reference/loader/mmd-model-loader/mmd-standard-material/toonNdl.png) \
*`toonNdl`をレンダリングした結果。これはシャドウ値が0から1の間でトゥーンテクスチャ（ランプテクスチャ）にマッピングされたものです。*

トゥーンテクスチャは通常、この種のグラデーションを持っています。値は垂直方向に変化し、下部を0、上部を1にマッピングします。

<img src={"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAOUlEQVRYR+3WMREAMAwDsYY/yoDI7MLwIiP40+RJklfcCCBAgAABAgTqArfb/QMCCBAgQIAAgbbAB3z/e0F3js2cAAAAAElFTkSuQmCC"} width="200"/>
*トゥーンテクスチャデータの例*

### finalDiffuse

最後に、拡散ライティングは、トゥーンマッピングされた結果である`diffuseBase`を取り、マテリアルの拡散色を乗算し、マテリアルの放射色を加算し、最後に`baseColor`でサンプリングされた結果を乗算して計算されます。

```cpp
    vec3 diffuseColor = clamp(vDiffuseColor.rgb + vAmbientColor, 0.0, 1.0);
    // ...
    vec3 emissiveColor = vEmissiveColor;
    vec3 finalDiffuse = clamp(diffuseBase * diffuseColor + emissiveColor, 0.0, 1.0) * baseColor.rgb;
```

マテリアルの拡散色は次のように計算されます：

- `StandardMaterial.diffuseColor` (**vDiffuseColor**)
- `StandardMaterial.ambientColor` * `Scene.ambientColor` (**vAmbientColor**) - CPUはマテリアルとシーンのアンビエント色を乗算してその結果をシェーダーに渡します。

`clamp(vDiffuseColor.rgb + vAmbientColor, 0.0, 1.0);`

アンビエント色も拡散色の計算に関与しており、これはMMDのシェーダーと同じ結果を得るためのもので、一般的なアプローチではないことがわかります。

:::warning
`Scene.ambientColor`をvec3(0.5, 0.5, 0.5)に設定することが重要です。
これは、MMDの実装がアンビエント色を0.5にスケーリングするためです。
したがって、同じ結果を得るためには、シーンのアンビエント色を0.5に設定し、MMDと同じ0.5スケーリングでアンビエント色が計算されるようにする必要があります。
:::

![finalDiffuse](@site/docs/reference/loader/mmd-model-loader/mmd-standard-material/finalDiffuse.png)
*`finalDiffuse`をレンダリングした結果。これは拡散光計算の結果です。*

### finalSpecular

`shadow`値が`specular`と乗算され、影にある領域が除外されます。

次に、マテリアルの`StandardMaterial.specularColor` (**vSpecularColor**)を使用して最終的なスペキュラー値が計算されます。

```cpp
    vec3 specularColor = vSpecularColor.rgb;
    // ...
    vec3 specularBase = vec3(0., 0., 0.);
    // ...
    specularBase += info.specular * shadow;
    // ...
    vec3 finalSpecular = specularBase * specularColor;
```

以下は最終的なスペキュラー値である`finalSpecular`のレンダリング結果です。

![finalSpecular](@site/docs/reference/loader/mmd-model-loader/mmd-standard-material/finalSpecular.png)
*`finalSpecular`をレンダリングした結果。これはスペキュラー光計算の結果です。*

### finalDiffuse + finalSpecular

最後に、拡散光とスペキュラー光の計算結果が加算されます。さらに、以下のプロパティが考慮されます：

- `StandardMaterial.ambientTexture` (**baseAmbientColor**)
- `StandardMaterial.reflectionTexture` (**reflectionColor**)
- `StandardMaterial.refractionTexture` (**refractionColor**)

ただし、現在の例ではこれらのプロパティは使用されていないため、シェーダーコードでは単に定数として初期化されています。

```cpp
    vec3 baseAmbientColor = vec3(1., 1., 1.);
    // ...
    vec4 refractionColor = vec4(0., 0., 0., 1.);
    vec4 reflectionColor = vec4(0., 0., 0., 1.);
    // ...
    vec4 color = vec4(finalDiffuse * baseAmbientColor + finalSpecular + reflectionColor.rgb + refractionColor.rgb, alpha);
```

以下は`finalDiffuse`と`finalSpecular`を加算した結果である`color`のレンダリング結果です。

![color](@site/docs/reference/loader/mmd-model-loader/mmd-standard-material/color.png)
*`color`をレンダリングした結果。これは`finalDiffuse`と`finalSpecular`を加算した結果です。*

### sphereReflectionColor

最後に、スフィアテクスチャを使用して球面環境マッピングが適用されます。

ここでは以下のマテリアルプロパティが使用されます：

- `StandardMaterial.sphereTexture` (**sphereSampler**)
- `StandardMaterial.sphereTextureMultiplicativeColor` (**sphereTextureMultiplicativeColor**)
- `StandardMaterial.sphereTextureAdditiveColor` (**sphereTextureAdditiveColor**)

通常、スフィアテクスチャはこのような球面テクスチャを使用します。

![sphereTexture](@site/docs/reference/loader/mmd-model-loader/mmd-standard-material/sphereTexture.png)\
*スフィアテクスチャデータの例*

```cpp
    vec3 viewSpaceNormal = normalize(mat3(view) * vNormalW);

    // 球面環境マッピング用のUV座標を計算します。
    vec2 sphereUV = viewSpaceNormal.xy * 0.5 + 0.5;

    vec4 sphereReflectionColor = texture(sphereSampler, sphereUV);
    // スフィアテクスチャカラーモーフィングを適用します。
    sphereReflectionColor.rgb = mix(
        vec3(1.0),
        sphereReflectionColor.rgb * sphereTextureMultiplicativeColor.rgb,
        sphereTextureMultiplicativeColor.a
    );
    sphereReflectionColor.rgb = clamp(
        sphereReflectionColor.rgb + (sphereReflectionColor.rgb - vec3(1.0)) * sphereTextureAdditiveColor.a,
        0.0,
        1.0
    ) + sphereTextureAdditiveColor.rgb;
    sphereReflectionColor.rgb *= diffuseBase;
```

球面環境マッピングを適用した結果である`sphereReflectionColor`のレンダリング結果は以下の通りです。

![sphereReflectionColor](@site/docs/reference/loader/mmd-model-loader/mmd-standard-material/sphereReflectionColor.png) \
*`sphereReflectionColor`をレンダリングした結果。これはスフィアテクスチャを使用した球面環境マッピングを適用した結果です。*

### 最終カラー

最後に、拡散光、スペキュラー光、反射色がすべて加算されて最終的な色が計算されます。

さらに、`Material.visibility`も考慮されます。

```cpp
    color = vec4(color.rgb + sphereReflectionColor.rgb, color.a); 
    color.rgb = max(color.rgb, 0.);
    color.a *= visibility;
    glFragColor = color;
}
```

![finalRender](@site/docs/reference/loader/mmd-model-loader/mmd-standard-material/finalRender.png)
*最終的なレンダリングの結果。拡散光、スペキュラー光、環境光を組み合わせたものです。*

## MMD スタンダードマテリアルシェーダーの完全なソースコード

上記で省略されたユニフォーム変数宣言と外部関数定義を含むGLSLソースコードは次の通りです：

<details>
<summary>MmdStandardMaterial用の整理されたGLSLシェーダーコード</summary>

```cpp
layout(std140, column_major) uniform;
uniform Material {
    vec2 vDiffuseInfos;
    vec4 vSpecularColor;
    vec3 vEmissiveColor;
    vec4 vDiffuseColor;
    vec3 vAmbientColor;
    vec4 textureMultiplicativeColor;
    vec4 textureAdditiveColor;
    vec4 sphereTextureMultiplicativeColor;
    vec4 sphereTextureAdditiveColor;
    vec4 toonTextureMultiplicativeColor;
    vec4 toonTextureAdditiveColor;
};

layout(std140, column_major) uniform;

uniform Scene {
    vec4 vEyePosition;
};

uniform float visibility;

#define WORLD_UBO

#define CUSTOM_FRAGMENT_BEGIN
in vec3 vPositionW;
in vec3 vNormalW;
in vec2 vMainUV1;

uniform Light0 {
    vec4 vLightData;
    vec4 vLightDiffuse;
    vec4 vLightSpecular;
    vec4 shadowsInfo;
    vec2 depthValues;
}
light0;

in vec4 vPositionFromLight0;
in float vDepthMetric0;

uniform highp sampler2DShadow shadowTexture0;
uniform mat4 lightMatrix0;

struct lightingInfo {
    float ndl;
    float isToon;
    vec3 diffuse;
    vec3 specular;
};

lightingInfo computeLighting(vec3 viewDirectionW, vec3 vNormal, vec4 lightData, vec3 diffuseColor, vec3 specularColor, float range, float glossiness) {
    lightingInfo result;
    vec3 lightVectorW;
    float attenuation = 1.0;
    if (lightData.w == 0.) {
        vec3 direction = lightData.xyz - vPositionW;
        attenuation = max(0., 1.0 - length(direction) / range);
        lightVectorW = normalize(direction);
    } else {
        lightVectorW = normalize(-lightData.xyz);
    }
    float ndl = max(0., dot(vNormal, lightVectorW));
    result.diffuse = diffuseColor * attenuation;
    result.ndl = ndl;
    result.isToon = 1.0;
    vec3 angleW = normalize(viewDirectionW + lightVectorW);
    float specComp = max(0., dot(vNormal, angleW));
    specComp = pow(specComp, max(1., glossiness));
    result.specular = specComp * specularColor * attenuation;
    return result;
}

#define TEXTUREFUNC(s, c, l) textureLod(s, c, l)

float computeFallOff(float value, vec2 clipSpace, float frustumEdgeFalloff) {
    float mask = smoothstep(1.0 - frustumEdgeFalloff, 1.00000012, clamp(dot(clipSpace, clipSpace), 0., 1.));
    return mix(value, 1.0, mask);
}

#define ZINCLIP uvDepth.z
#define DISABLE_UNIFORMITY_ANALYSIS

#define inline
float computeShadowWithPCF3(vec4 vPositionFromLight, float depthMetric, highp sampler2DShadow shadowSampler, vec2 shadowMapSizeAndInverse, float darkness, float frustumEdgeFalloff) {
    if (depthMetric > 1.0 || depthMetric < 0.0) {
        return 1.0;
    } else {
        vec3 clipSpace = vPositionFromLight.xyz / vPositionFromLight.w;
        vec3 uvDepth = vec3(0.5 * clipSpace.xyz + vec3(0.5));
        uvDepth.z = ZINCLIP;
        vec2 uv = uvDepth.xy * shadowMapSizeAndInverse.x;
        uv += 0.5;
        vec2 st = fract(uv);
        vec2 base_uv = floor(uv) - 0.5;
        base_uv *= shadowMapSizeAndInverse.y;
        vec2 uvw0 = 3. - 2. * st;
        vec2 uvw1 = 1. + 2. * st;
        vec2 u = vec2((2. - st.x) / uvw0.x - 1., st.x / uvw1.x + 1.) * shadowMapSizeAndInverse.y;
        vec2 v = vec2((2. - st.y) / uvw0.y - 1., st.y / uvw1.y + 1.) * shadowMapSizeAndInverse.y;
        float shadow = 0.;
        shadow += uvw0.x * uvw0.y * TEXTUREFUNC(shadowSampler, vec3(base_uv.xy + vec2(u[0], v[0]), uvDepth.z), 0.);
        shadow += uvw1.x * uvw0.y * TEXTUREFUNC(shadowSampler, vec3(base_uv.xy + vec2(u[1], v[0]), uvDepth.z), 0.);
        shadow += uvw0.x * uvw1.y * TEXTUREFUNC(shadowSampler, vec3(base_uv.xy + vec2(u[0], v[1]), uvDepth.z), 0.);
        shadow += uvw1.x * uvw1.y * TEXTUREFUNC(shadowSampler, vec3(base_uv.xy + vec2(u[1], v[1]), uvDepth.z), 0.);
        shadow = shadow / 16.;
        shadow = mix(darkness, 1., shadow);
        return computeFallOff(shadow, clipSpace.xy, frustumEdgeFalloff);
    }
}

#define vDiffuseUV vMainUV1
uniform sampler2D diffuseSampler;

uniform sampler2D sphereSampler;
uniform sampler2D toonSampler;
uniform mat4 view;
#define CUSTOM_FRAGMENT_DEFINITIONS
layout(location = 0) out vec4 glFragColor;

void main(void) {
    vec3 toonNdl;
#define CUSTOM_FRAGMENT_MAIN_BEGIN
    vec3 viewDirectionW = normalize(vEyePosition.xyz - vPositionW);
    vec4 baseColor = vec4(1., 1., 1., 1.);
    
    // 拡散色とアンビエント色の合計が拡散色として使用されます。
    // これはMMDのシェーダーと同じ結果を得るためであり、一般的なアプローチではありません。
    // この時点で、シェーダーには見えませんが、vAmbientColorの値はscene.ambientColor * material.ambientColorです。
    // したがって、MMDがアンビエント色のプロパティに適用する0.5のスケーリングと同じ実装をするには、
    // scene.ambientColorの値を(0.5, 0.5, 0.5)にする必要があります。
    vec3 diffuseColor = clamp(vDiffuseColor.rgb + vAmbientColor, 0.0, 1.0);
    float alpha = clamp(vDiffuseColor.a, 0.0, 1.0);

    vec3 normalW = normalize(vNormalW);
    vec2 uvOffset = vec2(0.0, 0.0);
    baseColor = texture(diffuseSampler, (vDiffuseUV + uvOffset));

    // マテリアル拡散テクスチャカラーモーフィングを適用します。
    baseColor.rgb = mix(
        vec3(1.0),
        baseColor.rgb * textureMultiplicativeColor.rgb,
        textureMultiplicativeColor.a
    );
    baseColor.rgb = clamp(
        baseColor.rgb + (baseColor.rgb - vec3(1.0)) * textureAdditiveColor.a,
        0.0,
        1.0
    ) + textureAdditiveColor.rgb;

#define CUSTOM_FRAGMENT_UPDATE_ALPHA
    baseColor.rgb *= vDiffuseInfos.y;
#define CUSTOM_FRAGMENT_UPDATE_DIFFUSE
    vec3 baseAmbientColor = vec3(1., 1., 1.);
#define CUSTOM_FRAGMENT_BEFORE_LIGHTS
    float glossiness = vSpecularColor.a;
    vec3 specularColor = vSpecularColor.rgb;
    vec3 diffuseBase = vec3(0., 0., 0.);
    lightingInfo info;
    vec3 specularBase = vec3(0., 0., 0.);
    float shadow = 1.;
    float aggShadow = 0.;
    float numLights = 0.;
    vec4 diffuse0 = light0.vLightDiffuse;
#define CUSTOM_LIGHT0_COLOR
    // ディレクショナルライト用のBlinn-Phongモデルを使用してシェーディングを計算します。
    info = computeLighting(viewDirectionW, normalW, light0.vLightData, diffuse0.rgb, light0.vLightSpecular.rgb, diffuse0.a, glossiness);
    // ここでは、パーセンテージクローザーフィルタリング（PCF）を使用して影が計算されます。これはShadowGeneratorの設定によって異なります。
    shadow = computeShadowWithPCF3(vPositionFromLight0, vDepthMetric0, shadowTexture0, light0.shadowsInfo.yz, light0.shadowsInfo.x, light0.shadowsInfo.w);
    aggShadow += shadow;
    numLights += 1.0;
    // シャドウが適用されたBlinn-Phongモデル値をトゥーンテクスチャにマッピングしてランプテクスチャシェーディングを適用します。
    toonNdl = vec3(clamp(info.ndl * shadow, 0.02, 0.98));
    toonNdl.r = texture(toonSampler, vec2(0.5, toonNdl.r)).r;
    toonNdl.g = texture(toonSampler, vec2(0.5, toonNdl.g)).g;
    toonNdl.b = texture(toonSampler, vec2(0.5, toonNdl.b)).b;
    diffuseBase += mix(info.diffuse * shadow, toonNdl * info.diffuse, info.isToon);
    // info.specularはハーフベクトルによって近似されたr dot l値です。
    specularBase += info.specular * shadow;
    aggShadow = aggShadow / numLights;
    vec4 refractionColor = vec4(0., 0., 0., 1.);
    vec4 reflectionColor = vec4(0., 0., 0., 1.);
    vec3 emissiveColor = vEmissiveColor;
    vec3 finalDiffuse = clamp(diffuseBase * diffuseColor + emissiveColor, 0.0, 1.0) * baseColor.rgb;
    vec3 finalSpecular = specularBase * specularColor;
    vec4 color = vec4(finalDiffuse * baseAmbientColor + finalSpecular + reflectionColor.rgb + refractionColor.rgb, alpha);
#define CUSTOM_FRAGMENT_BEFORE_FOG
    vec3 viewSpaceNormal = normalize(mat3(view) * vNormalW);

    // 球面環境マッピング用のUV座標を計算します。
    vec2 sphereUV = viewSpaceNormal.xy * 0.5 + 0.5;

    vec4 sphereReflectionColor = texture(sphereSampler, sphereUV);
    // スフィアテクスチャカラーモーフィングを適用します。
    sphereReflectionColor.rgb = mix(
        vec3(1.0),
        sphereReflectionColor.rgb * sphereTextureMultiplicativeColor.rgb,
        sphereTextureMultiplicativeColor.a
    );
    sphereReflectionColor.rgb = clamp(
        sphereReflectionColor.rgb + (sphereReflectionColor.rgb - vec3(1.0)) * sphereTextureAdditiveColor.a,
        0.0,
        1.0
    ) + sphereTextureAdditiveColor.rgb;
    sphereReflectionColor.rgb *= diffuseBase;
    // スフィアテクスチャをアドブレンドモードとして適用します。乗算ブレンドモードを使用する場合は異なるコードが適用されます。
    color = vec4(color.rgb + sphereReflectionColor.rgb, color.a); 
    color.rgb = max(color.rgb, 0.);
    color.a *= visibility;
#define CUSTOM_FRAGMENT_BEFORE_FRAGCOLOR
    glFragColor = color;
#define CUSTOM_FRAGMENT_MAIN_END
}
```

</details>

## アウトラインレンダリング

babylon-mmdは、MMDのレンダリング方式を実装するための**`MmdOutlineRenderer`** を提供しています。このレンダラーは、MMDの**トゥーンエッジ**を実装するために使用されます。

**`MmdOutlineRenderer`** は、メッシュのアウトラインをレンダリングするために**反転ハル法**を使用します。このメソッドは、メッシュのすべての面を反転させて再度レンダリングすることでアウトラインをレンダリングします。

その結果、アウトラインをレンダリングする際、メッシュの数と同じ数の**追加のドローコール**が発生します。

### 使用方法

**"babylon-mmd/esm/Loader/mmdOutlineRenderer"**をインポートすると、プロトタイプ拡張を使用して**`MmdOutlineRenderer`** が`Scene`に追加されます。

```typescript
import "babylon-mmd/esm/Loader/mmdOutlineRenderer";
```

その後、マテリアルに以下の**4つのプロパティ**がある場合、アウトラインがレンダリングされます。（**`MmdStandardMaterial`** はデフォルトでこれらのプロパティを持っています）

- **`renderOutline`** (boolean)
- **`outlineWidth`** (number)
- **`outlineColor`** (Color3)
- **`outlineAlpha`** (number)

したがって、以下のようにこれらのプロパティを追加することで、**任意のマテリアル**でアウトラインをレンダリングできます：

```typescript
class OutlinePBRMaterial extends PBRMaterial {
    private _renderOutline = false;
    public outlineWidth = 0.01;
    public outlineColor = new Color3(0, 0, 0);
    public outlineAlpha = 1.0;

    public get renderOutline(): boolean {
        return this._renderOutline;
    }

    public set renderOutline(value: boolean) {
        // コンポーネントの遅延ロード
        if (value) {
            this.getScene().getMmdOutlineRenderer?.();
        }
        this._renderOutline = value;
    }
}
```

これは、`renderOutline`プロパティがtrueになったときにシーンに`MmdOutlineRenderer`を登録することで**遅延ロード**を実装します。

### MmdStandardMaterialへの適用

**`MmdStandardMaterial`** の場合、**`MmdStandardMaterialBuilder`** によって設定が自動的に構成され、
動作させるためにはコードに`import "babylon-mmd/esm/Loader/mmdOutlineRenderer";`を追加するだけで済みます。

![outline](@site/docs/reference/loader/mmd-model-loader/mmd-standard-material/outline.png)
*アウトラインが適用された結果。*
