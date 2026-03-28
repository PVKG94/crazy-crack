export function playSoundEffect(type = 'pop') {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();
    
    // Check volume (fallback to 0.5 default instead of deafening 1)
    let vol = 0.5;
    if (window.crazyCrackVolume !== undefined) {
      vol = window.crazyCrackVolume;
    } else {
      const savedVol = localStorage.getItem('crazy_crack_volume');
      if (savedVol !== null) vol = parseFloat(savedVol);
    }
    
    // Safety clamp
    vol = Math.max(0, Math.min(1, vol));

    osc.connect(gainNode);
    gainNode.connect(ctx.destination);
    
    if (type === 'pop') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(800, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(300, ctx.currentTime + 0.1);
      gainNode.gain.setValueAtTime(vol, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.1);
    } else if (type === 'burn') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(150, ctx.currentTime);
      osc.frequency.linearRampToValueAtTime(50, ctx.currentTime + 0.3);
      gainNode.gain.setValueAtTime(vol, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.3);
    } else if (type === 'melt') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(600, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.5);
      gainNode.gain.setValueAtTime(vol * 0.5, ctx.currentTime);
      gainNode.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.5);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.5);
    } else if (type === 'win') {
      osc.type = 'square';
      osc.frequency.setValueAtTime(440, ctx.currentTime);
      // Arpeggio
      setTimeout(() => { if(ctx.state==='running') osc.frequency.setValueAtTime(554.37, ctx.currentTime); }, 100);
      setTimeout(() => { if(ctx.state==='running') osc.frequency.setValueAtTime(659.25, ctx.currentTime); }, 200);
      setTimeout(() => { if(ctx.state==='running') osc.frequency.setValueAtTime(880, ctx.currentTime); }, 300);
      gainNode.gain.setValueAtTime(vol * 0.5, ctx.currentTime);
      gainNode.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.6);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.6);
    }
  } catch (err) {
    console.error("Audio play failed:", err);
  }
}
