import type { RefObject } from 'react'

interface ViewportControllerRefs {
    zoomRef: RefObject<number>
    panRef: RefObject<{ x: number, y: number }>
}

interface ViewportControllerActions {
    setZoom: (z: number) => void
    setPan: (
        p:
            | { x: number, y: number }
            | ((prev: { x: number, y: number }) => { x: number, y: number })
    ) => void
}

export class ViewportController {
    private refs: ViewportControllerRefs
    private actions: ViewportControllerActions

    private isPanning = false
    private lastMousePos = { x: 0, y: 0 }

    constructor(
        refs: ViewportControllerRefs,
        actions: ViewportControllerActions
    ) {
        this.refs = refs
        this.actions = actions
    }

    onWheel(e: WheelEvent) {
        e.preventDefault()

        const factor = e.deltaY < 0 ? 1.1 : 0.9

        const newZoom = Math.max(
            0.05,
            Math.min(50, this.refs.zoomRef.current * factor)
        )

        const worldX = (e.offsetX - this.refs.panRef.current.x) / this.refs.zoomRef.current
        const worldY = (e.offsetY - this.refs.panRef.current.y) / this.refs.zoomRef.current

        this.actions.setZoom(newZoom)

        this.actions.setPan({
            x: e.offsetX - worldX * newZoom,
            y: e.offsetY - worldY * newZoom
        })
    }

    onMouseDown(e: MouseEvent) {
        console.log("start")
        e.preventDefault()
        this.isPanning = true

        this.lastMousePos = {
            x: e.clientX,
            y: e.clientY
        }
    }

    onMouseMove(e: MouseEvent) {
        if (!this.isPanning) return

        const dx = e.clientX - this.lastMousePos.x
        const dy = e.clientY - this.lastMousePos.y

        this.lastMousePos = {
            x: e.clientX,
            y: e.clientY
        }

        this.actions.setPan(prev => ({
            x: prev.x + dx,
            y: prev.y + dy
        }))
    }

    onMouseUp() {
        this.isPanning = false
    }
}