import './PropertiesPanel.css'
import { useEditorStore } from '../../store/editorStore'
import { buildMasterPropertiesObject } from './MasterPropertiesObjectBuilder'
import { resolvePropertyStates, type PropertyState } from './PropertyStatesResolver'

function addProperty(
    property: string,
    propertyState: PropertyState<unknown>
) {
    const value = propertyState.state === 'same' ? String(propertyState.value) : ''

    const placeholder = propertyState.state === 'mixed' ? '--' : undefined


    const disabled = propertyState.state === 'not-common'

    return (
        <div
            className='property-row property-row-single'
            key={property}
        >
            <label>{property}</label>
            <input
                type="text"
                value={value}
                placeholder={placeholder}
                disabled={disabled}
                readOnly
            />
        </div>
    )
}

function addPropertiesLevel(
    propertiesLevel: Record<string, unknown>
) {
    return Object.entries(propertiesLevel).map(
        ([property, value]) => {
            if (typeof value !== 'object' || value == null) return null
            if ('state' in value) {
                return addProperty(property, value as PropertyState<unknown>)
            }

            return (
                <div key={property}>
                    <div className='property-group-title'>{property}</div>
                    {addPropertiesLevel(value as Record<string, unknown>)}

                </div>
            )

        })
}

export default function PropertiesPanel({ onBake }: { onBake: () => void }) {
    const layers = useEditorStore(state => state.layers)
    const selectedElementIds = useEditorStore(state => state.selectedElementIds)
    const deleteElement = useEditorStore(state => state.deleteElement)
    const setSelectedElements = useEditorStore(state => state.setSelectedElements)

    const selectedElements = layers.flatMap(layer =>
        layer.elements.filter(element =>
            selectedElementIds.includes(element.id)
        )
    )

    const masterPropertiesObject = buildMasterPropertiesObject(selectedElements)
    const propertyStates = resolvePropertyStates(selectedElements, masterPropertiesObject)

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
                        {addPropertiesLevel(propertyStates)}

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
