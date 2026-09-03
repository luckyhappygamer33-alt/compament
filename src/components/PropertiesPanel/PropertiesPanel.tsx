import './PropertiesPanel.css'
import { useEditorStore } from '../../store/editorStore'
import * as SelectionProperties from './SelectionProperties'
import * as PropertyInput from './PropertyInput'
import * as PropertyWidget from './PropertyWidget'

function updatePropertyAtPath<T extends object>(
    object: T,
    path: string[],
    newValue: unknown
): T {
    const [property, ...remainingPath] = path
    if (!property) return object

    if (remainingPath.length === 0) {
        return {
            ...object,
            [property]: newValue
        }
    }

    const currentValue = (object as Record<string, unknown>)[property]

    if (
        typeof currentValue !== 'object' ||
        currentValue === null ||
        Array.isArray(currentValue)
    ) {
        return object
    }

    return {
        ...object,
        [property]: updatePropertyAtPath(
            currentValue,
            remainingPath,
            newValue
        )
    }
}

export default function PropertiesPanel({ onBake }: { onBake: () => void }) {

    const layers = useEditorStore(state => state.layers)
    const selectedElementIds = useEditorStore(state => state.selectedElementIds)
    const deleteElement = useEditorStore(state => state.deleteElement)
    const setSelectedElements = useEditorStore(state => state.setSelectedElements)
    const updateElement = useEditorStore(state => state.updateElement)

    const selectedElements = layers.flatMap(layer =>
        layer.elements.filter(element =>
            selectedElementIds.includes(element.id)
        )
    )

    const masterPropertiesObject = SelectionProperties.buildMasterPropertiesObject(selectedElements)
    const resolvedPropertyStates = SelectionProperties.resolveSelectionPropertyStates(selectedElements, masterPropertiesObject)

    PropertyInput.useSelectionDraftSync(selectedElementIds, resolvedPropertyStates)

    function addProperty(
        property: string,
        propertyState: SelectionProperties.PropertyState<unknown>,
        propertyPath: string[],
        inputValueType: string
    ) {
        return (
            <div
                className='property-row property-row-single'
                key={property}
            >
                <label>{property}</label>
                <input
                    {...PropertyInput.getPropertyInput(
                        property,
                        propertyPath,
                        propertyState,
                        inputValueType,
                        selectedElementIds,
                        newValue => {
                            updateProperty(propertyPath, newValue)
                        }
                    )}
                />
            </div>
        )
    }

    function addPropertiesLevel(
        propertiesStatesLevel: Record<string, unknown>,
        currentPath: string[],
        masterLevel: SelectionProperties.PropertyBranch,
    ) {
        return Object.entries(propertiesStatesLevel).map(
            ([property, value]) => {
                if (typeof value !== 'object' || value == null) return null

                const node = masterLevel[property]
                if (!node) return null

                const propertyPath = [...currentPath, property]

                const propertyWidget = PropertyWidget.getPropertyWidget(propertyPath, value, updateProperty)

                if (propertyWidget) {
                    return (
                        <div key={property}>
                            {propertyWidget}
                        </div>
                    )
                }

                if (propertyPath.join('.') === 'style.opacity') return null //hide alpha from color)

                if (typeof node === 'string') {
                    return addProperty(property, value as SelectionProperties.PropertyState<unknown>, propertyPath, node)
                }

                const propertyStatesLevel = value as Record<string, unknown>
                return (
                    <div key={property}>
                        <div className='property-group-title'>{property}</div>
                        {addPropertiesLevel(propertyStatesLevel, propertyPath, node)}

                    </div>
                )

            })
    }

    function addProperties() {
        const propertyStatesTopLevel = resolvedPropertyStates
        return addPropertiesLevel(propertyStatesTopLevel, [], masterPropertiesObject)
    }

    function updateProperty(
        propertyPath: string[],
        newValue: unknown
    ) {
        for (const layer of layers) {
            for (const element of layer.elements) {
                if (!selectedElementIds.includes(element.id)) continue

                const updatedElement = updatePropertyAtPath(element, propertyPath, newValue)

                updateElement(layer.id, element.id, updatedElement)
            }
        }
    }

    return (
        <div className='properties-panel'>
            <div className='panel-header'>
                Properties
            </div>

            <div className='panel-body'>
                {selectedElements.length === 0 ? (
                    <span className='panel-empty'>
                        No elements selected
                    </span>
                ) : (
                    <div className='property-groups'>
                        {addProperties()}

                        <section className='property-group'>
                            <div className='property-group-title'>
                                Element Actions
                            </div>

                            <div className='element-actions'>
                                <button
                                    type='button'
                                    className='element-action-button'
                                    onClick={onBake}
                                >
                                    Bake
                                </button>
                                <button
                                    type='button'
                                    className='element-action-button'
                                    onClick={() => {
                                        for (const layer of layers) {
                                            for (const element of layer.elements) {
                                                if (selectedElementIds.includes(element.id)) {
                                                    deleteElement(layer.id, element.id)
                                                }
                                            }
                                        }
                                        setSelectedElements([])
                                    }}
                                >
                                    Delete
                                </button>
                            </div>
                        </section>
                    </div>
                )}
            </div>
        </div>
    )
}
