---
sidebar_position: 3
sidebar_label: MMD StandardMaterial
---

# MMD StandardMaterial

이 섹션에서는 babylon-mmd에서 MMD의 셰이딩 모델을 재현하기 위해 제공하는 **`MmdStandardMaterial`** 에 대해 설명합니다.

**`MmdStandardMaterial`** 은 Babylon.js의 **`StandardMaterial`** 을 기반으로 **`MaterialPlugin`** 을 사용하여 셰이더를 수정함으로써 MMD의 셰이딩 모델을 구현합니다.

## MMD의 셰이딩 모델과 `MmdStandardMaterial`

### 라이팅

MMD는 항상 씬에 전역적으로 존재하는 **하나의 디렉셔널 라이트**를 가지며, 추가 라이트가 없습니다.

babylon-mmd의 **`MmdStandardMaterial`** 은 MMD의 이러한 셰이딩 모델을 재현하므로, 씬에 **하나의 디렉셔널 라이트**만 있는 상황에서 가장 잘 작동합니다. 다른 시나리오에서도 작동하도록 설계되었지만, 시각적으로 매력적이지 않을 수 있습니다.

### 그라운드 셰도우

MMD는 **메시를 지면에 투영**함으로써 지면에 특별한 그림자를 구현합니다. 이를 **그라운드 셰도우**라고 합니다.

babylon-mmd는 이를 구현하지 않습니다. (요청이 있다면 나중에 추가될 수 있습니다.)
대신 Babylon.js의 **ShadowGenerator**를 사용하여 그림자를 구현할 수 있습니다.

### 셰도우

MMD는 메시가 **그림자를 드리우거나 받는지**를 머티리얼 속성을 통해 제어합니다. babylon-mmd는 이를 구현하지 않으며, 그림자 제어에 대한 책임은 사용자에게 있습니다. (이 또한 요청이 있다면 나중에 추가될 수 있습니다.)

### 렌더링 방식

MMD는 **포워드 렌더링** 접근 방식을 사용합니다. 각 메시의 **드로우 순서**는 항상 머티리얼 순서로 고정되어 있으며, 모든 머티리얼은 **뎁스 라이트와 뎁스 테스트**를 수행하고 **알파 블렌딩**을 사용하여 그려집니다.

## MMD 머티리얼 속성

MMD 머티리얼에는 다양한 속성이 있으며, **`MmdStandardMaterial`** 클래스는 MMD 머티리얼의 각 속성에 해당하는 속성을 제공합니다.

MMD 머티리얼의 속성과 **`MmdStandardMaterial`** 에서 해당하는 속성은 다음과 같습니다:

| MMD 머티리얼 속성 | `MmdStandardMaterial` 속성 | 설명 |
|-----------------|----------------------------|------|
| diffuse(rgba) | diffuseColor(rgb), alpha(a) | 확산 반사 색상 및 투명도 |
| specular(rgb) | specularColor | 반사 색상 |
| ambient(rgb) | ambientColor | 환경광 색상 |
| reflect | specularPower | 반사 강도 |
|-----------------|----------------------------|------|
| is double sided | backFaceCulling | 메시의 양면을 렌더링할지 여부 |
| ground shadow | N/A | 구현되지 않음 |
| draw shadow | N/A | 구현되지 않음 |
| receive shadow | N/A | 구현되지 않음 |
| toon edge | renderOutline | 외곽선을 렌더링할지 여부 |
| vertex color (PMX 2.1 spec) | N/A | 구현되지 않음 |
| point draw (PMX 2.1 spec) | N/A | 구현되지 않음 |
| line draw (PMX 2.1 spec) | N/A | 구현되지 않음 |
|-----------------|----------------------------|------|
| edge color(rgba) | outlineColor(rgb), outlineAlpha(a) | 외곽선 색상 및 투명도 |
| edge size | outlineWidth | 외곽선 두께 |
| texture | diffuseTexture | 텍스처 |
| sphere texture | sphereTexture | 구형 환경 매핑에 사용되는 텍스처로, 반사 재질 표현에 사용 |
| sphere texture mode | sphereTextureBlendMode | 스피어 텍스처 블렌딩 모드 |
| toon texture | toonTexture | 램프 텍스처 셰이딩에 사용되는 텍스처 |

