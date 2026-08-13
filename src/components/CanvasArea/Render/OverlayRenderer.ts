const FPS_MAX = 80

export class OverlayRenderer {
    private canvas: HTMLCanvasElement
    private ctx: CanvasRenderingContext2D
    private rafId: number | null = null
    private frameTimes: number[] = []
    private fps = 0

    constructor(canvas: HTMLCanvasElement) {
        this.canvas = canvas
        const ctx = canvas.getContext('2d')
        if (!ctx) throw new Error('Overlay 2D context not available')
        this.ctx = ctx
        this.startLoop()
    }

    private startLoop() {
        const tick = () => {
            const now = performance.now()
            while (this.frameTimes.length > 0 && now - this.frameTimes[0] > 1000) {
                this.frameTimes.shift()
            }
            this.fps = this.frameTimes.length
            this.draw()
            this.rafId = requestAnimationFrame(tick)
        }
        this.rafId = requestAnimationFrame(tick)
    }

    private getColor(fps: number): string {
        const clamped = Math.min(fps / FPS_MAX, 1)
        const hue = Math.round(clamped * 120)
        return `hsl(${hue}, 100%, 55%)`
    }

    private draw() {
        const { ctx, canvas, fps } = this
        ctx.clearRect(0, 0, canvas.width, canvas.height)
        ctx.fillStyle = 'rgba(0, 0, 0, 0.45)'
        ctx.fillRect(6, 6, 58, 20)
        ctx.fillStyle = this.getColor(fps)
        ctx.font = '11px monospace'
        ctx.fillText(fps === 0 ? 'idle' : `${fps}FPS`, 10, 20)
    }

    resize(width: number, height: number) {
        this.canvas.width = width
        this.canvas.height = height
        this.draw()
    }

    destroy() {
        if (this.rafId !== null) {
            cancelAnimationFrame(this.rafId)
            this.rafId = null
        }
    }

    recordFrame() {
        this.frameTimes.push(performance.now())
    }
}