import type { RefObject } from 'react'

import type { Layer, Element } from '../../../types/schema'
import type { HandleName } from '../CanvasTypes'

import type { Renderer } from '../Render/Renderer'
import { SelectionRenderer } from '../Render/SelectionRenderer'

import {
    toLocalSpace,
    getHandlePositions,
    getRotateHandlePosition,
    hitTest,
    rotatePoint,
    computeResize,
    normalizeDegrees
} from '../CanvasHelpers'

import type { InteractionTool } from "./InteractionTool";

interface SelectToolRefs {
    zoomRef: RefObject<number>
    panRef: RefObject<{ x: number; y: number }>
    activeLayerIdRef: RefObject<string | null>
    layersRef: RefObject<Layer[]>
    selectedElementIdRef: RefObject<string | null>
    selectedElementIdsRef: RefObject<string[]>
    hoveredHandleRef: RefObject<HandleName | null>
    rendererRef: RefObject<Renderer | null>
}

interface SelectToolActions {
    updateElement: (
        layerId: string,
        elementId: string,
        patch: Partial<Element>
    ) => void

    setSelectedElement: (id: string | null) => void
    setSelectedElements: (ids: string[]) => void
}

interface DragStartPositions {
    layerId: string,
    x: number,
    y: number
}

const HANDLE_SIZE = 10
const SELECTION_PADDING = 10

export class SelectTool implements InteractionTool {
    readonly type = 'select'

    private canvas: HTMLCanvasElement
    private refs: SelectToolRefs
    private actions: SelectToolActions

    private isDragging = false
    private isResizing = false
    private isRotating = false
    private didDrag = false

    private activeHandle: HandleName | null = null
    private hoveredHandle: HandleName | null = null

    private dragStartMouse = { x: 0, y: 0 }
    private dragStartPositions = new Map<string, DragStartPositions>()

    private resizeStartMouse = { x: 0, y: 0 }
    private resizeStartBounds = {
        x: 0,
        y: 0,
        width: 0,
        height: 0,
    }

    private rotateStartAngle = 0
    private rotateStartElementAngle = 0

    constructor(
        canvas: HTMLCanvasElement,
        refs: SelectToolRefs,
        actions: SelectToolActions
    ) {
        this.canvas = canvas
        this.refs = refs
        this.actions = actions
    }

    onMouseDown(e: MouseEvent): void {
        this.beginPointerInteraction(e)
    }

    onMouseMove(e: MouseEvent) {
        this.updatePointerInteraction(e)
    }

    onMouseUp(_e: MouseEvent) {
        this.endPointerInteraction()
    }

    onClick(e: MouseEvent) {
        if (this.didDrag) {
            this.didDrag = false
            return
        }

        this.handleSelectClick(e)
    }

    draw(
        ctx: CanvasRenderingContext2D,
        layers: Layer[],
        zoom: number,
        selectionRenderer: SelectionRenderer
    ) {
        const selectedIds = this.refs.selectedElementIdsRef.current
        if (selectedIds.length === 0) return

        const selectedSet = new Set(selectedIds)
        const isSingle = selectedIds.length === 1
        const hoveredHandle = this.refs.hoveredHandleRef.current


        for (const layer of layers) {
            for (const element of layer.elements) {
                if (!selectedSet.has(element.id)) continue

                selectionRenderer.drawSelection(
                    ctx,
                    {
                        x: element.position.x,
                        y: element.position.y,
                        width: element.size.width,
                        height: element.size.height
                    },
                    zoom,
                    {
                        style: 'solid',
                        color: '#7bb4f1',
                        lineWidth: 2,
                        padding: SELECTION_PADDING,
                        rotation: element.rotation,
                        handles: isSingle,
                        rotateHandle: isSingle,
                        hoveredHandle
                    }
                )

            }
        }
    }

    private beginPointerInteraction(
        e: MouseEvent
    ) {
        this.didDrag = false

        const mousePosition = this.getWorldPosition(e)
        const selectedIds = this.refs.selectedElementIdsRef.current

        if (selectedIds.length === 0) return

        if (selectedIds.length > 1) {
            this.beginMultiSelectionInteraction(mousePosition, selectedIds)
        } else {
            this.beginSingleSelectionInteraction(mousePosition, selectedIds[0])
        }
    }

