"""Word timestamps of the voice-over. Usage: transcribe.py <voice.f32 (16 kHz mono)> <words.json>"""
import json, sys
import numpy as np
from faster_whisper import WhisperModel
audio = np.fromfile(sys.argv[1], dtype=np.float32)
m = WhisperModel("small", device="cpu", compute_type="int8", cpu_threads=2)
segs, _ = m.transcribe(audio, language="fr", word_timestamps=True, beam_size=1)
words = [{"w": w.word, "s": w.start, "e": w.end} for s in segs for w in s.words]
json.dump(words, open(sys.argv[2], "w"), ensure_ascii=False)
print(len(words))
