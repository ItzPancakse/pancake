import { Application, Assets, AnimatedSprite, Texture, Rectangle } from "pixi.js";
import { getCurrentWindow, currentMonitor, LogicalPosition } from "@tauri-apps/api/window";
import { invoke } from "@tauri-apps/api/core";

console.log("main.ts loaded");

async function main() {
    const win = getCurrentWindow();
    const SIZE = 128;

    const backend = await invoke<string>("window_backend");
    const canMoveWindow = backend !== "wayland";
    console.log("backend:", backend, "canMoveWindow:", canMoveWindow);

    const app = new Application();
    await app.init({
        backgroundAlpha: 0,
        resizeTo: window,
        resolution: devicePixelRatio,
        autoDensity: true,
    });
    document.body.appendChild(app.canvas);

    const sheet = await Assets.load("/pet.png");
    sheet.source.scaleMode = "nearest";

    const frames = (row: number, count: number, s = 32) =>
        Array.from({ length: count }, (_, i) =>
            new Texture({ source: sheet.source, frame: new Rectangle(i * s, row * s, s, s) }));

    const anims = {
        idle: frames(0, 4),
        walk: frames(1, 6),
        sleep: frames(2, 2),
        drag: frames(0, 1),
    };

    const pet = new AnimatedSprite(anims.idle);
    pet.anchor.set(0.5);
    pet.scale.set(SIZE / 32);
    pet.position.set(SIZE / 2, SIZE / 2);
    pet.animationSpeed = 0.12;
    pet.play();
    pet.eventMode = "static";
    pet.cursor = "grab";
    app.stage.addChild(pet);

    const mon = await currentMonitor();
    const sf = mon?.scaleFactor ?? 1;
    const screenW = (mon?.size.width ?? 1920) / sf;
    const screenH = (mon?.size.height ?? 1080) / sf;
    let x = screenW / 2;
    let y = screenH - SIZE - 48;
    let dir = 1;

    type State = keyof typeof anims;
    let state: State = "idle";
    let timer = 120;

    function setState(s: State, duration = 120 + Math.random() * 240) {
        state = s;
        timer = duration;
        pet.textures = anims[s];
        pet.play();
    }

    function pickNext() {
        const r = Math.random();
        if (r < 0.5) { dir = Math.random() < 0.5 ? -1 : 1; setState("walk"); }
        else if (r < 0.8) setState("idle");
        else setState("sleep", 400);
    }

    app.ticker.add((t) => {
        timer -= t.deltaTime;

        if (state === "walk") {
            pet.scale.x = Math.abs(pet.scale.x) * dir;
            if (canMoveWindow) {
                x += dir * 1.5 * t.deltaTime;
                if (x < 0 || x > screenW - SIZE) {
                    dir *= -1;
                    x = Math.max(0, Math.min(x, screenW - SIZE));
                }
                win.setPosition(new LogicalPosition(Math.round(x), Math.round(y)));
            }
        }

        if (timer <= 0 && state !== "drag") pickNext();
    });

    pet.on("pointerdown", async () => {
        setState("drag", Infinity);
        await win.startDragging();
    });

    window.addEventListener("pointermove", async () => {
        if (state !== "drag") return;
        const p = (await win.outerPosition()).toLogical(sf);
        x = p.x; y = p.y;
        setState("idle");
    });

    setState("idle");
}

main().catch((e) => console.error("pet failed to start:", e));
