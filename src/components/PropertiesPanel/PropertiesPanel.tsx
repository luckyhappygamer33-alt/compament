import './PropertiesPanel.css'
import { useEditorStore } from '../../store/editorStore'
import type { Element } from '../../types/schema'
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
    const selectedElementId = useEditorStore(state => state.selectedElementId)
    const selectedElementIds = useEditorStore(state => state.selectedElementIds)
    const deleteElement = useEditorStore(state => state.deleteElement)
    const setSelectedElement = useEditorStore(state => state.setSelectedElement)

    const selectedElementIdsSet = new Set(selectedElementIds)

    const selectedElements = layers.flatMap(layer =>
        layer.elements.filter(element =>
            selectedElementIdsSet.has(element.id)
        )
    )

    const masterPropertiesObject = buildMasterPropertiesObject(selectedElements)
    const propertyStates = resolvePropertyStates(selectedElements, masterPropertiesObject)

    console.log('propertyStates:', propertyStates)

    // Find the selected element and the layer containing it.
    let selectedElement: Element | null = null
    let selectedLayerId: string | null = null

    if (selectedElementId) {
        for (const layer of layers) {
            const element = layer.elements.find(
                element => element.id === selectedElementId
            )

            if (element) {
                selectedElement = element
                selectedLayerId = layer.id
                break
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
                                        if (!selectedElement || !selectedLayerId) return
                                        deleteElement(selectedLayerId, selectedElement.id)
                                        setSelectedElement(null)
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
