import { ColorPropertyWidget } from './ColorPropertyWidget'

export function getPropertyWidget(
    propertyPath: string[],
    propertyStates: object,
    updateProperty: (
        propertyPath: string[],
        newValue: unknown
    ) => void
) {
    const propertyKey = propertyPath.join('.')
    if (propertyKey === 'style.fill.color') {
        return (
            < ColorPropertyWidget
                propertyPath={propertyPath}
                propertyStates={propertyStates}
                updateProperty={updateProperty}
            />
        )
    }
    return null
}