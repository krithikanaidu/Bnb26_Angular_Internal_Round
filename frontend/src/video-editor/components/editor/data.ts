// Fully offline starter artwork (inline SVG data URIs). The old template
// pointed at a dead CDN, so first paint was a black canvas. These can never
// 404 and decode in every browser (no filters, gradients + shapes only).
const STARTER_BACKDROP =
  "data:image/svg+xml;utf8," +
  "<svg xmlns='http://www.w3.org/2000/svg' width='1080' height='1920'>" +
  "<defs>" +
  "<linearGradient id='g' x1='0' y1='0' x2='0' y2='1'>" +
  "<stop offset='0' stop-color='%2323222e'/><stop offset='1' stop-color='%230e0f14'/>" +
  "</linearGradient>" +
  "<radialGradient id='a' cx='0.5' cy='0.22' r='0.55'>" +
  "<stop offset='0' stop-color='%237c5cff' stop-opacity='0.28'/>" +
  "<stop offset='1' stop-color='%237c5cff' stop-opacity='0'/>" +
  "</radialGradient>" +
  "<radialGradient id='b' cx='0.5' cy='0.85' r='0.6'>" +
  "<stop offset='0' stop-color='%2300e0b8' stop-opacity='0.16'/>" +
  "<stop offset='1' stop-color='%2300e0b8' stop-opacity='0'/>" +
  "</radialGradient>" +
  "</defs>" +
  "<rect width='1080' height='1920' fill='url(%23g)'/>" +
  "<rect width='1080' height='1920' fill='url(%23a)'/>" +
  "<rect width='1080' height='1920' fill='url(%23b)'/>" +
  "</svg>";

const STARTER_CARD =
  "data:image/svg+xml;utf8," +
  "<svg xmlns='http://www.w3.org/2000/svg' width='800' height='1000'>" +
  "<defs>" +
  "<linearGradient id='c' x1='0' y1='0' x2='1' y2='1'>" +
  "<stop offset='0' stop-color='%233a3f52'/><stop offset='1' stop-color='%231c1e28'/>" +
  "</linearGradient>" +
  "</defs>" +
  "<rect x='8' y='8' width='784' height='984' rx='48' fill='url(%23c)' " +
  "stroke='%23ffffff' stroke-opacity='0.14' stroke-width='2'/>" +
  "<circle cx='400' cy='440' r='150' fill='%23ffffff' fill-opacity='0.08'/>" +
  "<path d='M370 370 L470 440 L370 510 Z' fill='%23ffffff' fill-opacity='0.85'/>" +
  "</svg>";