    private beginMultiSelectionInteraction(
        mousePosition: { x: number; y: number },
        selectedIds: string[]
    ) {
        this.tryStartDrag(mousePosition, selectedIds)
    }

    private beginSingleSelectionInteraction(
        mousePosition: { x: number, y: number },
        selectedId: string
    ) {

        this.tryStartRotate(mousePosition, selectedId)
        this.tryStartResize(mousePosition, selectedId)
        this.tryStartDrag(mousePosition, [selectedId])
    }

    private tryStartRotate(
        mousePosition: { x: number, y: number },
        selectedId: string
    ) {
        if (this.hasActivePointerInteraction()) return

        const element = this.findSelectedElement(selectedId)
        if (!element) return

        const zoom = this.refs.zoomRef.current

        const localMousePosition = toLocalSpace(mousePosition.x, mousePosition.y, element)
        const rotateHandlePosition = getRotateHandlePosition(element, SELECTION_PADDING, zoom)
        const handleHitSize = HANDLE_SIZE / zoom
        const rotateHandlePressed =
            localMousePosition.x >= rotateHandlePosition.x - handleHitSize / 2 &&
            localMousePosition.x <= rotateHandlePosition.x + handleHitSize / 2 &&
            localMousePosition.y >= rotateHandlePosition.y - handleHitSize / 2 &&
            localMousePosition.y <= rotateHandlePosition.y + handleHitSize / 2

        if (!rotateHandlePressed) return false
        this.startRotate(mousePosition, element)
    }

    private startRotate(
        mousePosition: { x: number, y: number },
        element: Element
    ) {
        this.isRotating = true
        const elementCenter = {
            x: element.position.x + element.size.width / 2,
            y: element.position.y + element.size.height / 2
        }

        this.rotateStartAngle = Math.atan2(mousePosition.y - elementCenter.y, mousePosition.x - elementCenter.x) * 180 / Math.PI
        this.rotateStartElementAngle = element.rotation
    }

    private tryStartResize(
        mousePosition: { x: number, y: number },
        selectedId: string
    ) {
        if (this.hasActivePointerInteraction()) return

        const element = this.findSelectedElement(selectedId)
        if (!element) return

        const zoom = this.refs.zoomRef.current

        const localMousePosition = toLocalSpace(mousePosition.x, mousePosition.y, element)
        const handleHitSize = HANDLE_SIZE / zoom
        const resizeHandles = getHandlePositions(element, SELECTION_PADDING)

        for (const handle of resizeHandles) {
            const handlePressed =
                localMousePosition.x >= handle.x - handleHitSize / 2 &&
                localMousePosition.x <= handle.x + handleHitSize / 2 &&
                localMousePosition.y >= handle.y - handleHitSize / 2 &&
                localMousePosition.y <= handle.y + handleHitSize / 2
            if (!handlePressed) continue

            this.startResize(mousePosition, element, handle.name)

            return
        }
    }

    private startResize(
        mousePosition: { x: number; y: number },
        element: Element,
        handle: HandleName
    ) {
        this.isResizing = true
        this.activeHandle = handle

        this.resizeStartMouse = {
            x: mousePosition.x,
            y: mousePosition.y
        }

        this.resizeStartBounds = {
            x: element.position.x,
            y: element.position.y,
            width: element.size.width,
            height: element.size.height
        }
    }

    private tryStartDrag(
        mousePosition: { x: number, y: number },
        selectedIds: string[]
    ) {
        if (this.isRotating || this.isResizing) return
        const selectionPressed = this.pointHitsSelectedElements(
            mousePosition.x,
            mousePosition.y,
            selectedIds
        )

        if (!selectionPressed) return
        this.startDrag(mousePosition.x, mousePosition.y, selectedIds)
    }

    private pointHitsSelectedElements(
        x: number,
        y: number,
        selectedIds: string[]
    ) {
        const selectedSet = new Set(selectedIds)

        for (const layer of this.refs.layersRef.current) {
            if (!layer.visible || layer.locked) continue

            for (const element of layer.elements) {
                if (selectedSet.has(element.id) && hitTest(element, x, y)) {
                    return true
                }
            }
        }

        return false
    }

