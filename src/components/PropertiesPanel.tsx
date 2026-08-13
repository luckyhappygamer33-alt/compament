import './PropertiesPanel.css'
import { useEditorStore } from '../store/editorStore'
import type { Color, Element } from '../types/schema'

function colorToHex(color: Color): string {
    const toHex = (value: number) =>
        Math.max(0, Math.min(255, Math.round(value)))
            .toString(16)
            .padStart(2, '0')

    return `#${toHex(color.r)}${toHex(color.g)}${toHex(color.b)}`
}

function hexToColor(hex: string, alpha = 1): Color {
    const value = hex.replace('#', '')

    return {
        r: parseInt(value.slice(0, 2), 16),
        g: parseInt(value.slice(2, 4), 16),
        b: parseInt(value.slice(4, 6), 16),
        a: alpha,
    }
}

export default function PropertiesPanel() {
    const layers = useEditorStore(state => state.layers)
    const selectedElementId = useEditorStore(
        state => state.selectedElementId
    )
    const updateElement = useEditorStore(state => state.updateElement)

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

    const update = (changes: Partial<Element>) => {
        if (!selectedElement || !selectedLayerId) return

        updateElement(
            selectedLayerId,
            selectedElement.id,
            changes
        )
    }

    const updatePosition = (axis: 'x' | 'y', value: number) => {
        if (!selectedElement) return

        update({
            position: {
                ...selectedElement.position,
                [axis]: value,
            },
        })
    }

    const updateSize = (
        dimension: 'width' | 'height',
        value: number
    ) => {
        if (!selectedElement) return

        update({
            size: {
                ...selectedElement.size,
                [dimension]: value,
            },
        })
    }

    const updateOpacity = (value: number) => {
        if (!selectedElement) return

        update({
            style: {
                ...selectedElement.style,
                opacity: value,
            },
        })
    }

    const updateFillColor = (color: Color) => {
        if (!selectedElement) return

        update({
            style: {
                ...selectedElement.style,
                fill: {
                    type: 'solid',
                    color,
                },
            },
        })
    }

    return (
        <div className="properties-panel">
            <div className="panel-header">Properties</div>

            <div className="panel-body">
                {!selectedElement ? (
                    <span className="panel-empty">
                        No element selected
                    </span>
                ) : (
                    <div className="property-groups">

                        {/* Position */}
                        <section className="property-group">
                            <div className="property-group-title">
                                Transform
                            </div>

                            <div className="property-row">
                                <label>X</label>
                                <input
                                    type="number"
                                    value={selectedElement.position.x}
                                    onChange={event =>
                                        updatePosition(
                                            'x',
                                            Number(event.target.value)
                                        )
                                    }
                                />

                                <label>Y</label>
                                <input
                                    type="number"
                                    value={selectedElement.position.y}
                                    onChange={event =>
                                        updatePosition(
                                            'y',
                                            Number(event.target.value)
                                        )
                                    }
                                />
                            </div>

                            <div className="property-row">
                                <label>W</label>
                                <input
                                    type="number"
                                    min="0"
                                    value={selectedElement.size.width}
                                    onChange={event =>
                                        updateSize(
                                            'width',
                                            Number(event.target.value)
                                        )
                                    }
                                />

                                <label>H</label>
                                <input
                                    type="number"
                                    min="0"
                                    value={selectedElement.size.height}
                                    onChange={event =>
                                        updateSize(
                                            'height',
                                            Number(event.target.value)
                                        )
                                    }
                                />
                            </div>

                            <div className="property-row property-row-single">
                                <label>Rotation</label>
                                <input
                                    type="number"
                                    value={selectedElement.rotation}
                                    onChange={event =>
                                        update({
                                            rotation: Number(
                                                event.target.value
                                            ),
                                        })
                                    }
                                />
                                <span className="property-unit">°</span>
                            </div>
                        </section>

                        {/* Appearance */}
                        <section className="property-group">
                            <div className="property-group-title">
                                Appearance
                            </div>

                            <div className="property-row property-row-single">
                                <label>Opacity</label>

                                <input
                                    type="number"
                                    min="0"
                                    max="1"
                                    step="0.01"
                                    value={selectedElement.style.opacity}
                                    onChange={event =>
                                        updateOpacity(
                                            Math.max(
                                                0,
                                                Math.min(
                                                    1,
                                                    Number(
                                                        event.target.value
                                                    )
                                                )
                                            )
                                        )
                                    }
                                />
                            </div>

                            <div className="property-row property-row-single">
                                <label>Fill</label>

                                {selectedElement.style.fill?.type ===
                                    'solid' ? (
                                    <div className="color-control">
                                        <input
                                            className="color-input"
                                            type="color"
                                            value={colorToHex(
                                                selectedElement.style.fill.color
                                            )}
                                            onChange={event =>
                                                updateFillColor(
                                                    hexToColor(
                                                        event.target.value,
                                                        selectedElement.style
                                                            .fill?.type ===
                                                            'solid'
                                                            ? selectedElement
                                                                .style.fill
                                                                .color.a
                                                            : 1
                                                    )
                                                )
                                            }
                                        />

                                        <span>
                                            {colorToHex(
                                                selectedElement.style.fill.color
                                            )}
                                        </span>
                                    </div>
                                ) : (
                                    <span className="property-value">
                                        {selectedElement.style.fill?.type ===
                                            'gradient'
                                            ? 'Gradient'
                                            : 'None'}
                                    </span>
                                )}
                            </div>
                        </section>

                        {/* Element-specific properties */}
                        {selectedElement.type === 'rectangle' && (
                            <section className="property-group">
                                <div className="property-group-title">
                                    Rectangle
                                </div>

                                <div className="property-row property-row-single">
                                    <label>Radius</label>

                                    <input
                                        type="number"
                                        min="0"
                                        value={selectedElement.cornerRadius}
                                        onChange={event =>
                                            update({
                                                cornerRadius: Number(
                                                    event.target.value
                                                ),
                                            })
                                        }
                                    />
                                </div>
                            </section>
                        )}
                    </div>
                )}
            </div>
        </div>
    )
}
