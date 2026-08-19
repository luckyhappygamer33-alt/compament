import type { RefObject } from 'react'

import type { ImageElement } from '../../../types/schema'
import type { CanvasContext } from '../CanvasTypes'
import type { Renderer } from '../Render/Renderer'
import type { ElementTool } from './ElementTool'

interface ImageToolRefs {
    rendererRef: RefObject<Renderer | null>
}

export class ImageTool implements ElementTool {
    readonly type = 'image'

    private refs: ImageToolRefs
    private images = new Map<string, HTMLImageElement>()

    constructor(refs: ImageToolRefs) {
        this.refs = refs
    }

    draw(
        ctx: CanvasContext,
        element: ImageElement
    ) {
        let image = this.images.get(element.src)

        if (!image) {
            image = new Image()

            image.onload = () => {
                this.refs.rendererRef.current?.requestFrame()
            }

            image.src = element.src
            this.images.set(element.src, image)

            return
        }

        if (!image.complete) return

        ctx.save()

        ctx.globalAlpha = element.style.opacity

        const centerX =
            element.position.x + element.size.width / 2

        const centerY =
            element.position.y + element.size.height / 2

        ctx.translate(centerX, centerY)
        ctx.rotate(element.rotation * Math.PI / 180)

        ctx.drawImage(
            image,
            -element.size.width / 2,
            -element.size.height / 2,
            element.size.width,
            element.size.height
        )

        ctx.restore()
    }

    onClick(e: MouseEvent): void {
        //empty, needed due to interface
    }
}