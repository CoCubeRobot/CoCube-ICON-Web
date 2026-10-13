// Geometry-only Canvas adapter. These tests exercise the real GP parser/compiler,
// not browser painting; no native Canvas or extra package is required by npm test.
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

export function sensorEditor({icons = false, execution = false, createCanvas} = {}) {
    class Canvas {
        constructor() {
            if (createCanvas) {
                const canvas = createCanvas(1, 1); canvas.dataset = {}; return canvas;
            }
            this.width = this.height = 1; this.dataset = {};
        }
        getContext() {
            const drawing = {backingStorePixelRatio: 1, measureText: text => ({width: String(text).length * 7}),
                getImageData: () => ({data: Uint8ClampedArray.of(0, 0, 0, 255)}),
                createLinearGradient: () => ({addColorStop() {}})};
            return new Proxy(drawing, {get: (object, name) =>
                String(name).endsWith('BackingStorePixelRatio') ? undefined : object[name] ?? (() => {})});
        }
    }
    const errors = [];
    const context = vm.createContext({TextEncoder, TextDecoder, setTimeout, clearTimeout,
        console: {log: (...args) => { if (String(args[0]).includes('syntax error')) errors.push(args.join(' ')); },
            warn() {}, error: (...args) => errors.push(args.join(' '))},
        window: {devicePixelRatio: 1}, HTMLCanvasElement: Canvas,
        CanvasRenderingContext2D: class {}, Path2D: class {}, localize: text => text,
        document: {createElement: type => type === 'audio' ? {play() {}} : new Canvas()},
        MB_editor: {iconLayout: false, scriptChanged() {}},
        MB_IconInputs: {configure() {}, label() {}, buildChoices() {}},
        MB_IconStop: {restore: node => node},
        MB_IconMorph: function () {}, MB_IconParameterSlotMorph: function () {},
        MB_IconBlocks: {enabled: () => false}});
    for (const file of ['morphic', 'mb-blocks', 'mb-specs', 'mb-parser', 'mb-function', 'mb-project',
        'mb-code-manager', 'mb-compiler', 'mb-decompiler', 'mb-connection', 'mb-editor',
        ...(icons ? ['mb-icon-blocks', 'mb-icon-inputs'] : []), 'mb-icon-gripper',
        ...(execution ? ['mb-execution-highlight'] : [])]) {
        const code = readFileSync(new URL(`../../src/js-editor/${file}.js`, import.meta.url), 'utf8');
        vm.runInContext(code.replace('const MB_editor = new MB_Editor();', ''), context, {filename: file});
    }
    vm.runInContext('MB_editor = new MB_Editor();', context);
    return {context, errors, run: code => vm.runInContext(code, context),
        module: readFileSync(new URL('../../src/js-editor/Libraries/Robots/CoCube Module.ubl', import.meta.url), 'utf8'),
        servo: readFileSync(new URL('../../src/js-editor/Libraries/Servo.ubl', import.meta.url), 'utf8')};
}
