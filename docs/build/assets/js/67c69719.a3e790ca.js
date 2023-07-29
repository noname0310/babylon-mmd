"use strict";(self.webpackChunkbabylon_mmd_docs=self.webpackChunkbabylon_mmd_docs||[]).push([[750],{1221:(e,t,n)=>{n.r(t),n.d(t,{assets:()=>s,contentTitle:()=>m,default:()=>p,frontMatter:()=>d,metadata:()=>l,toc:()=>c});var a=n(7462),i=(n(7294),n(3905)),o=n(2004);const r=n.p+"assets/medias/2023-07-27 17-00-43-38f4dd53bed4d39e471c3900c6df6183.mp4",d={},m="Load Animation",l={unversionedId:"quick-start/load-animation/index",id:"quick-start/load-animation/index",title:"Load Animation",description:"Learn how to load and play animations in VMD format.",source:"@site/docs/0-quick-start/2-load-animation/index.mdx",sourceDirName:"0-quick-start/2-load-animation",slug:"/quick-start/load-animation/",permalink:"/babylon-mmd/docs/quick-start/load-animation/",draft:!1,editUrl:"https://github.com/noname0310/babylon-mmd/tree/main/docs/babylon-mmd-docs/docs/0-quick-start/2-load-animation/index.mdx",tags:[],version:"current",frontMatter:{},sidebar:"docsSidebar",previous:{title:"Load MMD Model",permalink:"/babylon-mmd/docs/quick-start/load-mmd-model/"},next:{title:"Audio and Player Controls",permalink:"/babylon-mmd/docs/quick-start/audio-and-player/"}},s={},c=[{value:"Download Animation: &quot;\u30e1\u30e9\u30f3\u30b3\u30ea\u30fb\u30ca\u30a4\u30c8&quot;",id:"download-animation-\u30e1\u30e9\u30f3\u30b3\u30ea\u30ca\u30a4\u30c8",level:2},{value:"Create MMD Runtime",id:"create-mmd-runtime",level:2},{value:"Load VMD Animation",id:"load-vmd-animation",level:2}],u={toc:c},A="wrapper";function p(e){let{components:t,...d}=e;return(0,i.kt)(A,(0,a.Z)({},u,d,{components:t,mdxType:"MDXLayout"}),(0,i.kt)("h1",{id:"load-animation"},"Load Animation"),(0,i.kt)("p",null,"Learn how to load and play animations in VMD format."),(0,i.kt)("h2",{id:"download-animation-\u30e1\u30e9\u30f3\u30b3\u30ea\u30ca\u30a4\u30c8"},'Download Animation: "\u30e1\u30e9\u30f3\u30b3\u30ea\u30fb\u30ca\u30a4\u30c8"'),(0,i.kt)("p",null,'If you already have a desired motion, feel free to use it. In this tutorial, we will use "\u30e1\u30e9\u30f3\u30b3\u30ea\u30fb\u30ca\u30a4\u30c8" by \u307b\u3046\u304d\u5802'),(0,i.kt)("p",null,"You can download the motion from ",(0,i.kt)("a",{parentName:"p",href:"https://www.nicovideo.jp/watch/sm41164308"},"here"),"."),(0,i.kt)("p",null,(0,i.kt)("em",{parentName:"p"},"Check the video description for the download link.")),(0,i.kt)("p",null,(0,i.kt)("img",{alt:"Zip file",src:n(2358).Z,width:"820",height:"493"})),(0,i.kt)("p",null,"Compressed files distributed by the Japanese often have encoding problems. Compression programs such as ",(0,i.kt)("a",{parentName:"p",href:"https://en.bandisoft.com/bandizip/"},"Bandizip")," can solve this problem by changing the codepage."),(0,i.kt)("p",null,(0,i.kt)("img",{alt:"ZIp file fixed",src:n(8038).Z,width:"820",height:"493"})),(0,i.kt)("p",null,'Unzip the downloaded zip file and copy the "\u30e1\u30e9\u30f3\u30b3\u30ea\u30fb\u30ca\u30a4\u30c8" folder to the "res" folder.'),(0,i.kt)("p",null,(0,i.kt)("img",{alt:"Vscode file structure",src:n(7784).Z,width:"316",height:"293"})),(0,i.kt)("p",null,"Your file structure should look like this."),(0,i.kt)("h2",{id:"create-mmd-runtime"},"Create MMD Runtime"),(0,i.kt)("p",null,"MMD has its proprietary animation system, so we provides a runtime to reproduce it. We will create an MMD Runtime and make the camera and mesh controlled by the runtime."),(0,i.kt)("pre",null,(0,i.kt)("code",{parentName:"pre",className:"language-typescript",metastring:'title="src/sceneBuilder.ts"',title:'"src/sceneBuilder.ts"'},"const mmdRuntime = new MmdRuntime();\nmmdRuntime.register(scene);\n\nmmdRuntime.setCamera(camera);\nconst mmdModel = mmdRuntime.createMmdModel(mmdMesh);\n")),(0,i.kt)("ul",null,(0,i.kt)("li",{parentName:"ul"},(0,i.kt)("inlineCode",{parentName:"li"},"mmdRuntime.register(scene)")," - Register the runtime to the scene update loop. This is required to runtime to work."),(0,i.kt)("li",{parentName:"ul"},(0,i.kt)("inlineCode",{parentName:"li"},"mmdRuntime.setCamera(camera)")," - Set the camera to be controlled by the runtime."),(0,i.kt)("li",{parentName:"ul"},(0,i.kt)("inlineCode",{parentName:"li"},"mmdRuntime.createMmdModel(mmdMesh)")," - Create an MMD model from the mesh. ",(0,i.kt)("inlineCode",{parentName:"li"},"MmdModel")," is a kind of controller that abstracts and controls Mesh from the perspective of MMD.")),(0,i.kt)("h2",{id:"load-vmd-animation"},"Load VMD Animation"),(0,i.kt)("p",null,"For load vmd animation, we use the ",(0,i.kt)("inlineCode",{parentName:"p"},"VmdLoader"),"."),(0,i.kt)("pre",null,(0,i.kt)("code",{parentName:"pre",className:"language-typescript",metastring:'title="src/sceneBuilder.ts"',title:'"src/sceneBuilder.ts"'},'const vmdLoader = new VmdLoader(scene);\nconst modelMotion = await vmdLoader.loadAsync("model_motion_1", [\n    "res/\u30e1\u30e9\u30f3\u30b3\u30ea\u30fb\u30ca\u30a4\u30c8/\u30e1\u30e9\u30f3\u30b3\u30ea\u30fb\u30ca\u30a4\u30c8.vmd",\n    "res/\u30e1\u30e9\u30f3\u30b3\u30ea\u30fb\u30ca\u30a4\u30c8/\u30e1\u30e9\u30f3\u30b3\u30ea\u30fb\u30ca\u30a4\u30c8_\u8868\u60c5\u30e2\u30fc\u30b7\u30e7\u30f3.vmd",\n    "res/\u30e1\u30e9\u30f3\u30b3\u30ea\u30fb\u30ca\u30a4\u30c8/\u30e1\u30e9\u30f3\u30b3\u30ea\u30fb\u30ca\u30a4\u30c8_\u30ea\u30c3\u30d7\u30e2\u30fc\u30b7\u30e7\u30f3.vmd"\n]);\nconst cameraMotion = await vmdLoader.loadAsync("camera_motion_1",\n    "res/\u30e1\u30e9\u30f3\u30b3\u30ea\u30fb\u30ca\u30a4\u30c8/\u30e1\u30e9\u30f3\u30b3\u30ea\u30fb\u30ca\u30a4\u30c8_\u30ab\u30e1\u30e9.vmd"\n);\n')),(0,i.kt)("ul",null,(0,i.kt)("li",{parentName:"ul"},(0,i.kt)("p",{parentName:"li"},(0,i.kt)("inlineCode",{parentName:"p"},"vmdLoader.loadAsync")," returns ",(0,i.kt)("inlineCode",{parentName:"p"},"MmdAnimation"),", which can store one model and one camera animation. There is no type distinction between camera animation and model animation.")),(0,i.kt)("li",{parentName:"ul"},(0,i.kt)("p",{parentName:"li"},"The motion we are currently using is divided into skeleton, facial, and lip components. While combining them in advance and loading as one would be more performance-efficient, in this tutorial, we will use a feature to merge multiple motions into one."),(0,i.kt)("ul",{parentName:"li"},(0,i.kt)("li",{parentName:"ul"},"By looking at the code for creating ",(0,i.kt)("inlineCode",{parentName:"li"},"modelMotion")," you can identify the merging method.")))),(0,i.kt)("pre",null,(0,i.kt)("code",{parentName:"pre",className:"language-typescript",metastring:'title="src/sceneBuilder.ts"',title:'"src/sceneBuilder.ts"'},'mmdModel.addAnimation(modelMotion);\nmmdModel.setAnimation("model_motion_1");\n\ncamera.addAnimation(cameraMotion);\ncamera.setAnimation("camera_motion_1");\n\nmmdRuntime.playAnimation();\n')),(0,i.kt)("ul",null,(0,i.kt)("li",{parentName:"ul"},"Both ",(0,i.kt)("inlineCode",{parentName:"li"},"MmdCamera")," and ",(0,i.kt)("inlineCode",{parentName:"li"},"MmdModel")," are designed to store multiple animations. Therefore, you must set the animation to use after adding it."),(0,i.kt)("li",{parentName:"ul"},(0,i.kt)("inlineCode",{parentName:"li"},"mmdRuntime.playAnimation()")," - Start playing the animation.")),(0,i.kt)(o.Z,{url:r,controls:!0,width:"100%",height:"100%",mdxType:"ReactPlayer"}))}p.isMDXComponent=!0},8038:(e,t,n)=>{n.d(t,{Z:()=>a});const a=n.p+"assets/images/image-1-f6ae189a5ce688b17f1a3c7179f10403.png"},7784:(e,t,n)=>{n.d(t,{Z:()=>a});const a="data:image/png;base64,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"},2358:(e,t,n)=>{n.d(t,{Z:()=>a});const a=n.p+"assets/images/image-52c15a6e73ff0ffac08c2000d8cebc5a.png"}}]);