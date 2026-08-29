import type { InputHTMLAttributes } from 'react'
import type { PropertyState } from './SelectionProperties/SelectionPropertyStatesResolver'
import { notifyDraftChange } from './PropertyInputDraftStore'

type ParsedInput =
    | {
        valid: true,
        value: unknown
    }
    | {
        valid: false
    }

const inputDrafts = new Map<string, string>()

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

export function clearPropertyInputDrafts() {
    if (inputDrafts.size === 0) return

    inputDrafts.clear()
    notifyDraftChange()

}

export function getPropertyInputProps(
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

    const draftValues = inputKeys.map(inputKey => inputDrafts.get(inputKey))
    const firstDraftValue = draftValues[0]
    const allElementsHaveSameDraft = firstDraftValue !== undefined &&
        draftValues.every(draftValue => draftValue === firstDraftValue)

    const value = allElementsHaveSameDraft ? firstDraftValue : commitedValue

    return {
        type: 'text',
        value,
        placeholder: propertyState.state === 'mixed' ? '--' : undefined,
        disabled: propertyState.state === 'not-common',
        readOnly: property === 'id' || property === 'type',
        onChange: event => {
            const inputValue = event.target.value

            const parsedInput = parseInputValue(inputValue, inputValueType)

            if (parsedInput.valid) {
                for (const inputKey of inputKeys) {
                    inputDrafts.delete(inputKey)
                }

                updateValue(parsedInput.value)
                notifyDraftChange()

                return
            }

            for (const inputKey of inputKeys) {
                inputDrafts.set(inputKey, inputValue)
            }

            notifyDraftChange()
        }
    }
}