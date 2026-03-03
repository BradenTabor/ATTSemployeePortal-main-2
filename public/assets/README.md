# Audio Assets

## Login Chime

Place your ambient login sound file here as `login-chime.mp3`.

### Requirements:
- **Format**: MP3 (for best browser compatibility)
- **Duration**: 1-2 seconds recommended
- **Volume**: Pre-normalized to moderate level (component sets volume to 0.2)
- **Style**: Subtle whoosh, chime, or ambient tone
- **File Size**: Keep under 50KB for fast loading

### Suggested Sound Types:
1. **Soft Whoosh**: A gentle "swoosh" sound that complements the fade-in
2. **Gentle Chime**: A single bell or crystal tone
3. **Ambient Tone**: A low, warm hum that creates atmosphere
4. **Digital Bloop**: A futuristic, clean notification sound

### Free Sound Resources:
- Freesound.org
- Zapsplat.com
- Mixkit.co/free-sound-effects

### Example Implementation:
The SessionOverlay component will automatically play this sound when:
- The overlay first appears (on app load/refresh)
- The `playSound` prop is set to `true`
- User's browser allows autoplay (fails gracefully if not)

### Note:
The sound feature is **optional** and defaults to `false`. To enable:
```tsx
<SessionOverlay isLoading={loading} playSound={true} />
```

### Testing Without Audio:
The component works perfectly without the audio file. If the file is missing, the audio playback will simply fail silently and the visual experience remains unchanged.

---

## Forms History page icons (optional)

To use custom icon images on the Forms History page (hub cards and stat strip), add:

| Filename | Used for |
|----------|----------|
| `forms-history-dvir-icon.png` | DVIR card and DVIR-related stats (vehicle/inspection). Recommended: 48×48px or 96×96px, transparent or dark-friendly. |
| `forms-history-jsa-icon.png` | JSA card and JSA-related stats (safety/analysis). Same size guidance. |

If these files are missing, the page falls back to Lucide icons (Truck, Shield, Clock).

---

## Daily Safety Briefing page (optional)

To use a custom icon in the Daily Safety Briefing header, add:

| Filename | Used for |
|----------|----------|
| `daily-safety-briefing.png` | Header icon on the Daily Safety Briefing page. Recommended: 40×40px or 80×80px (displayed at 20×20px), transparent or dark-friendly; e.g. shield, checklist, or safety badge. |

If the file is missing or fails to load, the page falls back to the Lucide Shield icon.
