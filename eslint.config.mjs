 
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import stylisticJs from "@stylistic/eslint-plugin-js";
import stylisticTs from "@stylistic/eslint-plugin-ts";
import typescriptEslint from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";
import simpleImportSort from "eslint-plugin-simple-import-sort";
import globals from "globals";

const abbreviations = [
    "[XYZ][A-Z][a-z]",
    "HTML",
    "UI",
    "LOD",
    "XR",
    "PBR",
    "IBL",
    "HDR",
    "FFT",
    "CB",
    "RTW",
    "SSR",
    "RHS",
    "LHS",
    "LTC",
    "CDN",
    "ARIA",
    "IES",
    "RLE",
    "SSAO",
    "NME",
    "NGE",
    "SMAA",
    "RT",
    "TAA",
    "PT",
    "PP",
    "GI",
    "GBuffer",
    "[Bb]lur[XY]",
    "upsampling[XY]",
    "RSM",
    "DoF",
    "MSAA",
    "FXAA",
    "TBN",
    "GPU",
    "CPU",
    "FPS",
    "CSS",
    "MP3",
    "OGG",
    "HRTF",
    "JSON",
    "ZOffset",
    "IK",
    "UV",
    "[XYZ]Axis",
    "VR",
    "axis[XYZ]",
    "UBO",
    "URL",
    "RGB",
    "RGBD",
    "GL",
    "[23]D",
    "MRT",
    "RTT",
    "WGSL",
    "GLSL",
    "OS",
    "NDCH",
    "CSM",
    "POT",
    "DOM",
    "WASM",
    "BRDF",
    "wheel[XYZ]",
    "PLY",
    "STL",
    "[AB]Texture",
    "CSG",
    "DoN",
    "RAW",
    "ZIP",
    "PIZ",
    "VAO",
    "JS",
    "DB",
    "XHR",
    "POV",
    "BABYLON",
    "HSV",
    "[VUW](Offset|Rotation|Scale|Ang)",
    "DDS",
    "NaN",
    "SVG",
    "MRDL",
    "MTL",
    "OBJ",
    "SPLAT",
    "PLY",
    "glTF",
    "GLTF",
    "MSFT",
    "MSC",
    "QR",
    "BGR",
    "SFE",
    "BVH",

    "SDEF",
    "MD",
    "MR",
    "SD",
    "SR",
    "MPD",
    "MPR",
    "SPD",
    "SPR",
    "CKind",
    "RW[0-1]Kind",
    "VTable",
    "ERP",
    "CFM"
];
// Join them into a single regex string
const allowedNonStrictAbbreviations = abbreviations.join("|");