export const data = {
  settings: {
    width: 1080,
    height: 1920,
    fps: 30,
    backgroundColor: "#111111",
    format: "mp4",
    videoCodec: "avc1.640033",
    bitrate: 12000000,
    audio: true,
    audioCodec: "opus",
    audioSampleRate: 48000,
    prioritizeSpeed: true,
  },
  tracks: [
    {
      id: "track_f3SSMx2R7h",
      name: "Captions",
      type: "caption",
      clipIds: [
        "kKCRNu3fI3GQNVO0sJmEk",
        "WJBGwuI6-rDDCF7-jiX9p",
        "wwKOQuXUAggYzl2bn1HjC",
        "NIs-GA5jPW4hzFi6wf9Z8",
        "94Zt1sGihN7BBVQCeyZG7",
        "ndIa1kuR765apGDpHvaU1",
        "YXU8ZPmIOL_0fetzLB1am",
      ],
    },
    {
      id: "pturMA-tPQFWz6JKBuDMg",
      name: "Video Track",
      type: "video",
      clipIds: ["ngmkuxdgyTblaat5J_aVI", "VlHzjHC9tPGAAIXJt1m1v"],
    },
  ],
  clips: {
    VlHzjHC9tPGAAIXJt1m1v: {
      type: "Image",
      id: "VlHzjHC9tPGAAIXJt1m1v",
      name: "Starter Card",
      src: STARTER_CARD,
      timing: {
        display: {
          from: 6834675,
          to: 11834675,
        },
        trim: {
          from: 0,
          to: 0,
        },
        duration: 5000000,
        playbackRate: 1,
      },
      transform: {
        x: 4.186046511627865,
        y: 0,
        width: 1071.6279069767443,
        height: 1920,
        angle: 0,
        opacity: 1,
        zIndex: 10,
        flip: {
          x: false,
          y: false,
        },
      },
      style: {},
      animations: [
        {
          type: "keyframes",
          options: {
            duration: 5000000,
            delay: 0,
            easing: "linear",
            iterCount: 1,
            id: "keyframe_1extjxp61",
            disableGlobalEasing: false,
          },
          params: {
            "0%": {
              x: -250,
              blur: 7,
              angle: 5,
              mirror: 1,
            },
            "45%": {
              x: -40,
              blur: 1,
              angle: 2,
              mirror: 1,
            },
            "55%": {
              x: 0,
              blur: 0,
              angle: 0,
              mirror: 1,
            },
            "60%": {
              x: 0,
              blur: 0,
              angle: 0,
              mirror: 1,
            },
            "85%": {
              x: -40,
              blur: 0,
              angle: -2,
              mirror: 1,
            },
            "100%": {
              x: -250,
              blur: 0,
              angle: -5,
              mirror: 1,
            },
          },
        },
      ],
      chromaKey: {
        enabled: false,
        color: "#00FF00",
        similarity: 0.1,
        spill: 0,
      },
      colorAdjustment: {
        enabled: false,
        type: "basic",
        basic: {},
        hsl: {},
        curves: {},
      },
      locked: false,
      metadata: {},
      effects: [],
    },
    ngmkuxdgyTblaat5J_aVI: {
      type: "Image",
      id: "ngmkuxdgyTblaat5J_aVI",
      name: "Starter Backdrop",
      src: STARTER_BACKDROP,
      timing: {
        display: {
          from: 0,
          to: 12000000,
        },
        trim: {
          from: 0,
          to: 12000000,
        },
        duration: 12000000,
        playbackRate: 1,
      },
      transform: {
        x: 0,
        y: 0,
        width: 1080,
        height: 1920,
        angle: 0,
        opacity: 1,
        zIndex: 10,
        flip: {
          x: false,
          y: false,
        },
      },
      style: {},
      chromaKey: {
        enabled: false,
        color: "#00FF00",
        similarity: 0.1,
        spill: 0,
      },
      colorAdjustment: {
        enabled: false,
        type: "basic",
        basic: {},
        hsl: {},
        curves: {},
      },
      locked: false,
      metadata: {},
      effects: [],
    },
    kKCRNu3fI3GQNVO0sJmEk: {
      type: "Caption",
      id: "kKCRNu3fI3GQNVO0sJmEk",
      name: "Caption",
      src: "",
      timing: {
        display: {
          from: 240000,
          to: 1360000,
        },
        trim: {
          from: 0,
          to: 0,
        },
        duration: 1120000,
        playbackRate: 1,
      },
      transform: {
        x: 245,
        y: 1470,
        width: 590,
        height: 105,
        angle: 0,
        opacity: 1,
        zIndex: 20,
        flip: {
          x: false,
          y: false,
        },
      },
      style: {
        fontSize: 80,
        fontFamily: "Bangers-Regular",
        fontWeight: "700",
        fontStyle: "normal",
        color: "#ffffff",
        align: "center",
        fontUrl: "https://fonts.gstatic.com/s/poppins/v15/pxiByp8kv8JHgFVrLCz7V1tvFP-KUEg.ttf",
        wordWrapWidth: 590,
        wordWrap: true,
        stroke: {
          color: "#000000",
          width: 4,
        },
        shadow: {
          color: "#000000",
          alpha: 0.5,
          blur: 4,
          offsetX: 2,
          offsetY: 2,
        },
      },
      chromaKey: {
        enabled: false,
        color: "#00FF00",
        similarity: 0.1,
        spill: 0,
      },
      colorAdjustment: {
        enabled: false,
        type: "basic",
        basic: {},
        hsl: {},
        curves: {},
      },
      locked: false,
      metadata: {
        sourceClipId: "ngmkuxdgyTblaat5J_aVI",
      },
      text: "I see a lot of",
      caption: {
        words: [
          {
            text: "I",
            from: 0,
            to: 479.9999700000001,
            isKeyWord: true,
            paragraphIndex: "",
          },
          {
            text: "see",
            from: 479.9999700000001,
            to: 800,
            isKeyWord: false,
            paragraphIndex: "",
          },
          {
            text: "a",
            from: 800,
            to: 880.0000000000001,
            isKeyWord: false,
            paragraphIndex: "",
          },
          {
            text: "lot",
            from: 880.0000000000001,
            to: 1040,
            isKeyWord: false,
            paragraphIndex: "",
          },
          {
            text: "of",
            from: 1040,
            to: 1120,
            isKeyWord: true,
            paragraphIndex: "",
          },
        ],
        colors: {
          active: { color: "#ffffff", background: "#FF5700" },
          future: { color: "#ffffff" },
          keyword: { color: "#ffffff", preserveAfterSpoken: true },
        },
        positioning: {
          videoWidth: 1080,
          videoHeight: 1920,
        },
      },
      effects: [],
      mediaId: "ngmkuxdgyTblaat5J_aVI",
      wordsPerLine: "multiple",
      fontUrl: "https://fonts.gstatic.com/s/poppins/v15/pxiByp8kv8JHgFVrLCz7V1tvFP-KUEg.ttf",
    },
    "WJBGwuI6-rDDCF7-jiX9p": {
      type: "Caption",
      id: "WJBGwuI6-rDDCF7-jiX9p",
      name: "Caption",
      src: "",
      timing: {
        display: {
          from: 1360000,
          to: 2080000,
        },
        trim: {
          from: 0,
          to: 0,
        },
        duration: 720000,
        playbackRate: 1,
      },
      transform: {
        x: 198.5,
        y: 1470,
        width: 689,
        height: 105,
        angle: 0,
        opacity: 1,
        zIndex: 20,
        flip: {
          x: false,
          y: false,
        },
      },
      style: {
        fontSize: 80,
        fontFamily: "Bangers-Regular",
        fontWeight: "700",
        fontStyle: "normal",
        color: "#ffffff",
        align: "center",
        fontUrl: "https://fonts.gstatic.com/s/poppins/v15/pxiByp8kv8JHgFVrLCz7V1tvFP-KUEg.ttf",
        wordWrapWidth: 689,
        wordWrap: true,
        stroke: {
          color: "#000000",
          width: 4,
        },
        shadow: {
          color: "#000000",
          alpha: 0.5,
          blur: 4,
          offsetX: 2,
          offsetY: 2,
        },
      },
      chromaKey: {
        enabled: false,
        color: "#00FF00",
        similarity: 0.1,
        spill: 0,
      },
      colorAdjustment: {
        enabled: false,
        type: "basic",
        basic: {},
        hsl: {},
        curves: {},
      },
      locked: false,
      metadata: {
        sourceClipId: "ngmkuxdgyTblaat5J_aVI",
      },
      text: "misinformation",
      caption: {
        words: [
          {
            text: "misinformation",
            from: 0,
            to: 720,
            isKeyWord: true,
            paragraphIndex: "",
          },
        ],
        colors: {
          active: { color: "#ffffff", background: "#FF5700" },
          future: { color: "#ffffff" },
          keyword: { color: "#ffffff", preserveAfterSpoken: true },
        },
        positioning: {
          videoWidth: 1080,
          videoHeight: 1920,
        },
      },
      effects: [],
      mediaId: "ngmkuxdgyTblaat5J_aVI",
      wordsPerLine: "multiple",
      fontUrl: "https://fonts.gstatic.com/s/poppins/v15/pxiByp8kv8JHgFVrLCz7V1tvFP-KUEg.ttf",
    },
    wwKOQuXUAggYzl2bn1HjC: {
      type: "Caption",
      id: "wwKOQuXUAggYzl2bn1HjC",
      name: "Caption",
      src: "",
      timing: {
        display: {
          from: 2080000,
          to: 2720000,
        },
        trim: {
          from: 0,
          to: 0,
        },
        duration: 640000,
        playbackRate: 1,
      },
      transform: {
        x: 233.5,
        y: 1470,
        width: 613,
        height: 105,
        angle: 0,
        opacity: 1,
        zIndex: 20,
        flip: {
          x: false,
          y: false,
        },
      },
      style: {
        fontSize: 80,
        fontFamily: "Bangers-Regular",
        fontWeight: "700",
        fontStyle: "normal",
        color: "#ffffff",
        align: "center",
        fontUrl: "https://fonts.gstatic.com/s/poppins/v15/pxiByp8kv8JHgFVrLCz7V1tvFP-KUEg.ttf",
        wordWrapWidth: 613,
        wordWrap: true,
        stroke: {
          color: "#000000",
          width: 4,
        },
        shadow: {
          color: "#000000",
          alpha: 0.5,
          blur: 4,
          offsetX: 2,
          offsetY: 2,
        },
      },
      chromaKey: {
        enabled: false,
        color: "#00FF00",
        similarity: 0.1,
        spill: 0,
      },
      colorAdjustment: {
        enabled: false,
        type: "basic",
        basic: {},
        hsl: {},
        curves: {},
      },
      locked: false,
      metadata: {
        sourceClipId: "ngmkuxdgyTblaat5J_aVI",
      },
      text: "going around",
      caption: {
        words: [
          {
            text: "going",
            from: 0,
            to: 399.9999999999999,
            isKeyWord: true,
            paragraphIndex: "",
          },
          {
            text: "around",
            from: 399.9999999999999,
            to: 640.0000000000001,
            isKeyWord: true,
            paragraphIndex: "",
          },
        ],
        colors: {
          active: { color: "#ffffff", background: "#FF5700" },
          future: { color: "#ffffff" },
          keyword: { color: "#ffffff", preserveAfterSpoken: true },
        },
        positioning: {
          videoWidth: 1080,
          videoHeight: 1920,
        },
      },
      effects: [],
      mediaId: "ngmkuxdgyTblaat5J_aVI",
      wordsPerLine: "multiple",
      fontUrl: "https://fonts.gstatic.com/s/poppins/v15/pxiByp8kv8JHgFVrLCz7V1tvFP-KUEg.ttf",
    },
    "NIs-GA5jPW4hzFi6wf9Z8": {
      type: "Caption",
      id: "NIs-GA5jPW4hzFi6wf9Z8",
      name: "Caption",
      src: "",
      timing: {
        display: {
          from: 2720000,
          to: 3040000,
        },
        trim: {
          from: 0,
          to: 0,
        },
        duration: 320000,
        playbackRate: 1,
      },
      transform: {
        x: 398,
        y: 1470,
        width: 290,
        height: 105,
        angle: 0,
        opacity: 1,
        zIndex: 20,
        flip: {
          x: false,
          y: false,
        },
      },
      style: {
        fontSize: 80,
        fontFamily: "Bangers-Regular",
        fontWeight: "700",
        fontStyle: "normal",
        color: "#ffffff",
        align: "center",
        fontUrl: "https://fonts.gstatic.com/s/poppins/v15/pxiByp8kv8JHgFVrLCz7V1tvFP-KUEg.ttf",
        wordWrapWidth: 290,
        wordWrap: true,
        stroke: {
          color: "#000000",
          width: 4,
        },
        shadow: {
          color: "#000000",
          alpha: 0.5,
          blur: 4,
          offsetX: 2,
          offsetY: 2,
        },
      },
      chromaKey: {
        enabled: false,
        color: "#00FF00",
        similarity: 0.1,
        spill: 0,
      },
      colorAdjustment: {
        enabled: false,
        type: "basic",
        basic: {},
        hsl: {},
        curves: {},
      },
      locked: false,
      metadata: {
        sourceClipId: "ngmkuxdgyTblaat5J_aVI",
      },
      text: "about",
      caption: {
        words: [
          {
            text: "about",
            from: 0,
            to: 319.99999999999983,
            isKeyWord: true,
            paragraphIndex: "",
          },
        ],
        colors: {
          active: { color: "#ffffff", background: "#FF5700" },
          future: { color: "#ffffff" },
          keyword: { color: "#ffffff", preserveAfterSpoken: true },
        },
        positioning: {
          videoWidth: 1080,
          videoHeight: 1920,
        },
      },
      effects: [],
      mediaId: "ngmkuxdgyTblaat5J_aVI",
      wordsPerLine: "multiple",
      fontUrl: "https://fonts.gstatic.com/s/poppins/v15/pxiByp8kv8JHgFVrLCz7V1tvFP-KUEg.ttf",
    },
    "94Zt1sGihN7BBVQCeyZG7": {
      type: "Caption",
      id: "94Zt1sGihN7BBVQCeyZG7",
      name: "Caption",
      src: "",
      timing: {
        display: {
          from: 3040000,
          to: 4320000,
        },
        trim: {
          from: 0,
          to: 0,
        },
        duration: 1280000,
        playbackRate: 1,
      },
      transform: {
        x: 175.5,
        y: 1470,
        width: 729,
        height: 105,
        angle: 0,
        opacity: 1,
        zIndex: 20,
        flip: {
          x: false,
          y: false,
        },
      },
      style: {
        fontSize: 80,
        fontFamily: "Bangers-Regular",
        fontWeight: "700",
        fontStyle: "normal",
        color: "#ffffff",
        align: "center",
        fontUrl: "https://fonts.gstatic.com/s/poppins/v15/pxiByp8kv8JHgFVrLCz7V1tvFP-KUEg.ttf",
        wordWrapWidth: 729,
        wordWrap: true,
        stroke: {
          color: "#000000",
          width: 4,
        },
        shadow: {
          color: "#000000",
          alpha: 0.5,
          blur: 4,
          offsetX: 2,
          offsetY: 2,
        },
      },
      chromaKey: {
        enabled: false,
        color: "#00FF00",
        similarity: 0.1,
        spill: 0,
      },
      colorAdjustment: {
        enabled: false,
        type: "basic",
        basic: {},
        hsl: {},
        curves: {},
      },
      locked: false,
      metadata: {
        sourceClipId: "ngmkuxdgyTblaat5J_aVI",
      },
      text: "methylene blue,",
      caption: {
        words: [
          {
            text: "methylene",
            from: 0,
            to: 560,
            isKeyWord: true,
            paragraphIndex: "",
          },
          {
            text: "blue,",
            from: 560,
            to: 1280.0000000000002,
            isKeyWord: true,
            paragraphIndex: "",
          },
        ],
        colors: {
          active: { color: "#ffffff", background: "#FF5700" },
          future: { color: "#ffffff" },
          keyword: { color: "#ffffff", preserveAfterSpoken: true },
        },
        positioning: {
          videoWidth: 1080,
          videoHeight: 1920,
        },
      },
      effects: [],
      mediaId: "ngmkuxdgyTblaat5J_aVI",
      wordsPerLine: "multiple",
      fontUrl: "https://fonts.gstatic.com/s/poppins/v15/pxiByp8kv8JHgFVrLCz7V1tvFP-KUEg.ttf",
    },
    ndIa1kuR765apGDpHvaU1: {
      type: "Caption",
      id: "ndIa1kuR765apGDpHvaU1",
      name: "Caption",
      src: "",
      timing: {
        display: {
          from: 4400000,
          to: 5759999.800000001,
        },
        trim: {
          from: 0,
          to: 0,
        },
        duration: 1359999.8000000005,
        playbackRate: 1,
      },
      transform: {
        x: 131,
        y: 1470,
        width: 818,
        height: 105,
        angle: 0,
        opacity: 1,
        zIndex: 20,
        flip: {
          x: false,
          y: false,
        },
      },
      style: {
        fontSize: 80,
        fontFamily: "Bangers-Regular",
        fontWeight: "700",
        fontStyle: "normal",
        color: "#ffffff",
        align: "center",
        fontUrl: "https://fonts.gstatic.com/s/poppins/v15/pxiByp8kv8JHgFVrLCz7V1tvFP-KUEg.ttf",
        wordWrapWidth: 818,
        wordWrap: true,
        stroke: {
          color: "#000000",
          width: 4,
        },
        shadow: {
          color: "#000000",
          alpha: 0.5,
          blur: 4,
          offsetX: 2,
          offsetY: 2,
        },
      },
      chromaKey: {
        enabled: false,
        color: "#00FF00",
        similarity: 0.1,
        spill: 0,
      },
      colorAdjustment: {
        enabled: false,
        type: "basic",
        basic: {},
        hsl: {},
        curves: {},
      },
      locked: false,
      metadata: {
        sourceClipId: "ngmkuxdgyTblaat5J_aVI",
      },
      text: "so let's clear up a",
      caption: {
        words: [
          {
            text: "so",
            from: 0,
            to: 399.9996999999995,
            isKeyWord: true,
            paragraphIndex: "",
          },
          {
            text: "let's",
            from: 399.9996999999995,
            to: 799.9999999999998,
            isKeyWord: false,
            paragraphIndex: "",
          },
          {
            text: "clear",
            from: 799.9999999999998,
            to: 1040,
            isKeyWord: false,
            paragraphIndex: "",
          },
          {
            text: "up",
            from: 1040,
            to: 1199.9999999999993,
            isKeyWord: false,
            paragraphIndex: "",
          },
          {
            text: "a",
            from: 1199.9999999999993,
            to: 1359.9997999999998,
            isKeyWord: true,
            paragraphIndex: "",
          },
        ],
        colors: {
          active: { color: "#ffffff", background: "#FF5700" },
          future: { color: "#ffffff" },
          keyword: { color: "#ffffff", preserveAfterSpoken: true },
        },
        positioning: {
          videoWidth: 1080,
          videoHeight: 1920,
        },
      },
      effects: [],
      mediaId: "ngmkuxdgyTblaat5J_aVI",
      wordsPerLine: "multiple",
      fontUrl: "https://fonts.gstatic.com/s/poppins/v15/pxiByp8kv8JHgFVrLCz7V1tvFP-KUEg.ttf",
    },
    YXU8ZPmIOL_0fetzLB1am: {
      type: "Caption",
      id: "YXU8ZPmIOL_0fetzLB1am",
      name: "Caption",
      src: "",
      timing: {
        display: {
          from: 5759999.800000001,
          to: 6399999.600000001,
        },
        trim: {
          from: 0,
          to: 0,
        },
        duration: 639999.7999999998,
        playbackRate: 1,
      },
      transform: {
        x: 160,
        y: 1470,
        width: 760,
        height: 105,
        angle: 0,
        opacity: 1,
        zIndex: 20,
        flip: {
          x: false,
          y: false,
        },
      },
      style: {
        fontSize: 80,
        fontFamily: "Bangers-Regular",
        fontWeight: "700",
        fontStyle: "normal",
        color: "#ffffff",
        align: "center",
        fontUrl: "https://fonts.gstatic.com/s/poppins/v15/pxiByp8kv8JHgFVrLCz7V1tvFP-KUEg.ttf",
        wordWrapWidth: 760,
        wordWrap: true,
        stroke: {
          color: "#000000",
          width: 4,
        },
        shadow: {
          color: "#000000",
          alpha: 0.5,
          blur: 4,
          offsetX: 2,
          offsetY: 2,
        },
      },
      chromaKey: {
        enabled: false,
        color: "#00FF00",
        similarity: 0.1,
        spill: 0,
      },
      colorAdjustment: {
        enabled: false,
        type: "basic",
        basic: {},
        hsl: {},
        curves: {},
      },
      locked: false,
      metadata: {
        sourceClipId: "ngmkuxdgyTblaat5J_aVI",
      },
      text: "couple of things.",
      caption: {
        words: [
          {
            text: "couple",
            from: 0,
            to: 240.0001999999999,
            isKeyWord: true,
            paragraphIndex: "",
          },
          {
            text: "of",
            from: 240.0001999999999,
            to: 400.0002,
            isKeyWord: false,
            paragraphIndex: "",
          },
          {
            text: "things.",
            from: 400.0002,
            to: 639.9998,
            isKeyWord: true,
            paragraphIndex: "",
          },
        ],
        colors: {
          active: { color: "#ffffff", background: "#FF5700" },
          future: { color: "#ffffff" },
          keyword: { color: "#ffffff", preserveAfterSpoken: true },
        },
        positioning: {
          videoWidth: 1080,
          videoHeight: 1920,
        },
      },
      effects: [],
      mediaId: "ngmkuxdgyTblaat5J_aVI",
      wordsPerLine: "multiple",
      fontUrl: "https://fonts.gstatic.com/s/poppins/v15/pxiByp8kv8JHgFVrLCz7V1tvFP-KUEg.ttf",
    },
  },
};
