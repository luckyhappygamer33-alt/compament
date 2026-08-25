import type { Element } from '../../types/schema'
import { type PropertyBranch, type MasterPropertiesObject, isObject } from './MasterPropertiesObjectBuilder'

export type PropertyState<T> =
    | {
        state: 'same'
        value: T
    }
    | { state: 'mixed' }
    | { state: 'not-common' }

type PropertiesOfElementsUnion<T> = T extends unknown ? keyof T : never

type PropertyValueType<T, K extends PropertyKey> =
    T extends unknown ? K extends keyof T ? T[K] : never : never

type DerivePropertiesState<T> =
    [NonNullable<T>] extends [object]
    ? {
        [K in PropertiesOfElementsUnion<NonNullable<T>>]:
        DerivePropertiesState<PropertyValueType<NonNullable<T>, K>>
    }
    : PropertyState<T>

export type PropertiesState = DerivePropertiesState<Element>

function resolvePropertyState<T>(
    values: T[],
    selectedElementsCount: number
): PropertyState<T> {
    if (values.length < selectedElementsCount) {
        return {
            state: 'not-common'
        }
    }

    const firstValue = values[0]
    const allValuesAreSame = values.every(values => Object.is(values, firstValue))

    if (!allValuesAreSame) {
        return {
            state: 'mixed'
        }
    }

    return {
        state: 'same',
        value: firstValue
    }

}

function resolvePropertiesLevel(
    values: unknown[],
    masterLevel: PropertyBranch
): Record<string, unknown> {
    const objects = values.filter(isObject)
    const resolvedLevel: Record<string, unknown> = {}

    for (const [property, node] of Object.entries(masterLevel)) {
        const values: unknown[] = []

        for (const object of objects) {
            if (Object.prototype.hasOwnProperty.call(object, property)) {
                values.push(object[property])
            }
        }

        if (node === null) {
            resolvedLevel[property] = resolvePropertyState(values, objects.length)
            continue
        }

        const childObjects = values.filter(isObject)

        resolvedLevel[property] = resolvePropertiesLevel(childObjects, node)
    }

    return resolvedLevel
}

export function resolvePropertyStates(
    elements: Element[],
    masterProperties: MasterPropertiesObject
): PropertiesState {
    return resolvePropertiesLevel(elements, masterProperties) as PropertiesState
}