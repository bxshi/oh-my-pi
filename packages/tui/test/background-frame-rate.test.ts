import { afterEach, describe, expect, it } from "bun:test";
import { type Component, type RenderTimer, TUI } from "@oh-my-pi/pi-tui";
import { setBackgroundFrameRate } from "@oh-my-pi/pi-tui/render-pacing";
import { VirtualTerminal } from "./virtual-terminal";

class Probe implements Component {
	invalidate(): void {}

	render(_width: number): readonly string[] {
		return ["probe"];
	}

	handleInput(_data: string): void {}
}

class RecordingScheduler {
	nowMs = 0;
	readonly immediates: Array<() => void> = [];
	readonly timers: Array<{ callback: () => void; delayMs: number; canceled: boolean }> = [];

	now(): number {
		return this.nowMs;
	}

	scheduleImmediate(callback: () => void): void {
		this.immediates.push(callback);
	}

	scheduleRender(callback: () => void, delayMs: number): RenderTimer {
		const timer = { callback, delayMs, canceled: false };
		this.timers.push(timer);
		return {
			cancel: () => {
				timer.canceled = true;
			},
		};
	}

	drainImmediates(): void {
		for (const immediate of this.immediates.splice(0)) immediate();
	}

	pendingTimers(): Array<{ callback: () => void; delayMs: number; canceled: boolean }> {
		return this.timers.filter(t => !t.canceled);
	}
}

function startedTui(scheduler: RecordingScheduler): { tui: TUI; term: VirtualTerminal } {
	const term = new VirtualTerminal(20, 4);
	const tui = new TUI(term, undefined, { renderScheduler: scheduler });
	const probe = new Probe();
	tui.addChild(probe);
	tui.setFocus(probe);
	tui.start();
	tui.renderNow();
	scheduler.drainImmediates();
	for (const timer of scheduler.timers.splice(0)) timer.canceled = true;
	return { tui, term };
}

describe("background frame rate", () => {
	afterEach(() => {
		setBackgroundFrameRate(30);
	});

	it("spaces background renders by the configured frame rate", () => {
		setBackgroundFrameRate(2);
		const scheduler = new RecordingScheduler();
		const { tui } = startedTui(scheduler);
		try {
			scheduler.nowMs = 100;
			tui.requestRender();
			scheduler.drainImmediates();
			const [timer] = scheduler.pendingTimers();
			expect(timer?.delayMs).toBe(400);
		} finally {
			tui.stop();
		}
	});

	it("pulls a pending background render forward when a key arrives", () => {
		setBackgroundFrameRate(2);
		const scheduler = new RecordingScheduler();
		const { tui, term } = startedTui(scheduler);
		try {
			scheduler.nowMs = 100;
			tui.requestRender();
			scheduler.drainImmediates();
			const [background] = scheduler.pendingTimers();
			expect(background?.delayMs).toBe(400);

			term.sendInput("x");
			scheduler.drainImmediates();
			expect(background?.canceled).toBe(true);
			const [expedited] = scheduler.pendingTimers();
			expect(expedited?.delayMs).toBeLessThanOrEqual(1000 / 30);
		} finally {
			tui.stop();
		}
	});
});
