/**
 * Brauzer ovozli signali (Web Audio). Brauzerlar ovozni faqat foydalanuvchi ruxsati (bosish) dan keyin beradi —
 * shuning uchun «Ovozni yoqish» tugmasi orqali yoqiladi; ruxsat bo'lmasa vizual signal (miltillovchi banner) ishlaydi.
 * Real o'rnatishda bu yagona signal emas: gateway/sirena orqali mustaqil mahalliy ovozli signal bo'lishi shart.
 */
let ctx: AudioContext | null = null;
let loop: ReturnType<typeof setInterval> | null = null;

export function enableSound(): boolean {
  try {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return false;
    ctx = ctx ?? new Ctor();
    void ctx.resume();
    return true;
  } catch {
    return false;
  }
}

function beep() {
  if (!ctx) return;
  const t = ctx.currentTime;
  [0, 0.28].forEach((offset, i) => {
    const osc = ctx!.createOscillator();
    const gain = ctx!.createGain();
    osc.type = "square";
    osc.frequency.value = i === 0 ? 880 : 660;
    gain.gain.setValueAtTime(0.0001, t + offset);
    gain.gain.exponentialRampToValueAtTime(0.18, t + offset + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + offset + 0.24);
    osc.connect(gain).connect(ctx!.destination);
    osc.start(t + offset);
    osc.stop(t + offset + 0.26);
  });
}

export function setAlarm(on: boolean) {
  if (on && !loop && ctx) {
    beep();
    loop = setInterval(beep, 1200);   // qabul qilinmaguncha takrorlanadi
  } else if (!on && loop) {
    clearInterval(loop);
    loop = null;
  }
}

export function soundAvailable(): boolean {
  return ctx !== null && ctx.state === "running";
}

/** Ovoz shu tab sessiyasida allaqachon yoqilganmi (bo'limlar o'rtasida o'tganda qayta so'ralmaydi). */
export function soundEnabled(): boolean {
  return ctx !== null;
}
