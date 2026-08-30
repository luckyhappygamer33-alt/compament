const drafts = new Map<string, string>()

const listeners = new Set<() => void>()
let version = 0

export function getDraft(
    inputKey: string
) {
    return drafts.get(inputKey)
}

export function setDraft(
    inputKey: string,
    value: string
) {
    drafts.set(inputKey, value)
}

export function deleteDraft(
    inputKey: string
) {
    drafts.delete(inputKey)
}

export function clearDrafts() {
    if (drafts.size === 0) return

    drafts.clear()
    notifyDraftChange()
}

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