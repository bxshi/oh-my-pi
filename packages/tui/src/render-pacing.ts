/** Default cadence for redraws that are not driven by user input (30 fps). */
const DEFAULT_BACKGROUND_FRAME_RATE = 30;

let backgroundRenderIntervalMs = 1000 / DEFAULT_BACKGROUND_FRAME_RATE;

/**
 * Cap the redraw rate of background updates: streaming output, spinners, and
 * other non-input repaints. Keyboard input still renders at the full cadence.
 * The host pushes its `display.backgroundFrameRate` preference here.
 */
export function setBackgroundFrameRate(fps: number): void {
	const clamped = Math.min(DEFAULT_BACKGROUND_FRAME_RATE, Math.max(1, fps));
	backgroundRenderIntervalMs = 1000 / clamped;
}

/** Minimum gap between background redraws, in milliseconds. */
export function getBackgroundRenderIntervalMs(): number {
	return backgroundRenderIntervalMs;
}
