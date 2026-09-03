import './ColorPropertyWidget.css'
import type * as SelectionProperties from '../SelectionProperties'

type ColorPropertyStates = {
    r: SelectionProperties.PropertyState<number>
    g: SelectionProperties.PropertyState<number>
    b: SelectionProperties.PropertyState<number>
    a: SelectionProperties.PropertyState<number>
}

type ColorPropertyWidgetProps = {
    propertyPath: string[],
    propertyStates: object
    updateProperty: (
        propertyPath: string[],
        newValue: unknown
    ) => void
}

function numberToHex(
    value: number
) {
    const clampedValue = Math.max(0, Math.min(255, value))

    return Math.round(clampedValue).toString(16).padStart(2, '0')
}

function getColorValue(
    propertyStates: ColorPropertyStates
) {
    if (
        propertyStates.r.state !== 'same' ||
        propertyStates.g.state !== 'same' ||
        propertyStates.b.state !== 'same'
    ) {
        return undefined
    }

    return (
        '#' +
        numberToHex(propertyStates.r.value) +
        numberToHex(propertyStates.g.value) +
        numberToHex(propertyStates.b.value)
    )
}

function getAlphaValue(
    propertyStates: ColorPropertyStates
) {
    if (propertyStates.a.state !== 'same') {
        return undefined
    }

    return propertyStates.a.value
}

function parseHexColor(
    value: string
) {
    return {
        r: parseInt(value.slice(1, 3), 16),
        g: parseInt(value.slice(3, 5), 16),
        b: parseInt(value.slice(5, 7), 16)
    }
}

export function ColorPropertyWidget({
    propertyPath,
    propertyStates,
    updateProperty
}: ColorPropertyWidgetProps) {
    const colorPropertyStates = propertyStates as ColorPropertyStates
    const colorValue = getColorValue(colorPropertyStates)
    const colorIsMixed = colorValue === undefined
    const alphaValue = getAlphaValue(colorPropertyStates)
    const alphaIsMixed = alphaValue === undefined

    return (
        <div className='property-row property-row-single'>
            <label>color</label>

            <div className='color-input-wrapper'>
                <input
                    type='color'
                    value={colorValue ?? '#000000'}
                    onChange={event => {
                        const color =
                            parseHexColor(event.target.value)

                        if (alphaValue === undefined) return

                        updateProperty(
                            propertyPath,
                            {
                                r: color.r,
                                g: color.g,
                                b: color.b,
                                a: alphaValue
                            }
                        )
                    }}
                />

                {colorIsMixed && (
                    <div className='color-input-mixed-overlay'></div>
                )}

            </div>

            <input
                type='number'
                min={0}
                max={1}
                value={alphaValue ?? ''}
                placeholder={alphaIsMixed ? '--' : undefined}
                onChange={event => {
                    if (colorValue === undefined) return

                    const color =
                        parseHexColor(colorValue)

                    const newAlpha =
                        Number(event.target.value)

                    updateProperty(
                        propertyPath,
                        {
                            r: color.r,
                            g: color.g,
                            b: color.b,
                            a: newAlpha
                        }
                    )
                }}
            />
        </div>
    )
}