또한, 머티리얼 모핑에 의해 적용되는 속성들이 있습니다. 이들은 MMD에서 표면적으로 노출되지 않으며 머티리얼 모핑을 통해서만 변경할 수 있는 파라미터입니다.

| `MmdStandardMaterial` 속성 | 설명 |
|----------------------------|------|
| textureMultiplicativeColor(rgba) | 디퓨즈 텍스처에 곱해지는 색상 값 |
| textureAdditiveColor(rgba) | 디퓨즈 텍스처에 더해지는 색상 값 |
| sphereTextureMultiplicativeColor(rgba) | 스피어 텍스처에 곱해지는 색상 값 |
| sphereTextureAdditiveColor(rgba) | 스피어 텍스처에 더해지는 색상 값 |
| toonTextureMultiplicativeColor(rgba) | 툰 텍스처에 곱해지는 색상 값 |
| toonTextureAdditiveColor(rgba) | 툰 텍스처에 더해지는 색상 값 |

## MMD 머티리얼 구현

이제 MMD 스탠다드 머티리얼에서 실제로 사용되는 프래그먼트 셰이더 코드를 통해 각 속성이 계산에 어떻게 참여하는지 살펴보겠습니다.

이 문서는 GLSL(WebGL) 셰이더를 기반으로 설명하지만, WGSL(WebGPU) 코드도 동일한 방식으로 작동합니다.

:::tip
**실제 셰이더는 여러 케이스에 대한 최적화를 위해 수많은 #ifdef 분기를 포함합니다**. 이것은 전처리기가 적용된 후의 단순화된 예시입니다.
:::

다음은 Babylon.js 런타임에 의해 생성된 MMD 스탠다드 머티리얼의 **GLSL 프래그먼트 셰이더의 메인 함수**입니다. 핵심 부분을 따로 살펴보겠습니다.
```cpp
void main(void) {
    vec3 toonNdl;
#define CUSTOM_FRAGMENT_MAIN_BEGIN
    vec3 viewDirectionW = normalize(vEyePosition.xyz - vPositionW);
    vec4 baseColor = vec4(1., 1., 1., 1.);
    
    // 디퓨즈 색상과 앰비언트 색상의 합이 디퓨즈 색상으로 사용됩니다.
    // 이는 MMD의 셰이더와 동일한 결과를 얻기 위한 것으로, 일반적인 접근 방식은 아닙니다.
    // 이때, 셰이더에서는 보이지 않지만, vAmbientColor 값은 scene.ambientColor * material.ambientColor입니다.
    // 따라서 MMD가 앰비언트 색상 속성에 적용하는 0.5 스케일링과 동일하게 구현하기 위해서는
    // scene.ambientColor 값이 (0.5, 0.5, 0.5)이어야 합니다.
    vec3 diffuseColor = clamp(vDiffuseColor.rgb + vAmbientColor, 0.0, 1.0);
    float alpha = clamp(vDiffuseColor.a, 0.0, 1.0);

    vec3 normalW = normalize(vNormalW);
    vec2 uvOffset = vec2(0.0, 0.0);
    baseColor = texture(diffuseSampler, (vDiffuseUV + uvOffset));

    // 머티리얼 디퓨즈 텍스처 색상 모핑을 적용합니다.
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
    // 디렉셔널 라이트에 대해 Blinn-Phong 모델을 사용하여 셰이딩을 계산합니다.
    info = computeLighting(viewDirectionW, normalW, light0.vLightData, diffuse0.rgb, light0.vLightSpecular.rgb, diffuse0.a, glossiness);
    // 여기서 그림자는 퍼센티지 클로저 필터링(PCF)을 사용하여 계산됩니다. 이는 ShadowGenerator 설정에 따라 달라질 수 있습니다.
    shadow = computeShadowWithPCF3(vPositionFromLight0, vDepthMetric0, shadowTexture0, light0.shadowsInfo.yz, light0.shadowsInfo.x, light0.shadowsInfo.w);
    aggShadow += shadow;
    numLights += 1.0;
    // 그림자가 적용된 Blinn-Phong 모델 값을 툰 텍스처에 매핑하여 램프 텍스처 셰이딩을 적용합니다.
    toonNdl = vec3(clamp(info.ndl * shadow, 0.02, 0.98));
    toonNdl.r = texture(toonSampler, vec2(0.5, toonNdl.r)).r;
    toonNdl.g = texture(toonSampler, vec2(0.5, toonNdl.g)).g;
    toonNdl.b = texture(toonSampler, vec2(0.5, toonNdl.b)).b;
    diffuseBase += mix(info.diffuse * shadow, toonNdl * info.diffuse, info.isToon);
    // info.specular는 하프 벡터로 근사된 r dot l 값입니다.
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

    // 구형 환경 매핑을 위한 UV 좌표를 계산합니다.
    vec2 sphereUV = viewSpaceNormal.xy * 0.5 + 0.5;

    vec4 sphereReflectionColor = texture(sphereSampler, sphereUV);
    // 스피어 텍스처 색상 모핑을 적용합니다.
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
    // 스피어 텍스처를 add 블렌드 모드로 적용합니다. multiply 블렌드 모드를 사용할 때는 다른 코드가 적용됩니다.
    color = vec4(color.rgb + sphereReflectionColor.rgb, color.a); 
    color.rgb = max(color.rgb, 0.);
    color.a *= visibility;
#define CUSTOM_FRAGMENT_BEFORE_FRAGCOLOR
    glFragColor = color;
#define CUSTOM_FRAGMENT_MAIN_END
}
```