    private startDrag(
        worldX: number,
        worldY: number,
        selectedIds: string[]
    ) {
        this.isDragging = true

        this.dragStartMouse = {
            x: worldX,
            y: worldY
        }

        this.dragStartPositions.clear()

        const selectedSet = new Set(selectedIds)

        for (const layer of this.refs.layersRef.current) {
            if (layer.locked) continue

            for (const element of layer.elements) {
                if (!selectedSet.has(element.id)) continue

                this.dragStartPositions.set(
                    element.id,
                    {
                        layerId: layer.id,
                        x: element.position.x,
                        y: element.position.y
                    }
                )
            }
        }
    }


    private updatePointerInteraction(
        e: MouseEvent
    ) {
        this.detectHandleHover(e)

        if (this.isDragging) this.applyDrag(e)
        if (this.isResizing) this.applyResize(e)
        if (this.isRotating) this.applyRotate(e)
    }

    private detectHandleHover(e: MouseEvent) {
        const selectedIds = this.refs.selectedElementIdsRef.current

        //multi-select has no handles
        if (selectedIds.length !== 1 || this.isDragging) {
            this.clearHandlerHover()
            return
        }

        const selectedId = selectedIds[0]

        const worldX = (e.offsetX - this.refs.panRef.current.x) / this.refs.zoomRef.current
        const worldY = (e.offsetY - this.refs.panRef.current.y) / this.refs.zoomRef.current
        const handleHitSize = HANDLE_SIZE / this.refs.zoomRef.current

        let found: HandleName | null = null

        for (const layer of this.refs.layersRef.current) {
            const element = layer.elements.find(el => el.id === selectedId)

            if (!element) continue

            const local = toLocalSpace(worldX, worldY, element)

            for (const handle of getHandlePositions(element, SELECTION_PADDING)) {
                if (
                    local.x >= handle.x - handleHitSize / 2 &&
                    local.x <= handle.x + handleHitSize / 2 &&
                    local.y >= handle.y - handleHitSize / 2 &&
                    local.y <= handle.y + handleHitSize / 2
                ) {
                    found = handle.name
                    break
                }
            }

            const rotateHandle = getRotateHandlePosition(element, SELECTION_PADDING, this.refs.zoomRef.current)

            if (
                local.x >= rotateHandle.x - handleHitSize / 2 &&
                local.x <= rotateHandle.x + handleHitSize / 2 &&
                local.y >= rotateHandle.y - handleHitSize / 2 &&
                local.y <= rotateHandle.y + handleHitSize / 2
            ) {
                found = 'rotate'
            }

            break
        }

        if (found === this.hoveredHandle) return

        this.hoveredHandle = found
        this.refs.hoveredHandleRef.current = found

        this.canvas.style.cursor = found ? 'grab' : 'default'
        this.refs.rendererRef.current?.requestFrame()
    }

    private clearHandlerHover() {
        if (this.hoveredHandle === null) return

        this.hoveredHandle = null
        this.refs.hoveredHandleRef.current = null
        this.canvas.style.cursor = 'default'

        this.refs.rendererRef.current?.requestFrame()
    }

    private applyDrag(e: MouseEvent) {
        this.didDrag = true

        const { x: worldX, y: worldY } = this.getWorldPosition(e)

        const dx = worldX - this.dragStartMouse.x

        const dy = worldY - this.dragStartMouse.y


        for (const [elementId, start] of this.dragStartPositions) {

            this.actions.updateElement(
                start.layerId,
                elementId,
                {
                    position: {
                        x: start.x + dx,
                        y: start.y + dy
                    }
                }
            )
        }

        this.refs.rendererRef.current?.requestFrame()
    }

