import type { InputHTMLAttributes } from 'react'
import type { PropertyState } from './PropertyStatesResolver'

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

export function getPropertyInputProps(
    property: string,
    propertyPath: string[],
    propertyState: PropertyState<unknown>,
    inputValueType: string,
    updateValue: (newValue: unknown) => void
): InputHTMLAttributes<HTMLInputElement> {
    const inputKey = propertyPath.join('.')
    const commitedValue = propertyState.state === 'same' ? String(propertyState.value) : ''
    const value = inputDrafts.get(inputKey) ?? commitedValue

    return {
        type: 'text',
        value,
        placeholder: propertyState.state === 'mixed' ? '--' : undefined,
        disabled: propertyState.state === 'not-common',
        readOnly: property === 'id' || property === 'type',
        onChange: event => {
            const inputValue = event.target.value
            inputDrafts.set(inputKey, inputValue)

            const parsedInput = parseInputValue(inputValue, inputValueType)
            if (!parsedInput.valid) return

            updateValue(parsedInput.value)
        }
    }
}