시각화를 돕기 위해, 샘플 모델로 **SANMUYYB의 YYB式初音ミク_10th_v1.02 모델**을 사용하겠습니다.

### baseColor

먼저, **`baseColor`는 텍스처에서 샘플링된 색상의 결과를 저장합니다**.
이 과정에서 다음 요소들이 고려됩니다:

- `MmdStandardMaterial.textureMultiplicativeColor`
- `MmdStandardMaterial.textureAdditiveColor`
- `BaseTexture.level`

```cpp
    vec4 baseColor = vec4(1., 1., 1., 1.);
    
    // ...
    
    // UV 모핑이 적용되면, 셰이더 코드 생성 중에 uvOffset 변수에 추가 계산이 적용됩니다.
    vec2 uvOffset = vec2(0.0, 0.0);
    baseColor = texture(diffuseSampler, (vDiffuseUV + uvOffset));

    // `textureMultiplicativeColor` 적용
    baseColor.rgb = mix(
        vec3(1.0),
        baseColor.rgb * textureMultiplicativeColor.rgb,
        textureMultiplicativeColor.a
    );
    // `textureAdditiveColor` 적용
    baseColor.rgb = clamp(
        baseColor.rgb + (baseColor.rgb - vec3(1.0)) * textureAdditiveColor.a,
        0.0,
        1.0
    ) + textureAdditiveColor.rgb;

#define CUSTOM_FRAGMENT_UPDATE_ALPHA
    baseColor.rgb *= vDiffuseInfos.y; // vDiffuseInfos.y는 `BaseTexture.level`의 값입니다
```

![baseColor](@site/docs/reference/loader/mmd-model-loader/mmd-standard-material/baseColor.png)
*`baseColor`를 렌더링한 결과.*

### lightingInfo

**computeLighting 함수**가 호출되어 **Blinn-Phong 모델**을 사용하여 라이팅 정보를 계산합니다.

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

`computeLighting` 함수는 다음 파라미터를 사용하여 디렉셔널 라이트에 대한 셰이딩을 계산합니다:

