export const standardBoneObject = [
    {
        "name": "全ての親",
        "parentBoneIndex": -1,
        "transformOrder": 0,
        "flag": 31,
        "transformAfterPhysics": false
    },
    {
        "name": "センター",
        "parentBoneIndex": 0,
        "transformOrder": 0,
        "flag": 30,
        "transformAfterPhysics": false
    },
    {
        "name": "グルーブ",
        "parentBoneIndex": 1,
        "transformOrder": 0,
        "flag": 30,
        "transformAfterPhysics": false
    },
    {
        "name": "腰",
        "parentBoneIndex": 2,
        "transformOrder": 0,
        "flag": 26,
        "transformAfterPhysics": false
    },
    {
        "name": "右足IK親",
        "parentBoneIndex": 0,
        "transformOrder": 0,
        "flag": 31,
        "transformAfterPhysics": false
    },
    {
        "name": "右足ＩＫ",
        "parentBoneIndex": 4,
        "transformOrder": 1,
        "flag": 62,
        "transformAfterPhysics": false,
        "ik": {
            "target": 67,
            "iteration": 40,
            "rotationConstraint": 2,
            "links": [
                {
                    "target": 66,
                    "limitation": {
                        "minimumAngle": [
                            -3.1415927410125732,
                            0,
                            0
                        ],
                        "maximumAngle": [
                            -0.008726646192371845,
                            0,
                            0
                        ]
                    }
                },
                {
                    "target": 65
                }
            ]
        }
    },
    {
        "name": "右つま先ＩＫ",
        "parentBoneIndex": 5,
        "transformOrder": 2,
        "flag": 62,
        "transformAfterPhysics": false,
        "ik": {
            "target": 72,
            "iteration": 3,
            "rotationConstraint": 4,
            "links": [
                {
                    "target": 67
                }
            ]
        }
    },
    {
        "name": "左足IK親",
        "parentBoneIndex": 0,
        "transformOrder": 0,
        "flag": 31,
        "transformAfterPhysics": false
    },
    {
        "name": "左足ＩＫ",
        "parentBoneIndex": 7,
        "transformOrder": 1,
        "flag": 62,
        "transformAfterPhysics": false,
        "ik": {
            "target": 71,
            "iteration": 40,
            "rotationConstraint": 2,
            "links": [
                {
                    "target": 70,
                    "limitation": {
                        "minimumAngle": [
                            -3.1415927410125732,
                            0,
                            0
                        ],
                        "maximumAngle": [
                            -0.008726646192371845,
                            0,
                            0
                        ]
                    }
                },
                {
                    "target": 69
                }
            ]
        }
    },
    {
        "name": "左つま先ＩＫ",
        "parentBoneIndex": 8,
        "transformOrder": 2,
        "flag": 62,
        "transformAfterPhysics": false,
        "ik": {
            "target": 73,
            "iteration": 3,
            "rotationConstraint": 4,
            "links": [
                {
                    "target": 71
                }
            ]
        }
    },
    {
        "name": "上半身",
        "parentBoneIndex": 3,
        "transformOrder": 0,
        "flag": 27,
        "transformAfterPhysics": false
    },
    {
        "name": "上半身2",
        "parentBoneIndex": 10,
        "transformOrder": 0,
        "flag": 27,
        "transformAfterPhysics": false
    },
    {
        "name": "下半身",
        "parentBoneIndex": 3,
        "transformOrder": 0,
        "flag": 26,
        "transformAfterPhysics": false
    },
    {
        "name": "首",
        "parentBoneIndex": 11,
        "transformOrder": 0,
        "flag": 27,
        "transformAfterPhysics": false
    },
    {
        "name": "頭",
        "parentBoneIndex": 13,
        "transformOrder": 0,
        "flag": 26,
        "transformAfterPhysics": false
    },
    {
        "name": "右肩P",
        "parentBoneIndex": 11,
        "transformOrder": 0,
        "flag": 26,
        "transformAfterPhysics": false
    },
    {
        "name": "右肩",
        "parentBoneIndex": 15,
        "transformOrder": 0,
        "flag": 2075,
        "transformAfterPhysics": false
    },
    {
        "name": "右肩C",
        "parentBoneIndex": 16,
        "transformOrder": 0,
        "flag": 274,
        "appendTransform": {
            "isLocal": false,
            "affectRotation": true,
            "affectPosition": false,
            "parentIndex": 15,
            "ratio": -1
        },
        "transformAfterPhysics": false
    },
    {
        "name": "右腕",
        "parentBoneIndex": 17,
        "transformOrder": 0,
        "flag": 2075,
        "transformAfterPhysics": false
    },
    {
        "name": "右腕捩",
        "parentBoneIndex": 18,
        "transformOrder": 0,
        "flag": 1050,
        "transformAfterPhysics": false
    },
    {
        "name": "右ひじ",
        "parentBoneIndex": 19,
        "transformOrder": 0,
        "flag": 2075,
        "transformAfterPhysics": false
    },
    {
        "name": "右手捩",
        "parentBoneIndex": 20,
        "transformOrder": 0,
        "flag": 1050,
        "transformAfterPhysics": false
    },
    {
        "name": "右手首",
        "parentBoneIndex": 21,
        "transformOrder": 0,
        "flag": 2075,
        "transformAfterPhysics": false
    },
    {
        "name": "右親指０",
        "parentBoneIndex": 22,
        "transformOrder": 0,
        "flag": 2079,
        "transformAfterPhysics": false
    },
    {
        "name": "右親指１",
        "parentBoneIndex": 23,
        "transformOrder": 0,
        "flag": 2075,
        "transformAfterPhysics": false
    },
    {
        "name": "右親指２",
        "parentBoneIndex": 24,
        "transformOrder": 0,
        "flag": 2075,
        "transformAfterPhysics": false
    },
    {
        "name": "右小指１",
        "parentBoneIndex": 22,
        "transformOrder": 0,
        "flag": 2075,
        "transformAfterPhysics": false
    },
    {
        "name": "右小指２",
        "parentBoneIndex": 26,
        "transformOrder": 0,
        "flag": 2075,
        "transformAfterPhysics": false
    },
    {
        "name": "右小指３",
        "parentBoneIndex": 27,
        "transformOrder": 0,
        "flag": 2075,
        "transformAfterPhysics": false
    },
    {
        "name": "右薬指１",
        "parentBoneIndex": 22,
        "transformOrder": 0,
        "flag": 2075,
        "transformAfterPhysics": false
    },
    {
        "name": "右薬指２",
        "parentBoneIndex": 29,
        "transformOrder": 0,
        "flag": 2075,
        "transformAfterPhysics": false
    },
    {
        "name": "右薬指３",
        "parentBoneIndex": 30,
        "transformOrder": 0,
        "flag": 2075,
        "transformAfterPhysics": false
    },
    {
        "name": "右中指１",
        "parentBoneIndex": 22,
        "transformOrder": 0,
        "flag": 2075,
        "transformAfterPhysics": false
    },
    {
        "name": "右中指２",
        "parentBoneIndex": 32,
        "transformOrder": 0,
        "flag": 2075,
        "transformAfterPhysics": false
    },
    {
        "name": "右中指３",
        "parentBoneIndex": 33,
        "transformOrder": 0,
        "flag": 2075,
        "transformAfterPhysics": false
    },
    {
        "name": "右人指１",
        "parentBoneIndex": 22,
        "transformOrder": 0,
        "flag": 2075,
        "transformAfterPhysics": false
    },
    {
        "name": "右人指２",
        "parentBoneIndex": 35,
        "transformOrder": 0,
        "flag": 2075,
        "transformAfterPhysics": false
    },
    {
        "name": "右人指３",
        "parentBoneIndex": 36,
        "transformOrder": 0,
        "flag": 2075,
        "transformAfterPhysics": false
    },
    {
        "name": "左肩P",
        "parentBoneIndex": 11,
        "transformOrder": 0,
        "flag": 26,
        "transformAfterPhysics": false
    },
    {
        "name": "左肩",
        "parentBoneIndex": 38,
        "transformOrder": 0,
        "flag": 2075,
        "transformAfterPhysics": false
    },
    {
        "name": "左肩C",
        "parentBoneIndex": 39,
        "transformOrder": 0,
        "flag": 274,
        "appendTransform": {
            "isLocal": false,
            "affectRotation": true,
            "affectPosition": false,
            "parentIndex": 38,
            "ratio": -1
        },
        "transformAfterPhysics": false
    },
    {
        "name": "左腕",
        "parentBoneIndex": 40,
        "transformOrder": 0,
        "flag": 2075,
        "transformAfterPhysics": false
    },
    {
        "name": "左腕捩",
        "parentBoneIndex": 41,
        "transformOrder": 0,
        "flag": 1050,
        "transformAfterPhysics": false
    },
    {
        "name": "左ひじ",
        "parentBoneIndex": 42,
        "transformOrder": 0,
        "flag": 2075,
        "transformAfterPhysics": false
    },
    {
        "name": "左手捩",
        "parentBoneIndex": 43,
        "transformOrder": 0,
        "flag": 1050,
        "transformAfterPhysics": false
    },
    {
        "name": "左手首",
        "parentBoneIndex": 44,
        "transformOrder": 0,
        "flag": 2075,
        "transformAfterPhysics": false
    },
    {
        "name": "左親指０",
        "parentBoneIndex": 45,
        "transformOrder": 0,
        "flag": 2079,
        "transformAfterPhysics": false
    },
    {
        "name": "左親指１",
        "parentBoneIndex": 46,
        "transformOrder": 0,
        "flag": 2075,
        "transformAfterPhysics": false
    },
    {
        "name": "左親指２",
        "parentBoneIndex": 47,
        "transformOrder": 0,
        "flag": 2075,
        "transformAfterPhysics": false
    },
    {
        "name": "左小指１",
        "parentBoneIndex": 45,
        "transformOrder": 0,
        "flag": 2075,
        "transformAfterPhysics": false
    },
    {
        "name": "左小指２",
        "parentBoneIndex": 49,
        "transformOrder": 0,
        "flag": 2075,
        "transformAfterPhysics": false
    },
    {
        "name": "左小指３",
        "parentBoneIndex": 50,
        "transformOrder": 0,
        "flag": 2075,
        "transformAfterPhysics": false
    },
    {
        "name": "左薬指１",
        "parentBoneIndex": 45,
        "transformOrder": 0,
        "flag": 2075,
        "transformAfterPhysics": false
    },
    {
        "name": "左薬指２",
        "parentBoneIndex": 52,
        "transformOrder": 0,
        "flag": 2075,
        "transformAfterPhysics": false
    },
    {
        "name": "左薬指３",
        "parentBoneIndex": 53,
        "transformOrder": 0,
        "flag": 2075,
        "transformAfterPhysics": false
    },
    {
        "name": "左中指１",
        "parentBoneIndex": 45,
        "transformOrder": 0,
        "flag": 2075,
        "transformAfterPhysics": false
    },
    {
        "name": "左中指２",
        "parentBoneIndex": 55,
        "transformOrder": 0,
        "flag": 2075,
        "transformAfterPhysics": false
    },
    {
        "name": "左中指３",
        "parentBoneIndex": 56,
        "transformOrder": 0,
        "flag": 2075,
        "transformAfterPhysics": false
    },
    {
        "name": "左人指１",
        "parentBoneIndex": 45,
        "transformOrder": 0,
        "flag": 2075,
        "transformAfterPhysics": false
    },
    {
        "name": "左人指２",
        "parentBoneIndex": 58,
        "transformOrder": 0,
        "flag": 2075,
        "transformAfterPhysics": false
    },
    {
        "name": "左人指３",
        "parentBoneIndex": 59,
        "transformOrder": 0,
        "flag": 2075,
        "transformAfterPhysics": false
    },
    {
        "name": "右目",
        "parentBoneIndex": 14,
        "transformOrder": 2,
        "flag": 2330,
        "appendTransform": {
            "isLocal": false,
            "affectRotation": true,
            "affectPosition": false,
            "parentIndex": 63,
            "ratio": 1
        },
        "transformAfterPhysics": false
    },
    {
        "name": "左目",
        "parentBoneIndex": 14,
        "transformOrder": 2,
        "flag": 2330,
        "appendTransform": {
            "isLocal": false,
            "affectRotation": true,
            "affectPosition": false,
            "parentIndex": 63,
            "ratio": 1
        },
        "transformAfterPhysics": false
    },
    {
        "name": "両目",
        "parentBoneIndex": 14,
        "transformOrder": 0,
        "flag": 2074,
        "transformAfterPhysics": false
    },
    {
        "name": "腰キャンセル右",
        "parentBoneIndex": 12,
        "transformOrder": 0,
        "flag": 274,
        "appendTransform": {
            "isLocal": false,
            "affectRotation": true,
            "affectPosition": false,
            "parentIndex": 3,
            "ratio": -1
        },
        "transformAfterPhysics": false
    },
    {
        "name": "右足",
        "parentBoneIndex": 64,
        "transformOrder": 0,
        "flag": 27,
        "transformAfterPhysics": false
    },
    {
        "name": "右ひざ",
        "parentBoneIndex": 65,
        "transformOrder": 0,
        "flag": 27,
        "transformAfterPhysics": false
    },
    {
        "name": "右足首",
        "parentBoneIndex": 66,
        "transformOrder": 0,
        "flag": 27,
        "transformAfterPhysics": false
    },
    {
        "name": "腰キャンセル左",
        "parentBoneIndex": 12,
        "transformOrder": 0,
        "flag": 274,
        "appendTransform": {
            "isLocal": false,
            "affectRotation": true,
            "affectPosition": false,
            "parentIndex": 3,
            "ratio": -1
        },
        "transformAfterPhysics": false
    },
    {
        "name": "左足",
        "parentBoneIndex": 68,
        "transformOrder": 0,
        "flag": 27,
        "transformAfterPhysics": false
    },
    {
        "name": "左ひざ",
        "parentBoneIndex": 69,
        "transformOrder": 0,
        "flag": 27,
        "transformAfterPhysics": false
    },
    {
        "name": "左足首",
        "parentBoneIndex": 70,
        "transformOrder": 0,
        "flag": 27,
        "transformAfterPhysics": false
    },
    {
        "name": "右つま先",
        "parentBoneIndex": 67,
        "transformOrder": 2,
        "flag": 18,
        "transformAfterPhysics": false
    },
    {
        "name": "左つま先",
        "parentBoneIndex": 71,
        "transformOrder": 2,
        "flag": 18,
        "transformAfterPhysics": false
    },
    {
        "name": "右足D",
        "parentBoneIndex": 64,
        "transformOrder": 1,
        "flag": 283,
        "appendTransform": {
            "isLocal": false,
            "affectRotation": true,
            "affectPosition": false,
            "parentIndex": 65,
            "ratio": 1
        },
        "transformAfterPhysics": false
    },
    {
        "name": "右ひざD",
        "parentBoneIndex": 74,
        "transformOrder": 1,
        "flag": 283,
        "appendTransform": {
            "isLocal": false,
            "affectRotation": true,
            "affectPosition": false,
            "parentIndex": 66,
            "ratio": 1
        },
        "transformAfterPhysics": false
    },
    {
        "name": "右足首D",
        "parentBoneIndex": 75,
        "transformOrder": 2,
        "flag": 282,
        "appendTransform": {
            "isLocal": false,
            "affectRotation": true,
            "affectPosition": false,
            "parentIndex": 67,
            "ratio": 1
        },
        "transformAfterPhysics": false
    },
    {
        "name": "左足D",
        "parentBoneIndex": 68,
        "transformOrder": 1,
        "flag": 283,
        "appendTransform": {
            "isLocal": false,
            "affectRotation": true,
            "affectPosition": false,
            "parentIndex": 69,
            "ratio": 1
        },
        "transformAfterPhysics": false
    },
    {
        "name": "左ひざD",
        "parentBoneIndex": 77,
        "transformOrder": 1,
        "flag": 283,
        "appendTransform": {
            "isLocal": false,
            "affectRotation": true,
            "affectPosition": false,
            "parentIndex": 70,
            "ratio": 1
        },
        "transformAfterPhysics": false
    },
    {
        "name": "左足首D",
        "parentBoneIndex": 78,
        "transformOrder": 2,
        "flag": 282,
        "appendTransform": {
            "isLocal": false,
            "affectRotation": true,
            "affectPosition": false,
            "parentIndex": 71,
            "ratio": 1
        },
        "transformAfterPhysics": false
    },
    {
        "name": "右足先EX",
        "parentBoneIndex": 76,
        "transformOrder": 2,
        "flag": 26,
        "transformAfterPhysics": false
    },
    {
        "name": "左足先EX",
        "parentBoneIndex": 79,
        "transformOrder": 2,
        "flag": 26,
        "transformAfterPhysics": false
    }
];

// console.log(standardBoneObject.map(b => [b.name, null, b.parentBoneIndex, b.transformOrder, b.flag, b.appendTransform, b.ik]));
