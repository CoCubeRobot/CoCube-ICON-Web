export function base64ToArrayBuffer(base64) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);

    for (let index = 0; index < binary.length; index++) {
        bytes[index] = binary.charCodeAt(index);
    }

    return bytes.buffer;
}

export function hasNativeFilePicker() {
    return Boolean(window.Capacitor?.Plugins?.CoCubeFilePicker);
}

export async function openNativeFile(extension) {
    const result = await window.Capacitor.Plugins.CoCubeFilePicker.openFile({ extension });
    if (!result || result.cancelled) return null;

    return {
        name: result.name,
        contents: base64ToArrayBuffer(result.data)
    };
}

export async function saveNativeFile(name, text) {
    return window.Capacitor.Plugins.CoCubeFilePicker.saveFile({ name, text });
}

if (typeof window !== 'undefined') {
    window.CoCubeFilePicker = { hasNativeFilePicker, openNativeFile, saveNativeFile };
}
