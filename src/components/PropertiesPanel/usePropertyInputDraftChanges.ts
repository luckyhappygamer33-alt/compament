import { useEffect, useSyncExternalStore } from 'react'
import { type PropertiesState } from './PropertyStatesResolver'
import { subscribe, getSnapshot } from './PropertyInputDraftStore'
import { clearPropertyInputDrafts } from './PropertyInputProps'

export function usePropertyInputDraftChanges(
    selectedElementIds: string[],
    propertyStates: PropertiesState
) {
    useSyncExternalStore(subscribe, getSnapshot)

    const selectionKey = selectedElementIds.join('|')
    const propertyStatesKey = JSON.stringify(propertyStates)

    useEffect(() => {
        clearPropertyInputDrafts()
    }, [selectionKey, propertyStatesKey])
}