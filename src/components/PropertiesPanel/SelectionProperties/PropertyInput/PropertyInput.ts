import type { InputHTMLAttributes } from 'react'
import type { PropertyState } from '../SelectionPropertyStatesResolver'
import {
    getDraft,
    setDraft,
    deleteDraft,
    notifyDraftChange

} from './SelectionDraftStore'

type ParsedInput =
    | {
        valid: true,
        value: unknown
    }
    | {
        valid: false
    }

function parseInputValue(
    value: string,
    inputValueType: string
): ParsedInput {
    if (inputValueType === 'string') return {
        valid: true,
        value
    }

    if (inputValueType === 'number') {
        const normalizedValue = value.trim().replace(',', '.')
        const isValidNumber = /^[+-]?\d+(?:\.\d+)?$/.test(normalizedValue)

        if (!isValidNumber) return {
            valid: false
        }

        return {
            valid: true,
            value: Number(normalizedValue)
        }
    }

    if (inputValueType === 'boolean') {
        const normalizedValue = value.trim().toLowerCase()
        const isValidBoolean = normalizedValue === 'true' || normalizedValue === 'false'

        if (!isValidBoolean) return {
            valid: false
        }

        return {
            valid: true,
            value: normalizedValue === 'true'
        }
    }

    return {
        valid: false
    }
}

function commitInputValue(
    value: unknown,
    inputKeys: string[],
    updateValue: (newValue: unknown) => void
) {
    for (const inputKey of inputKeys) {
        deleteDraft(inputKey)
    }

    updateValue(value)
    notifyDraftChange()
}

function storeSelectionDraft(
    value: string,
    inputKeys: string[]
) {
    for (const inputKey of inputKeys) {
        setDraft(inputKey, value)
    }

    notifyDraftChange()
}

export function getPropertyInput(
    property: string,
    propertyPath: string[],
    propertyState: PropertyState<unknown>,
    inputValueType: string,
    selectedElementIds: string[],
    updateValue: (newValue: unknown) => void
): InputHTMLAttributes<HTMLInputElement> {
    const propertyKey = propertyPath.join('.')
    const inputKeys = selectedElementIds.map(elementId => `${elementId}:${propertyKey}`)

    const commitedValue = propertyState.state === 'same' ? String(propertyState.value) : ''
    let value = commitedValue

    const selectionDraftKey = inputKeys[0]!
    const selectionDraft = getDraft(selectionDraftKey)
    const selectionDraftExists = selectionDraft !== undefined

    if (selectionDraftExists) {
        value = selectionDraft
    }

    let placeholder: string | undefined

    if (propertyState.state === 'mixed') {
        placeholder = '--'
    }

    const disabled = propertyState.state === 'not-common'

    const readOnly = property === 'id' || property === 'type'

    return {
        type: 'text',
        value,
        placeholder: placeholder,
        disabled: disabled,
        readOnly: readOnly,
        onChange: event => {
            const inputValue = event.target.value
            const parsedInput = parseInputValue(inputValue, inputValueType)

            if (parsedInput.valid) {
                commitInputValue(parsedInput.value, inputKeys, updateValue)
                return
            }

            storeSelectionDraft(inputValue, inputKeys)
        }
    }
}