const listeners = new Set<() => void>()
let version = 0

export function subscribe(
    listener: () => void
) {
    listeners.add(listener)

    return () => {
        listeners.delete(listener)
    }
}

export function getSnapshot() {
    return version
}

export function notifyDraftChange() {
    version++

    for (const listener of listeners) {
        listener()
    }
}