- 뷰 방향 (**viewDirectionW**)
- 표면 노말 (**normalW**)
- `DirectionalLight.direction` (**light0.vLightData**)
- `DirectionalLight.diffuse` (**diffuse0.rgb**)
- `DirectionalLight.specular` (**light0.vLightSpecular.rgb**)
- 라이트 범위 (디렉셔널 라이트에서는 감쇠가 고려되지 않으므로 사용되지 않음)
- `specularPower` (**glossiness**)

결과로 얻은 `ndl`, `diffuse`, `specular` 값은 다음과 같이 시각화됩니다:

|ndl|diffuse|specular|
|---|-------|--------|
|![ndl](@site/docs/reference/loader/mmd-model-loader/mmd-standard-material/ndl.png)|![diffuse](@site/docs/reference/loader/mmd-model-loader/mmd-standard-material/diffuse.png)|![specular](@site/docs/reference/loader/mmd-model-loader/mmd-standard-material/specular.png)|

*각 이미지는 `computeLighting` 함수의 결과로 계산된 `ndl`, `diffuse`, `specular` 값을 시각화합니다.*

`isToon` 값은 셰이더 주입 실패 시 정상 작동을 보장하기 위한 파라미터로, 항상 1.0 값을 가집니다. 셰이더 주입이 실패하면 이 값은 0.0이 되고, 이 값을 사용하여 향후 대체 처리가 수행됩니다.

이 섹션에서는 설명을 위해 `isToon` 값이 0.0인 경우는 고려하지 않겠습니다.

### shadow

그림자는 퍼센티지 클로저 필터링(PCF) 방식을 사용하여 계산됩니다. 이는 `ShadowGenerator`의 설정에 따라 크게 달라질 수 있습니다.

```cpp
    float shadow = 1.;
    // ...
    shadow = computeShadowWithPCF3(vPositionFromLight0, vDepthMetric0, shadowTexture0, light0.shadowsInfo.yz, light0.shadowsInfo.x, light0.shadowsInfo.w);
```

`shadow` 값은 다음과 같이 시각화됩니다:

![shadow](@site/docs/reference/loader/mmd-model-loader/mmd-standard-material/shadow.png)
*`shadow`를 렌더링한 결과.*

### diffuseBase

최종 셰이딩은 `ndl`에 `shadow`를 곱하여 계산됩니다. 그런 다음 결과는 toonTexture에 매핑됩니다.

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
*`info.ndl * shadow`를 렌더링한 결과.*

![toonNdl](@site/docs/reference/loader/mmd-model-loader/mmd-standard-material/toonNdl.png)

*그림자 값을 toonTexture(램프 텍스처)에 0과 1 사이로 매핑한 `toonNdl`을 렌더링한 결과.*

toonTexture는 일반적으로 이런 종류의 그라데이션을 가집니다. 값은 세로로 변하며, 아래쪽은 0에, 위쪽은 1에 매핑됩니다.

<img src={"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAOUlEQVRYR+3WMREAMAwDsYY/yoDI7MLwIiP40+RJklfcCCBAgAABAgTqArfb/QMCCBAgQIAAgbbAB3z/e0F3js2cAAAAAElFTkSuQmCC"} width="200"/>
*toonTexture 데이터 예시*

### finalDiffuse

마지막으로, 디퓨즈 라이팅은 툰 매핑된 결과인 `diffuseBase`를 취하여 머티리얼의 디퓨즈 색상을 곱하고, 머티리얼의 이미시브 색상을 더한 다음, 최종적으로 `baseColor`에서 샘플링된 결과를 곱하여 계산됩니다.

```cpp
    vec3 diffuseColor = clamp(vDiffuseColor.rgb + vAmbientColor, 0.0, 1.0);
    // ...
    vec3 emissiveColor = vEmissiveColor;
    vec3 finalDiffuse = clamp(diffuseBase * diffuseColor + emissiveColor, 0.0, 1.0) * baseColor.rgb;
```

