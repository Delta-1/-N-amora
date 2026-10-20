let context: AudioContext | null = null;
export function soundEnabled() { try {
    return localStorage.getItem('namora.sounds.v1') === 'on';
}
catch {
    return false;
} }
export function playSound(kind: 'tab' | 'success' | 'reminder' | 'heart' = 'tab') {
    if (!soundEnabled())
        return;
    try {
        context ||= new AudioContext();
        if (context.state === 'suspended')
            void context.resume();
        const now = context.currentTime;
        const notes = kind === 'success' ? [523.25, 659.25, 783.99] : kind === 'reminder' ? [659.25, 523.25, 659.25] : kind === 'heart' ? [392, 523.25] : [520];
        notes.forEach((f, i) => { const osc = context!.createOscillator(); const gain = context!.createGain(); osc.type = 'sine'; osc.frequency.value = f; const t = now + i * .075; gain.gain.setValueAtTime(0, t); gain.gain.linearRampToValueAtTime(.035, t + .012); gain.gain.exponentialRampToValueAtTime(.001, t + .18); osc.connect(gain); gain.connect(context!.destination); osc.start(t); osc.stop(t + .19); });
    }
    catch { }
}
