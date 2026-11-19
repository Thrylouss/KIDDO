/**
 * Smart Safety demo holati: bitta brauzerdagi barcha tablar (Super Admin, rahbar, tarbiyachi, ota-ona demo)
 * BroadcastChannel + localStorage orqali bir xil izolyatsiyalangan holatni ko'radi. Server'ga hech narsa yuborilmaydi.
 * Ssenariyni ishga tushirgan tab «yetakchi» — faqat u qadamlarni bajaradi; boshqalar holatni qabul qiladi.
 */
import { SCENARIOS, demoStartTime, initialState, reduce, resolveAction, stateBefore, type Action, type SafetyState } from "./engine";

export interface RunnerState { running: boolean; leader: string | null; scenario: number; step: number; full: boolean; guided: number; }
export interface Snapshot { state: SafetyState; runner: RunnerState; }

const KEY = "kiddo.smartSafety.demo.v2";
const CHANNEL = "kiddo-smart-safety";
export const STEP_MS = 1600;

const tabId = Math.random().toString(36).slice(2);
const SERVER: Snapshot = { state: initialState(demoStartTime(new Date(2026, 0, 1))), runner: { running: false, leader: null, scenario: 1, step: 0, full: true, guided: -1 } };

let snap: Snapshot | null = null;
let channel: BroadcastChannel | null = null;
let timer: ReturnType<typeof setInterval> | null = null;
let resolveNote = "";
const listeners = new Set<() => void>();

function init(): Snapshot {
  if (snap) return snap;
  snap = { state: initialState(), runner: { running: false, leader: null, scenario: 1, step: 0, full: true, guided: -1 } };
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const saved = JSON.parse(raw) as Snapshot;
      if (saved?.state?.children && saved?.state?.attendanceConfirmed && saved?.runner) snap = { state: saved.state, runner: { ...saved.runner, guided: saved.runner.guided ?? -1, running: false, leader: null } };
    }
  } catch { /* saqlangan holat buzilgan — yangidan */ }
  try {
    channel = new BroadcastChannel(CHANNEL);
    channel.onmessage = (e: MessageEvent<Snapshot>) => {
      const incoming = e.data;
      if (!incoming?.state || !snap) return;
      if (incoming.state.version >= snap.state.version || incoming.runner.leader !== snap.runner.leader) {
        snap = incoming;
        if (snap.runner.leader !== tabId) stopTimer();
        emit(false);
      }
    };
  } catch { /* BroadcastChannel yo'q (eski brauzer/test) — bitta tab rejimi */ }
  return snap;
}

function emit(broadcast = true) {
  if (!snap) return;
  try { localStorage.setItem(KEY, JSON.stringify(snap)); } catch { /* private rejim */ }
  if (broadcast) { try { channel?.postMessage(snap); } catch { /* e'tiborsiz */ } }
  listeners.forEach((l) => l());
}

export function subscribe(l: () => void): () => void {
  init();
  listeners.add(l);
  return () => { listeners.delete(l); };
}
export const getSnapshot = (): Snapshot => init();
export const getServerSnapshot = (): Snapshot => SERVER;

/** Ssenariydagi «resolve» qadami uchun tarjima qilingan izoh (joriy tilda). */
export function setResolveNote(note: string) { resolveNote = note; }

export function dispatch(action: Action) {
  const s = init();
  const next = reduce(s.state, action);
  if (next === s.state) return false;
  snap = { ...s, state: next };
  emit();
  return true;
}

function stopTimer() {
  if (timer) { clearInterval(timer); timer = null; }
}

function stepOnce() {
  const s = init();
  const sc = SCENARIOS.find((x) => x.id === s.runner.scenario);
  if (!sc) return pause();
  const step = sc.steps[s.runner.step];
  if (!step) {
    if (s.runner.full && sc.id < SCENARIOS.length) { snap = { ...s, runner: { ...s.runner, scenario: sc.id + 1, step: 0 } }; emit(); return; }
    return pause();
  }
  const state = step.reduce((st, a) => reduce(st, resolveAction(st, a, resolveNote)), s.state);
  snap = { state, runner: { ...s.runner, step: s.runner.step + 1 } };
  emit();
}

/** Start Demo: to'liq ssenariy (1→17) joriy nuqtadan davom etadi. Bitta ssenariy: undan oldingi holat tayyorlanib, faqat u o'ynaladi. */
export function start(scenario: number | null) {
  const s = init();
  stopTimer();
  if (scenario === null) {
    snap = { ...s, runner: { ...s.runner, running: true, leader: tabId, full: true } };
  } else {
    snap = { state: { ...stateBefore(scenario, resolveNote), version: s.state.version + 1 }, runner: { running: true, leader: tabId, scenario, step: 0, full: false, guided: -1 } };
  }
  emit();
  timer = setInterval(stepOnce, STEP_MS);
}

export function pause() {
  stopTimer();
  const s = init();
  snap = { ...s, runner: { ...s.runner, running: false, leader: null } };
  emit();
}

export function reset() {
  stopTimer();
  const s = init();
  snap = { state: { ...initialState(), version: s.state.version + 1 }, runner: { running: false, leader: null, scenario: 1, step: 0, full: true, guided: -1 } };
  emit();
}

/** Boshqariladigan taqdimot: tayyor holatni o'rnatadi (avtomatik o'ynatish to'xtaydi). */
export function loadGuided(state: SafetyState, guided: number) {
  stopTimer();
  const s = init();
  snap = { state: { ...state, version: s.state.version + 1 }, runner: { ...s.runner, running: false, leader: null, guided } };
  emit();
}

/** Testlar uchun: modul holatini tozalash. */
export function __resetForTests() {
  stopTimer();
  snap = null;
  try { channel?.close(); } catch { /* e'tiborsiz */ }
  channel = null;
  listeners.clear();
}