머티리얼의 디퓨즈 색상은 다음과 같이 계산됩니다:

- `StandardMaterial.diffuseColor` (**vDiffuseColor**)
- `StandardMaterial.ambientColor` * `Scene.ambientColor` (**vAmbientColor**) - CPU는 머티리얼과 씬의 앰비언트 색상을 함께 곱하여 결과를 셰이더에 전달합니다.

`clamp(vDiffuseColor.rgb + vAmbientColor, 0.0, 1.0);`

앰비언트 색상도 디퓨즈 색상 계산에 관여하여 MMD 셰이더와 동일한 결과를 얻는 것을 볼 수 있으며, 이는 일반적인 접근 방식이 아닙니다.

:::warning
`Scene.ambientColor`는 vec3(0.5, 0.5, 0.5)로 설정해야 한다는 점에 유의하세요.
이는 MMD의 구현이 앰비언트 색상을 0.5로 스케일링하기 때문입니다.
따라서 동일한 결과를 얻으려면 씬의 앰비언트 색상을 0.5로 설정하여 MMD와 같은 0.5 스케일링으로 앰비언트 색상을 계산해야 합니다.
:::

![finalDiffuse](@site/docs/reference/loader/mmd-model-loader/mmd-standard-material/finalDiffuse.png)
*`finalDiffuse`, 디퓨즈 라이트 계산 결과를 렌더링한 결과.*

### finalSpecular

`shadow` 값은 그림자 영역을 제외하기 위해 `specular`와 곱해집니다.

그런 다음 머티리얼의 `StandardMaterial.specularColor` (**vSpecularColor**)를 사용하여 최종 스페큘러 값을 계산합니다.

```cpp
    vec3 specularColor = vSpecularColor.rgb;
    // ...
    vec3 specularBase = vec3(0., 0., 0.);
    // ...
    specularBase += info.specular * shadow;
    // ...
    vec3 finalSpecular = specularBase * specularColor;
```

아래는 최종 스페큘러 값인 `finalSpecular`의 렌더링 결과입니다.

![finalSpecular](@site/docs/reference/loader/mmd-model-loader/mmd-standard-material/finalSpecular.png)
*`finalSpecular`, 스페큘러 라이트 계산 결과를 렌더링한 결과.*

### finalDiffuse + finalSpecular

마지막으로 디퓨즈 라이트와 스페큘러 라이트 계산 결과가 합쳐집니다. 추가적으로 다음 속성들이 고려됩니다:

- `StandardMaterial.ambientTexture` (**baseAmbientColor**)
- `StandardMaterial.reflectionTexture` (**reflectionColor**)
- `StandardMaterial.refractionTexture` (**refractionColor**)

하지만 현재 예제에서는 이러한 속성들이 사용되지 않으므로, 셰이더 코드에서는 단순히 상수로 초기화됩니다.

```cpp
    vec3 baseAmbientColor = vec3(1., 1., 1.);
    // ...
    vec4 refractionColor = vec4(0., 0., 0., 1.);
    vec4 reflectionColor = vec4(0., 0., 0., 1.);
    // ...
    vec4 color = vec4(finalDiffuse * baseAmbientColor + finalSpecular + reflectionColor.rgb + refractionColor.rgb, alpha);
```

아래는 `finalDiffuse`와 `finalSpecular`를 더한 결과인 `color`의 렌더링 결과입니다.

![color](@site/docs/reference/loader/mmd-model-loader/mmd-standard-material/color.png)
*`color`, `finalDiffuse`와 `finalSpecular`를 더한 결과를 렌더링한 결과.*

### sphereReflectionColor

마지막으로 sphereTexture를 사용한 구형 환경 매핑이 적용됩니다.

여기서 다음 머티리얼 속성들이 사용됩니다:

- `StandardMaterial.sphereTexture` (**sphereSampler**)
- `StandardMaterial.sphereTextureMultiplicativeColor` (**sphereTextureMultiplicativeColor**)
- `StandardMaterial.sphereTextureAdditiveColor` (**sphereTextureAdditiveColor**)

