export function selectionCancelled() {
    const error = new Error('Selection cancelled');
    error.code = 'SELECTION_CANCELLED';
    return error;
}

export function isSelectionCancelled(error) {
    return error?.code === 'SELECTION_CANCELLED';
}