export default tseslint.config(
    {
        ignores: [
            "**/dist/*",
            "**/test_dist/*",
            "**/docs/*",
            "**/src/Runtime/Optimized/wasm/*",
            "**/src/Runtime/Optimized/wasm_src/*",
            "**/src/Runtime/Physics/External/*"
        ]
    },
    {
        extends: [
            js.configs.recommended,
            ...tseslint.configs.recommended,
        ],
        files: [
            "**/*.ts",
            "**/*.tsx"
        ],
        plugins: {
            "@typescript-eslint": typescriptEslint,
            "simple-import-sort": simpleImportSort,
            "@stylistic/js": stylisticJs,
            "@stylistic/ts": stylisticTs
        },

        languageOptions: {
            globals: {
                ...globals.browser
            },

            parser: tsParser,
            ecmaVersion: "latest",
            sourceType: "module",

            parserOptions: {
                project: "./tsconfig.json"
            }
        },

        rules: {
            "@typescript-eslint/consistent-type-imports": ["error", {
                prefer: "type-imports"
            }],

            "@typescript-eslint/no-non-null-assertion": "off",
            "@typescript-eslint/no-explicit-any": "off",
            "@typescript-eslint/no-empty-object-type": "off",
            "@typescript-eslint/no-unused-vars": "off",
            "@typescript-eslint/no-unused-expressions": "off",
            "@typescript-eslint/no-namespace": "off",

            "@typescript-eslint/explicit-member-accessibility": ["error", {
                accessibility: "explicit",

                overrides: {
                    accessors: "explicit",
                    constructors: "explicit",
                    methods: "explicit",
                    properties: "explicit",
                    parameterProperties: "explicit"
                }
            }],

            "@typescript-eslint/prefer-readonly": ["error"],
            "@typescript-eslint/explicit-function-return-type": ["error"],
            "@typescript-eslint/array-type": ["error"],
            "@typescript-eslint/prefer-includes": ["error"],
            "@stylistic/js/brace-style": ["error", "1tbs"],
            "@stylistic/ts/space-before-blocks": ["error"],

            "@stylistic/ts/type-annotation-spacing": ["error", {
                before: false,
                after: true,

                overrides: {
                    arrow: {
                        before: true,
                        after: true
                    }
                }
            }],

            "@typescript-eslint/naming-convention": [
                "error",
                {
                    selector: "default",
                    format: ["strictCamelCase"]
                },
                {
                    selector: "import",
                    format: ["strictCamelCase", "StrictPascalCase"]
                },
                {
                    selector: "variable",
                    format: ["StrictPascalCase", "UPPER_CASE"],
                    modifiers: ["global"],
                    leadingUnderscore: "allow"
                },
                {
                    selector: "variable",
                    format: ["camelCase"],
                    leadingUnderscore: "allow"
                },
                {
                    selector: "parameter",
                    format: ["camelCase"],
                    leadingUnderscore: "allow"
                },
                {
                    selector: "objectLiteralProperty",
                    format: ["strictCamelCase", "snake_case", "UPPER_CASE"],
                    leadingUnderscore: "allow"
                },
                {
                    selector: "enumMember",
                    format: ["StrictPascalCase", "UPPER_CASE"]
                },
                // public static members of classes, including constants
                {
                    selector: "memberLike",
                    modifiers: ["public", "static"],
                    format: ["StrictPascalCase", "UPPER_CASE"],
                    leadingUnderscore: "allow"
                },
                // private static members of classes
                {
                    selector: "memberLike",
                    modifiers: ["private", "static"],
                    format: ["StrictPascalCase", "UPPER_CASE"],
                    leadingUnderscore: "require"
                },
                // protected static members of classes
                {
                    selector: "memberLike",
                    modifiers: ["protected", "static"],
                    format: ["StrictPascalCase", "UPPER_CASE"],
                    leadingUnderscore: "require"
                },
                // public instance members of classes, including constants
                {
                    selector: "memberLike",
                    modifiers: ["public"],
                    format: ["strictCamelCase", "UPPER_CASE"],
                    leadingUnderscore: "allow"
                },
                // private instance members of classes
                {
                    selector: "memberLike",
                    modifiers: ["private"],
                    format: ["strictCamelCase"],
                    leadingUnderscore: "require"
                },
                // protected instance members of classes
                {
                    selector: "memberLike",
                    modifiers: ["protected"],
                    format: ["strictCamelCase"],
                    leadingUnderscore: "require"
                },
                // async suffix
                {
                    selector: "memberLike",
                    modifiers: ["async"],
                    suffix: ["Async"],
                    format: ["strictCamelCase", "StrictPascalCase"],
                    leadingUnderscore: "allow"
                },
                {
                    selector: "typeLike", // class, interface, enum, type alias
                    format: ["StrictPascalCase"]
                },
                // exported variables and functions, module-level
                {
                    selector: "variable",
                    modifiers: ["const", "global", "exported"],
                    format: ["StrictPascalCase"],
                    leadingUnderscore: "allow"
                },
                {
                    selector: "function",
                    modifiers: [/*"exported", */ "global"],
                    format: ["StrictPascalCase"],
                    leadingUnderscore: "allow"
                },
                {
                    selector: "interface",
                    format: ["StrictPascalCase"],
                    leadingUnderscore: "allow",
                    prefix: ["I"]
                },
                {
                    selector: "class",
                    format: ["StrictPascalCase"],
                    leadingUnderscore: "allow"
                },
                // Remove the strict requirement for abbreviations like HTML, GUI, BRDF, etc.
                {
                    selector: "default",
                    format: ["camelCase"],
                    filter: {
                        // you can expand this regex to add more allowed names
                        regex: allowedNonStrictAbbreviations,
                        match: true
                    }
                },
                {
                    selector: ["memberLike", "property", "parameter"],
                    format: ["camelCase", "UPPER_CASE"],
                    filter: {
                        // you can expand this regex to add more allowed names
                        regex: allowedNonStrictAbbreviations,
                        match: true
                    },
                    leadingUnderscore: "allow"
                },
                {
                    selector: ["memberLike", "variable", "property", "class"],
                    format: ["PascalCase", "UPPER_CASE"],
                    modifiers: ["static"],
                    filter: {
                        // you can expand this regex to add more allowed names
                        regex: allowedNonStrictAbbreviations,
                        match: true
                    },
                    leadingUnderscore: "allow"
                },
                {
                    selector: "class",
                    format: ["PascalCase"],
                    filter: {
                        // you can expand this regex to add more allowed names
                        regex: allowedNonStrictAbbreviations,
                        match: true
                    },
                    leadingUnderscore: "allow"
                },
                {
                    selector: "interface",
                    format: ["PascalCase"],
                    prefix: ["I"],
                    filter: {
                        // you can expand this regex to add more allowed names
                        regex: allowedNonStrictAbbreviations,
                        match: true
                    },
                    leadingUnderscore: "allow"
                },
                {
                    selector: "import",
                    format: ["camelCase", "PascalCase"],
                    filter: {
                        // you can expand this regex to add more allowed names
                        regex: allowedNonStrictAbbreviations,
                        match: true
                    }
                },
                {
                    selector: "objectLiteralProperty",
                    format: ["camelCase", "snake_case", "UPPER_CASE"],
                    leadingUnderscore: "allow",
                    filter: {
                        // you can expand this regex to add more allowed names
                        regex: allowedNonStrictAbbreviations,
                        match: true
                    }
                },
                {
                    selector: "variable",
                    format: ["PascalCase"],
                    modifiers: ["global"],
                    leadingUnderscore: "allow",
                    filter: {
                        // you can expand this regex to add more allowed names
                        regex: allowedNonStrictAbbreviations,
                        match: true
                    }
                },
                {
                    selector: "function",
                    modifiers: [/*"exported", */ "global"],
                    format: ["PascalCase"],
                    leadingUnderscore: "allow",
                    filter: {
                        // you can expand this regex to add more allowed names
                        regex: allowedNonStrictAbbreviations,
                        match: true
                    }
                },
                {
                    selector: "enumMember",
                    format: ["PascalCase", "UPPER_CASE"],
                    filter: {
                        // you can expand this regex to add more allowed names
                        regex: allowedNonStrictAbbreviations,
                        match: true
                    }
                },
                {
                    selector: "typeLike", // class, interface, enum, type alias
                    format: ["PascalCase"],
                    filter: {
                        // you can expand this regex to add more allowed names
                        regex: allowedNonStrictAbbreviations,
                        match: true
                    }
                },
                {
                    selector: "typeParameter",
                    format: ["PascalCase"]
                }
            ],

            "comma-dangle": ["error", "never"],
            "comma-spacing": ["error"],
            "eol-last": ["error", "always"],
            "indent": ["error", 4],
            "linebreak-style": ["error", "unix"],
            "keyword-spacing": ["error"],
            "no-debugger": "warn",
            "no-inner-declarations": "off",

            "no-plusplus": ["error", {
                allowForLoopAfterthoughts: true
            }],

            "no-trailing-spaces": ["error"],
            "quotes": ["error", "double"],
            "semi": ["error", "always"],
            "semi-spacing": ["error"],
            "simple-import-sort/imports": "error",
            "simple-import-sort/exports": "error",
            "space-before-blocks": ["error"],
            "space-before-function-paren": ["error", "never"],
            "space-in-parens": ["error"],
            "space-infix-ops": ["error"],
            "space-unary-ops": ["error"]
        }
    }
);
