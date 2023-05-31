import type { Texture } from "@babylonjs/core";

export class TextureAlphaChecker {
    private static readonly _resolution = 512;

    public static async textureHasAlphaOnGeometry(
        context: WebGL2RenderingContext | null,
        texture: Texture,
        indices: Uint16Array | Uint32Array,
        uvs: Float32Array,
        startOffset: number,
        length: number,
        alphaThreshold = 200
    ): Promise<boolean> {
        if (context === null) return false;

        if (!texture.isReady()) {
            await new Promise<void>((resolve) => {
                texture.onLoadObservable.addOnce(() => {
                    resolve();
                });
            });
        }

        const textureSize = texture.getSize();
        const pixelsBufferView = await texture.readPixels(
            0, // faceIndex
            0, // level
            undefined, // buffer
            false, // flushRenderer
            false, // noDataConversion
            0, // x
            0, // y
            textureSize.width, // width
            textureSize.height // height
        );
        if (pixelsBufferView === null) return false;

        context.clearColor(0, 0, 0, 0);
        context.clear(context.COLOR_BUFFER_BIT);

        const vertexShader = context.createShader(context.VERTEX_SHADER);
        if (vertexShader === null) return false;
        const vertexShaderSource = /* glsl */`
            precision highp float;
            attribute vec2 uv;
            varying vec2 vUv;

            void main() {
                vUv = uv;
                gl_Position = vec4(uv * 2.0 - 1.0, 0.0, 1.0);
            }
        `;
        context.shaderSource(vertexShader, vertexShaderSource);
        context.compileShader(vertexShader);
        if (!context.getShaderParameter(vertexShader, context.COMPILE_STATUS)) {
            console.error(context.getShaderInfoLog(vertexShader));
            return false;
        }

        const fragmentShader = context.createShader(context.FRAGMENT_SHADER);
        if (fragmentShader === null) return false;
        /**
         * centerAlpha | right1Alpha | right2Alpha
         * bottom1Alpha | right1Bottom1Alpha | right2Bottom1Alpha
         * bottom2Alpha | right1Bottom2Alpha | right2Bottom2Alpha
         */
        const fragmentShaderSource = /* glsl */`
            precision highp float;
            uniform sampler2D texture;
            varying vec2 vUv;

            void main() {
                vec2 onePixel = vec2(1.0 / ${TextureAlphaChecker._resolution.toFixed(1)});

                float minAlpha = 1.0;
                for (int i = 0; i < 2; ++i) {
                    for (int j = 0; j < 2; ++j) {
                        float alpha = texture2D(texture, vUv + vec2(onePixel.x * float(i), onePixel.y * float(j))).a;
                        minAlpha = min(minAlpha, alpha);
                    }
                }
                gl_FragColor = vec4(vec3(1.0) - minAlpha, 1.0);
            }
        `;
        context.shaderSource(fragmentShader, fragmentShaderSource);
        context.compileShader(fragmentShader);
        if (!context.getShaderParameter(fragmentShader, context.COMPILE_STATUS)) {
            console.error(context.getShaderInfoLog(fragmentShader));
            return false;
        }

        const program = context.createProgram();
        if (program === null) return false;
        context.attachShader(program, vertexShader);
        context.attachShader(program, fragmentShader);
        context.linkProgram(program);
        if (!context.getProgramParameter(program, context.LINK_STATUS)) {
            console.error(context.getProgramInfoLog(program));
            return false;
        }

        context.useProgram(program);

        const webGlTexture = context.createTexture();
        if (webGlTexture === null) return false;

        context.bindTexture(context.TEXTURE_2D, webGlTexture);
        context.texParameteri(context.TEXTURE_2D, context.TEXTURE_MAG_FILTER, context.NEAREST);
        context.texParameteri(context.TEXTURE_2D, context.TEXTURE_MIN_FILTER, context.NEAREST);
        context.texParameteri(context.TEXTURE_2D, context.TEXTURE_WRAP_S, context.CLAMP_TO_EDGE);
        context.texParameteri(context.TEXTURE_2D, context.TEXTURE_WRAP_T, context.CLAMP_TO_EDGE);
        context.texImage2D(
            context.TEXTURE_2D,
            0, // level
            context.RGBA, // internalFormat
            textureSize.width, // width
            textureSize.height, // height
            0, // border
            context.RGBA, // format
            context.UNSIGNED_BYTE, // type
            pixelsBufferView // pixels
        );

        const uvBuffer = context.createBuffer();
        if (uvBuffer === null) return false;

        context.bindBuffer(context.ARRAY_BUFFER, uvBuffer);
        context.bufferData(context.ARRAY_BUFFER, uvs, context.STATIC_DRAW);

        const uvLocation = context.getAttribLocation(program, "uv");
        context.enableVertexAttribArray(uvLocation);
        context.vertexAttribPointer(uvLocation, 2, context.FLOAT, false, 0, 0);

        const textureLocation = context.getUniformLocation(program, "texture");
        context.activeTexture(context.TEXTURE0);
        context.bindTexture(context.TEXTURE_2D, webGlTexture);
        context.uniform1i(textureLocation, 0);

        const indexBuffer = context.createBuffer();
        if (indexBuffer === null) return false;

        context.bindBuffer(context.ELEMENT_ARRAY_BUFFER, indexBuffer);
        context.bufferData(context.ELEMENT_ARRAY_BUFFER, indices, context.STATIC_DRAW);

        context.drawElements(context.TRIANGLES, length, indices.BYTES_PER_ELEMENT === 2 ? context.UNSIGNED_SHORT : context.UNSIGNED_INT, startOffset * indices.BYTES_PER_ELEMENT);

        // dispose
        context.deleteBuffer(uvBuffer);
        context.deleteBuffer(indexBuffer);
        context.deleteTexture(webGlTexture);
        context.deleteProgram(program);
        context.deleteShader(vertexShader);
        context.deleteShader(fragmentShader);

        const resolution = TextureAlphaChecker._resolution;
        const resultPixelsBufferView = new Uint8Array(resolution * resolution * 4);
        context.readPixels(
            0, // x
            0, // y
            resolution, // width
            resolution, // height
            context.RGBA, // format
            context.UNSIGNED_BYTE, // type
            resultPixelsBufferView // pixels
        );

        let maxValue = 0;
        for (let i = 0; i < resolution; i += 2) {
            for (let j = 0; j < resolution; j += 2) {
                const index = (i * resolution + j) * 4;
                const r = resultPixelsBufferView[index];
                maxValue = Math.max(maxValue, r);
            }
        }

        // const div = document.createElement("div");
        // div.innerText = texture.name + " " + maxValue;
        // const debugCanvas = document.createElement("canvas");
        // debugCanvas.width = resolution / 2;
        // debugCanvas.height = resolution / 2;
        // debugCanvas.style.outline = "1px solid red";

        // div.appendChild(debugCanvas);
        // document.body.appendChild(div);

        // const debugContext = debugCanvas.getContext("2d");
        // for (let i = 0; i < resolution; i += 2) {
        //     for (let j = 0; j < resolution; j += 2) {
        //         const index = (i * resolution + j) * 4;
        //         const r = resultPixelsBufferView[index + 0];
        //         debugContext!.fillStyle = `rgba(${r}, ${r}, ${r}, 1.0)`;
        //         debugContext!.fillRect(i / 2, j / 2, 1, 1);
        //     }
        // }

        return alphaThreshold < maxValue;
    }

    public static createRenderingContext(): WebGL2RenderingContext | null {
        const canvas = document.createElement("canvas");
        canvas.width = TextureAlphaChecker._resolution;
        canvas.height = TextureAlphaChecker._resolution;

        // document.body.appendChild(canvas);

        const context = canvas.getContext("webgl2", {
            alpha: false,
            antialias: false,
            depth: false,
            premultipliedAlpha: false,
            preserveDrawingBuffer: false
        });

        return context;
    }
}