일반적으로 sphereTexture는 다음과 같은 구형 텍스처를 사용합니다.

![sphereTexture](@site/docs/reference/loader/mmd-model-loader/mmd-standard-material/sphereTexture.png)\
*sphereTexture 데이터 예시*

```cpp
    vec3 viewSpaceNormal = normalize(mat3(view) * vNormalW);

    // 구형 환경 매핑을 위한 UV 좌표를 계산합니다.
    vec2 sphereUV = viewSpaceNormal.xy * 0.5 + 0.5;

    vec4 sphereReflectionColor = texture(sphereSampler, sphereUV);
    // 스피어 텍스처 색상 모핑을 적용합니다.
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

구형 환경 매핑을 적용한 결과인 `sphereReflectionColor`의 렌더링 결과는 다음과 같습니다.

![sphereReflectionColor](@site/docs/reference/loader/mmd-model-loader/mmd-standard-material/sphereReflectionColor.png)

*sphereTexture를 사용한 구형 환경 매핑을 적용한 결과인 `sphereReflectionColor`를 렌더링한 결과.*

### 최종 색상

마지막으로, 디퓨즈 라이팅, 스페큘러 라이팅, 반사 색상을 모두 더해 최종 색상을 계산합니다.

또한 `Material.visibility`도 고려됩니다.

```cpp
    color = vec4(color.rgb + sphereReflectionColor.rgb, color.a); 
    color.rgb = max(color.rgb, 0.);
    color.a *= visibility;
    glFragColor = color;
}
```

![finalRender](@site/docs/reference/loader/mmd-model-loader/mmd-standard-material/finalRender.png)
*디퓨즈 라이트, 스페큘러 라이트, 환경 라이트를 결합한 최종 렌더링 결과.*

## Mmd Standard Material 셰이더의 전체 소스 코드

균일 변수 선언 및 외부 함수 정의를 포함한 GLSL 소스 코드는 다음과 같습니다:

<details>
<summary>MmdStandardMaterial을 위한 정리된 GLSL 셰이더 코드</summary>

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
    
    // 디퓨즈 색상과 앰비언트 색상의 합이 디퓨즈 색상으로 사용됩니다.
    // 이는 MMD의 셰이더와 동일한 결과를 얻기 위한 것으로, 일반적인 접근 방식은 아닙니다.
    // 이때, 셰이더에서는 보이지 않지만, vAmbientColor 값은 scene.ambientColor * material.ambientColor입니다.
    // 따라서 MMD가 앰비언트 색상 속성에 적용하는 0.5 스케일링과 동일하게 구현하기 위해서는
    // scene.ambientColor 값이 (0.5, 0.5, 0.5)이어야 합니다.
    vec3 diffuseColor = clamp(vDiffuseColor.rgb + vAmbientColor, 0.0, 1.0);
    float alpha = clamp(vDiffuseColor.a, 0.0, 1.0);

    vec3 normalW = normalize(vNormalW);
    vec2 uvOffset = vec2(0.0, 0.0);
    baseColor = texture(diffuseSampler, (vDiffuseUV + uvOffset));

    // 머티리얼 디퓨즈 텍스처 색상 모핑을 적용합니다.
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
    // 디렉셔널 라이트에 대해 Blinn-Phong 모델을 사용하여 셰이딩을 계산합니다.
    info = computeLighting(viewDirectionW, normalW, light0.vLightData, diffuse0.rgb, light0.vLightSpecular.rgb, diffuse0.a, glossiness);
    // 여기서 그림자는 퍼센티지 클로저 필터링(PCF)을 사용하여 계산됩니다. 이는 ShadowGenerator 설정에 따라 달라질 수 있습니다.
    shadow = computeShadowWithPCF3(vPositionFromLight0, vDepthMetric0, shadowTexture0, light0.shadowsInfo.yz, light0.shadowsInfo.x, light0.shadowsInfo.w);
    aggShadow += shadow;
    numLights += 1.0;
    // 그림자가 적용된 Blinn-Phong 모델 값을 툰 텍스처에 매핑하여 램프 텍스처 셰이딩을 적용합니다.
    toonNdl = vec3(clamp(info.ndl * shadow, 0.02, 0.98));
    toonNdl.r = texture(toonSampler, vec2(0.5, toonNdl.r)).r;
    toonNdl.g = texture(toonSampler, vec2(0.5, toonNdl.g)).g;
    toonNdl.b = texture(toonSampler, vec2(0.5, toonNdl.b)).b;
    diffuseBase += mix(info.diffuse * shadow, toonNdl * info.diffuse, info.isToon);
    // info.specular는 하프 벡터로 근사된 r dot l 값입니다.
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

    // 구형 환경 매핑을 위한 UV 좌표를 계산합니다.
    vec2 sphereUV = viewSpaceNormal.xy * 0.5 + 0.5;

    vec4 sphereReflectionColor = texture(sphereSampler, sphereUV);
    // 스피어 텍스처 색상 모핑을 적용합니다.
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
    // 스피어 텍스처를 add 블렌드 모드로 적용합니다. multiply 블렌드 모드를 사용할 때는 다른 코드가 적용됩니다.
    color = vec4(color.rgb + sphereReflectionColor.rgb, color.a); 
    color.rgb = max(color.rgb, 0.);
    color.a *= visibility;
#define CUSTOM_FRAGMENT_BEFORE_FRAGCOLOR
    glFragColor = color;
#define CUSTOM_FRAGMENT_MAIN_END
}
```

