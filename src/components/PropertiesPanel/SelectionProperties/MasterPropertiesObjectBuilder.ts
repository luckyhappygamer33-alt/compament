import type { Element } from '../../../types/schema'

export type PropertyLeaf = string

type PropertyNode =
    | PropertyLeaf
    | PropertyBranch

export type PropertyBranch = { [property: string]: PropertyNode }

export type MasterPropertiesObject = PropertyBranch

export function isObject(
    value: unknown
): value is Record<string, unknown> {
    return (
        typeof value === 'object' &&
        value !== null &&
        !Array.isArray(value)
    )
}

function buildPropertiesLevel(
    values: unknown[]
): PropertyBranch {
    const level: PropertyBranch = {}

    const objects = values.filter(isObject)
    const properties = new Set<string>()

    for (const object of objects) {
        for (const property of Object.keys(object)) {
            properties.add(property)
        }
    }

    for (const property of properties) {
        const values: unknown[] = []

        for (const object of objects) {
            values.push(object[property])
        }

        const nonNullableValues = values.filter(value =>
            value !== null && value !== undefined
        )

        const objectValues = nonNullableValues.filter(isObject)

        const allValuesAreObjects = nonNullableValues.length > 0 && objectValues.length === nonNullableValues.length

        if (allValuesAreObjects) {
            level[property] = buildPropertiesLevel(objectValues)
        } else {
            level[property] = typeof nonNullableValues[0]
        }
    }

    return level
}

export function buildMasterPropertiesObject(
    elements: Element[]
): MasterPropertiesObject {
    return buildPropertiesLevel(elements)
}

