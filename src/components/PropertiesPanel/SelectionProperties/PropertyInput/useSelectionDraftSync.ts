import { useEffect, useSyncExternalStore } from 'react'
import { type ResolvedPropertyStates } from '../SelectionPropertyStatesResolver'
import {
    subscribe,
    getSnapshot,
    clearDrafts
} from './SelectionDraftStore'

export function useSelectionDraftSync(
    selectedElementIds: string[],
    propertyStates: ResolvedPropertyStates
) {
    useSyncExternalStore(subscribe, getSnapshot)

    const selectionKey = selectedElementIds.join('|')
    const propertyStatesKey = JSON.stringify(propertyStates)

    useEffect(() => {
        clearDrafts()
    }, [selectionKey, propertyStatesKey])
}