</details>

## 외곽선 렌더링

babylon-mmd는 MMD의 렌더링 방식을 구현하기 위해 **`MmdOutlineRenderer`** 를 제공합니다. 이 렌더러는 MMD의 **툰 엣지**를 구현하는 데 사용됩니다.

**`MmdOutlineRenderer`** 는 메시의 외곽선을 렌더링하기 위해 **인버티드 헐 메서드**를 사용합니다. 이 메서드는 메시의 모든 면을 뒤집고 다시 렌더링하여 외곽선을 렌더링합니다.

결과적으로 외곽선을 렌더링할 때는 메시 수만큼 **추가적인 드로우 콜**이 발생합니다.

### 사용법

**"babylon-mmd/esm/Loader/mmdOutlineRenderer"**를 임포트하면, 프로토타입 확장을 사용하여 **`MmdOutlineRenderer`** 가 `Scene`에 추가됩니다.

```typescript
import "babylon-mmd/esm/Loader/mmdOutlineRenderer";
```

그 후, 머티리얼이 다음 **네 가지 속성**을 가지고 있다면 외곽선이 렌더링됩니다. (**`MmdStandardMaterial`** 은 기본적으로 이러한 속성을 가집니다.)

- **`renderOutline`** (boolean)
- **`outlineWidth`** (number)
- **`outlineColor`** (Color3)
- **`outlineAlpha`** (number)

따라서 다음과 같이 이러한 속성을 추가하면 **어떤 머티리얼**이든 외곽선을 렌더링할 수 있습니다:

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
        // 레이지 로드 컴포넌트
        if (value) {
            this.getScene().getMmdOutlineRenderer?.();
        }
        this._renderOutline = value;
    }
}
```

이는 `renderOutline` 속성이 true가 될 때 `MmdOutlineRenderer`를 씬에 등록하는 **레이지 로딩**을 구현합니다.

### MmdStandardMaterial에 적용

**`MmdStandardMaterial`** 의 경우, 설정은 **`MmdStandardMaterialBuilder`** 에 의해 자동으로 구성되며,
작동하기 위해서는 코드에 `import "babylon-mmd/esm/Loader/mmdOutlineRenderer";`만 추가하면 됩니다.

![outline](@site/docs/reference/loader/mmd-model-loader/mmd-standard-material/outline.png)
*외곽선이 적용된 결과.*
