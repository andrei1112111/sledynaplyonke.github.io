import { VFX } from "./vfx-core.js";

// ====== Основной шейдер (постэффект) ======
const shader = `
precision highp float;
uniform sampler2D src;
uniform vec2 offset;
uniform vec2 resolution;
uniform float time;
out vec4 outColor;

vec4 readTex(vec2 uv) {  
  vec4 c = texture(src, uv);
  return c;
}

vec2 zoom(vec2 uv, float t) {
  return (uv - 0.5) * t + 0.5;
}

float rand(vec3 p) {
  return fract(sin(dot(p, vec3(829., 4839., 432.))) * 39428.);
}

void main() {
  vec2 uv = (gl_FragCoord.xy - offset) / resolution;
  vec2 p = uv * 2.0 - 1.0;
  p.x *= resolution.x / resolution.y;

  float lx = abs(p.x);
  float ly = abs(p.y);
  float l = max(lx, ly);

  float dist = smoothstep(0.0, 1.0, l * 1.2);
  uv = zoom(uv, 0.85 + dist * 0.2);

  vec2 uvr = uv + vec2(0.0015, 0.0);
  vec2 uvb = uv - vec2(0.0015, 0.0);

  vec4 cr = readTex(uvr);
  vec4 cg = readTex(uv);
  vec4 cb = readTex(uvb);

  vec4 color = vec4(cr.r, cg.g, cb.b, 1.0);

  float deco = 0.0;
  deco += sin(uv.y * resolution.y * 0.7 + time * 100.0) *
          sin(uv.y * resolution.y * 0.3 - time * 130.0) * 0.05;

  deco += smoothstep(0.01, 0.0, min(fract(uv.x * 20.0), fract(uv.y * 20.0))) * 0.1;
  color += deco * smoothstep(1.0, 0.0, l);

  color *= 1.2 - l * 0.5;
  color += rand(vec3(p, time)) * 0.08;

  outColor = color;
}
`;

// ====== Шейдер для элементов (видео, текст, картинки) ======
const shader2 = `
precision highp float;
uniform sampler2D src;
uniform vec2 offset;
uniform vec2 resolution;
uniform float time;
uniform float id;
out vec4 outColor;

vec4 readTex(vec2 uv) {  
  vec4 c = texture(src, uv);  
  c.a *= smoothstep(.5, .499, abs(uv.x - .5)) * smoothstep(.5, .499, abs(uv.y - .5));
  return c;
}

void main() {
  vec2 uv = (gl_FragCoord.xy - offset) / resolution;
  vec2 uvr = uv, uvg = uv, uvb = uv;
  vec4 cr = readTex(uvr);
  vec4 cg = readTex(uvg);
  vec4 cb = readTex(uvb);
  outColor = vec4(cr.r, cg.g, cb.b, (cr.a + cg.a + cb.a) / 1.);
}
`;

// ====== Универсальная функция для локальных видео ======
function playVideo(video) {
    const src = video.dataset.src || video.src;
    if (!src) return;
    if (!video.src) video.src = src;

    // обязательно задать mute + inline
    video.muted = true;
    video.playsInline = true;

    video.play().catch(err => {
        console.warn("Autoplay blocked, waiting for user gesture:", err);
    });
}

// ====== Инициализация после загрузки страницы ======
document.addEventListener("DOMContentLoaded", () => {
    const videos = document.querySelectorAll("video.header-video");
    let loadedVideos = 0;
    let vfxInitialized = false;

    // === Подсказка ===
    const hint = document.createElement("div");
    hint.textContent = "Нажмите на экран, если видео не начали проигрываться)";
    Object.assign(hint.style, {
        position: "fixed",
        top: "20px",
        right: "-800px",
        background: "rgba(0, 0, 0, 0.7)",
        color: "#fff",
        padding: "12px 18px",
        borderRadius: "8px",
        fontSize: "15px",
        fontFamily: "sans-serif",
        zIndex: 9999,
        boxShadow: "0 0 10px rgba(0,0,0,0.4)",
        transition: "right 0.8s ease, opacity 0.8s ease",
        opacity: "0.9"
    });
    document.body.appendChild(hint);

    setTimeout(() => {
        hint.style.right = "20px";
    }, 10000);

    const hideHint = () => {
        hint.style.opacity = "0";
        hint.style.right = "-400px";
        setTimeout(() => hint.remove(), 800);
        document.removeEventListener("click", hideHint);
        // запустить все видео при первом клике (если autoplay был заблокирован)
        videos.forEach(v => v.play().catch(()=>{}));
    };
    document.addEventListener("click", hideHint);

    // === Функция инициализации VFX ===
    function tryInitVFX() {
        if (vfxInitialized) return;
        if (videos.length === 0 || loadedVideos === videos.length) {
            setTimeout(() => {
                initVFX();
                vfxInitialized = true;
            }, 300);
        }
    }

    // === Запуск загрузки видео ===
    if (videos.length === 0) {
        tryInitVFX();
    } else {
        videos.forEach(video => {
            playVideo(video);

            video.addEventListener("loadeddata", () => {
                loadedVideos++;
                tryInitVFX();
            });

            video.addEventListener("error", () => {
                console.error("Video failed to load:", video.dataset.src || video.src);
                loadedVideos++;
                tryInitVFX();
            });
        });
    }
});

// ====== Инициализация VFX ======
function initVFX() {
    const vfx = new VFX({
        scrollPadding: false,
        postEffect: { shader },
        autoResize: true,
        cover: true,
        mipmap: false, // отключаем генерацию mipmap
    });

    let i = 0;
    for (const el of document.querySelectorAll("img, video, h1, h2, p")) {
        const z = el.getAttribute("data-z");
        const isVideo = el.tagName === "VIDEO";

        vfx.add(el, {
            shader: shader2,
            uniforms: { id: i++ },
            zIndex: z ? parseInt(z) : 0,
            replace: !isVideo
        });
    }

    return vfx;
}
