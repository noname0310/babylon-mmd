# Bake Physics Animation (External)

Use [NexGiMa](https://sites.google.com/view/nexgima/Home) to bake physics animation.

## Download Animation: "ピチカートドロップス"

If you already have a desired motion, feel free to use it. In this tutorial, we will use "ピチカートドロップス" by じゅんこだ and Akira-K

You can download the motion from **[here](https://bowlroll.net/file/133877)**.

![zip file](image.png)

Compressed files distributed by the Japanese often have encoding problems. Compression programs such as [Bandizip](https://en.bandisoft.com/bandizip/) can solve this problem by changing the codepage.

![zip file encode fixed](image-1.png)

And We'll use 10 million's camera motion.

You can download the camera motion from **[here](https://www.nicovideo.jp/watch/sm36273873)**.

*Check the video description for the download link.*

unzip camera motion file as same as the motion file.

## Edit PMX Model For Bake Physics Animation

Some models can be baked without modification, but others don't. They need to be modified to be baked.

:::danger
NexGiMa(which we will use later) has a bug that does not properly convert bone name in certain Chinese characters. Therefore, for some models, the bone name needs to be modified.

The model we use as an example also has this problem, and we will try to use the animation retargeting function to solve it.
:::

We will use PMXEditor to edit the model.

You can download PMXEditor from **[here](https://www.deviantart.com/johnwithlenon/art/PmxEditor-v0273-English-Version-unofficial-trans-925125044)**

![pmxe open](image-2.png)

Drag and drop the model file*(YYB Piano dress Miku/YYB Piano dress Miku.pmx)* into PMXEditor.

![pmxe model load](image-3.png)

### Add Display Frames

Goto bone tab and select all bones.

![select all bones](image-4.png)

Copy bone indices.

![copy bone indices](image-5.png)

Goto Display Panel tab and add new.

![add new disp](image-6.png)

Paste bone indices into "new"

![add from index](image-7.png)

### Rename Bones

Bones with Chinese characters "飘带", "结", "领结" need to be renamed.

308~315, 540~583 bones have problems.

:::info
I don't know exactly what characters are causing the problem,

The most obvious way to rule out errors is to just rename all of the bones in English.
:::

rename bones like this:

![rename bone](image-8.png)

![rename bone2](image-9.png)

then save the model by ctrl+s.

**Convert Modefied Model to BPMX Again (sorry for the inconvenience)** - refer to [Convert PMX model into BPMX](../convert-pmx-model-into-bpmx/)

## Use NexGiMa to Bake Physics Animation

Download NexGiMa from **[here](https://sites.google.com/view/nexgima/Home)** and open it.

:::tip
NexGiMa is an MMD compatible program that supports baking physics animation.
:::

![nexgima open](image-10.png)

Drag and drop the model file*(YYB Piano dress Miku/YYB Piano dress Miku.pmx)* into NexGiMa.

![nexgima model load](image-11.png)

Drag and drop the motion file*(ピチカートドロップスモーション配布用 2/Tda式初音ミク.vmd)* into NexGiMa.

![nexgima motion load](image-12.png)

Click the "キー焼きこみ..." button to open the bake options window.

![bake window open menu](image-13.png)

Check the "物理焼き込み" option and click the "OK" button.

![bake options](image-14.png)

After baking, there is a physics animation. You can select all of these and export the animation.

![bake result](image-15.png)

Select the display frame for export the keyframes. then click the "範囲選択" for select all keyframes in the display frame.

![select keyframes](image-16.png)

Click the "モーションを保存する..." button to export the keyframes.

![export keyframes](image-17.png)

Save is as "pizzicato_drops_yyb_piano_miku_phys".

:::tip
Baked physics animations are only valid for the model you baked. so it is recommended to save the animation with the model name.
:::

![save window](image-18.png)
