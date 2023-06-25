import { Material, type Texture } from "@babylonjs/core";

export enum TransparencyMode {
    Opaque = Material.MATERIAL_OPAQUE,
    AlphaTest = Material.MATERIAL_ALPHATEST,
    AlphaBlend = Material.MATERIAL_ALPHABLEND
}

export class TextureAlphaChecker {
    private readonly _resolution: number;
    private readonly _textureCache: Map<Texture, WebGLTexture>;

    private _context: WebGL2RenderingContext | null;

    private _vertexShader: WebGLShader | null;
    private _fragmentShader: WebGLShader | null;
    private _program: WebGLProgram | null;
    private _uvBuffer: WebGLBuffer | null;
    private _indexBuffer: WebGLBuffer | null;

    private readonly _indicesBytePerElement: number;

    public constructor(uvs: Float32Array, indices: Uint16Array | Uint32Array, resolution = 512) {
        this._resolution = resolution;
        this._textureCache = new Map();

        this._context = this._createRenderingContext();

        this._vertexShader = null;
        this._fragmentShader = null;
        this._program = null;
        this._uvBuffer = null;
        this._indexBuffer = null;

        this._indicesBytePerElement = indices.BYTES_PER_ELEMENT;

        if (this._prepareContext() === false ||
            this._bindUvAndIndexBuffer(uvs, indices) === false
        ) {
            this.dispose();
        }
    }

    private _createRenderingContext(): WebGL2RenderingContext | null {
        const canvas = document.createElement("canvas");
        canvas.width = this._resolution;
        canvas.height = this._resolution;

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

    private _prepareContext(): boolean {
        if (this._context === null) return false;
        const context = this._context;

        context.clearColor(0, 0, 0, 0);

        const vertexShader = this._vertexShader = context.createShader(context.VERTEX_SHADER);
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

        const fragmentShader = this._fragmentShader = context.createShader(context.FRAGMENT_SHADER);
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
                vec2 onePixel = vec2(1.0 / ${this._resolution.toFixed(1)});

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

        const program = this._program = context.createProgram();
        if (program === null) return false;
        context.attachShader(program, vertexShader);
        context.attachShader(program, fragmentShader);
        context.linkProgram(program);
        if (!context.getProgramParameter(program, context.LINK_STATUS)) {
            console.error(context.getProgramInfoLog(program));
            return false;
        }

        context.useProgram(program);

        return true;
    }

    private async _getWebGlTexture(texture: Texture): Promise<WebGLTexture | null> {
        const context = this._context;
        if (context === null) return null;

        const cachedWebGlTexture = this._textureCache.get(texture);
        if (cachedWebGlTexture !== undefined) return cachedWebGlTexture;

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
        if (pixelsBufferView === null) return null;

        const webGlTexture = context.createTexture();
        if (webGlTexture === null) return null;

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

        this._textureCache.set(texture, webGlTexture);

        return webGlTexture;
    }

    private _bindUvAndIndexBuffer(
        uvs: Float32Array,
        indices: Uint16Array | Uint32Array
    ): boolean {
        const context = this._context;
        if (context === null) return false;
        const program = this._program;
        if (program === null) return false;

        const uvBuffer = this._uvBuffer = context.createBuffer();
        if (uvBuffer === null) return false;

        context.bindBuffer(context.ARRAY_BUFFER, uvBuffer);
        context.bufferData(context.ARRAY_BUFFER, uvs, context.STATIC_DRAW);

        const uvLocation = context.getAttribLocation(program, "uv");
        context.enableVertexAttribArray(uvLocation);
        context.vertexAttribPointer(uvLocation, 2, context.FLOAT, false, 0, 0);

        const indexBuffer = this._indexBuffer = context.createBuffer();
        if (indexBuffer === null) return false;

        context.bindBuffer(context.ELEMENT_ARRAY_BUFFER, indexBuffer);
        context.bufferData(context.ELEMENT_ARRAY_BUFFER, indices, context.STATIC_DRAW);

        return true;
    }

    public async textureHasAlphaOnGeometry(
        texture: Texture,
        startOffset: number,
        length: number,
        alphaThreshold: number,
        alphaBlendThreshold: number
    ): Promise<TransparencyMode> {
        const context = this._context;
        if (context === null) return TransparencyMode.Opaque;
        const program = this._program;
        if (program === null) return TransparencyMode.Opaque;

        const webGlTexture = await this._getWebGlTexture(texture);
        if (webGlTexture === null) return TransparencyMode.Opaque;

        context.clear(context.COLOR_BUFFER_BIT);

        const textureLocation = context.getUniformLocation(program, "texture");
        context.activeTexture(context.TEXTURE0);
        context.bindTexture(context.TEXTURE_2D, webGlTexture);
        context.uniform1i(textureLocation, 0);

        context.drawElements(context.TRIANGLES, length, this._indicesBytePerElement === 2 ? context.UNSIGNED_SHORT : context.UNSIGNED_INT, startOffset * this._indicesBytePerElement);

        const resolution = this._resolution;
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
        let averageMidddleAlpha = 0;
        let averageMidddleAlphaCount = 0;

        for (let i = 0; i < resolution; i += 2) {
            for (let j = 0; j < resolution; j += 2) {
                const index = (i * resolution + j) * 4;
                const r = resultPixelsBufferView[index];
                maxValue = Math.max(maxValue, r);
                if (0 < r && r < 255) {
                    averageMidddleAlpha += r;
                    averageMidddleAlphaCount += 1;
                }
            }
        }

        if (averageMidddleAlphaCount !== 0) {
            averageMidddleAlpha /= averageMidddleAlphaCount;
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

        if (maxValue < alphaThreshold) {
            return TransparencyMode.Opaque;
        }

        if (averageMidddleAlpha + alphaBlendThreshold < maxValue) {
            return TransparencyMode.AlphaTest;
        } else {
            return TransparencyMode.AlphaBlend;
        }
    }

    public dispose(): void {
        const context = this._context;
        if (context === null) return;

        context.bindBuffer(context.ARRAY_BUFFER, null);
        context.bindBuffer(context.ELEMENT_ARRAY_BUFFER, null);
        context.bindTexture(context.TEXTURE_2D, null);
        context.useProgram(null);

        context.deleteBuffer(this._uvBuffer);
        context.deleteBuffer(this._indexBuffer);
        for (const webGlTexture of this._textureCache.values()) {
            context.deleteTexture(webGlTexture);
        }
        context.deleteProgram(this._program);
        context.deleteShader(this._vertexShader);
        context.deleteShader(this._fragmentShader);

        this._context = null;
        this._vertexShader = null;
        this._fragmentShader = null;
        this._program = null;
        this._uvBuffer = null;
        this._indexBuffer = null;
    }
}
