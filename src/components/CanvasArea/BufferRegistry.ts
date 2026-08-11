const bufferRegistry = new Map<string, OffscreenCanvas>()

export function createBuffer(layerId: string, width: number, height: number) {
    const buffer = new OffscreenCanvas(width, height)
    bufferRegistry.set(layerId, buffer)
}

export function getBuffer(layerId: string) {
    return bufferRegistry.get(layerId)
}

export function deleteBuffer(layerId: string) {
    bufferRegistry.delete(layerId)
}

export function mergeBuffer(sourceBufferId: string, destinationBufferId: string) {
    const sourceBuffer = getBuffer(sourceBufferId)
    const destinationBuffer = getBuffer(destinationBufferId)

    if (!sourceBuffer || !destinationBuffer) return
    const destCtx = destinationBuffer.getContext('2d')
    if (destCtx) destCtx.drawImage(sourceBuffer, 0, 0)
}