    private applyResize(e: MouseEvent) {
        this.didDrag = true

        if (!this.activeHandle) return

        const { x: worldX, y: worldY } = this.getWorldPosition(e)

        const dx = worldX - this.resizeStartMouse.x
        const dy = worldY - this.resizeStartMouse.y
        const selectedIds = this.refs.selectedElementIdsRef.current

        if (selectedIds.length !== 1) return
        const selectedId = selectedIds[0]

        for (const layer of this.refs.layersRef.current) {
            const element = layer.elements.find(el => el.id === selectedId)

            if (!element) continue

            const local = rotatePoint(dx, dy, element.rotation)
            const result = computeResize(this.activeHandle, this.resizeStartBounds, local, element.rotation, e.altKey)

            this.actions.updateElement(
                layer.id,
                selectedId,
                {
                    position: {
                        x: result.x,
                        y: result.y
                    },
                    size: {
                        width: result.width,
                        height: result.height
                    }
                }
            )

            return
        }
    }

    private applyRotate(e: MouseEvent) {
        this.didDrag = true

        const { x: worldX, y: worldY } = this.getWorldPosition(e)

        const selectedIds = this.refs.selectedElementIdsRef.current

        if (selectedIds.length !== 1) return
        const selectedId = selectedIds[0]

        for (const layer of this.refs.layersRef.current) {
            const element = layer.elements.find(el => el.id === selectedId)

            if (!element) continue

            const centerX = element.position.x + element.size.width / 2
            const centerY = element.position.y + element.size.height / 2
            const currentAngle = Math.atan2(worldY - centerY, worldX - centerX) * 180 / Math.PI
            const delta = currentAngle - this.rotateStartAngle

            this.actions.updateElement(
                layer.id,
                selectedId,
                {
                    rotation: normalizeDegrees(this.rotateStartElementAngle + delta)
                }
            )

            return
        }
    }

    private endPointerInteraction() {
        this.endDrag()
        this.endResize()
        this.endRotate()
    }

    private endDrag() {
        this.isDragging = false
        this.dragStartPositions.clear()
    }

    private endResize() {
        this.isResizing = false
        this.activeHandle = null
    }

    private endRotate() {
        this.isRotating = false
    }

    private handleSelectClick(e: MouseEvent) {
        const worldX = (e.offsetX - this.refs.panRef.current.x) / this.refs.zoomRef.current
        const worldY = (e.offsetY - this.refs.panRef.current.y) / this.refs.zoomRef.current

        const hits: string[] = []

        for (const layer of this.refs.layersRef.current) {
            if (!layer.visible || layer.locked) continue
            if (layer.id !== this.refs.activeLayerIdRef.current) continue

            for (let i = layer.elements.length - 1; i >= 0; i--) {
                const element = layer.elements[i]
                if (hitTest(element, worldX, worldY)
                ) {
                    hits.push(element.id)
                }
            }
        }

        const selectedIds = this.refs.selectedElementIdsRef.current

        //empty click
        if (hits.length === 0) {
            if (!e.shiftKey) this.actions.setSelectedElements([])
            return
        }

        //shift-click
        if (e.shiftKey) {
            const clickedId = hits[0]

            if (selectedIds.includes(clickedId)) {
                this.actions.setSelectedElements(selectedIds.filter(id => id !== clickedId))
            } else {
                this.actions.setSelectedElements([...selectedIds, clickedId])
            }
            return
        }

        //normal click
        if (hits.length === 1) {
            this.actions.setSelectedElements([hits[0]])
            return
        }

        //click-cycling (if single-select)
        if (selectedIds.length === 1) {
            const currentIndex = hits.indexOf(selectedIds[0])

            this.actions.setSelectedElements([hits[(currentIndex + 1) % hits.length]])

            return
        }

        this.actions.setSelectedElements([hits[0]])
    }

    //shared utility methods
    private getWorldPosition(e: MouseEvent) {
        const rect = this.canvas.getBoundingClientRect()

        return {
            x: (e.clientX - rect.left - this.refs.panRef.current.x) / this.refs.zoomRef.current,
            y: (e.clientY - rect.top - this.refs.panRef.current.y) / this.refs.zoomRef.current
        }
    }

    private findSelectedElement(
        selectedId: string
    ): Element | null {
        for (const layer of this.refs.layersRef.current) {
            if (layer.locked) continue

            const element = layer.elements.find(element => element.id === selectedId)
            if (element) return element
        }

        return null
    }

    private hasActivePointerInteraction() {
        return (this.isDragging || this.isResizing || this.isRotating)
    }
}