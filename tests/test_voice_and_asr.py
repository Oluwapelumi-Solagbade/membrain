"""Unit tests for Abdulwaliy's voice feature extraction and Arabic ASR benchmark."""
import wave
import numpy as np
import pytest
from pathlib import Path

from scripts.extract_voice_features import (
    compute_audio_quality,
    compute_vad_and_pauses,
    compute_f0_pitch_yin,
    compute_jitter_shimmer_hnr,
    extract_all_voice_features,
)
from scripts.benchmark_arabic_asr import (
    compute_wer,
    compute_cer,
    run_dialect_benchmark,
)


@pytest.fixture
def synthetic_wav(tmp_path: Path) -> Path:
    """Generate a clean synthetic WAV file for testing DSP functions."""
    sr = 16000
    t = np.linspace(0, 1.0, sr, endpoint=False)
    tone = 0.5 * np.sin(2 * np.pi * 200 * t)  # 200 Hz tone
    silence = np.zeros(int(0.4 * sr))          # 400 ms silence
    audio = np.concatenate([tone, silence, tone])
    audio_int16 = (audio * 32767).astype(np.int16)

    wav_file = tmp_path / "test_synth.wav"
    with wave.open(str(wav_file), "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(sr)
        wf.writeframes(audio_int16.tobytes())
    return wav_file


def test_audio_quality_computation():
    sr = 16000
    audio = np.random.uniform(-0.1, 0.1, sr * 2).astype(np.float32)
    quality = compute_audio_quality(audio, sr)
    assert "snr_db" in quality
    assert quality["duration_s"] == 2.0
    assert quality["clipping"] == 0.0


def test_vad_and_pause_detection():
    sr = 16000
    t = np.linspace(0, 1.0, sr, endpoint=False)
    tone = 0.6 * np.sin(2 * np.pi * 220 * t)
    silence = np.zeros(int(0.4 * sr))  # 400 ms silence
    audio = np.concatenate([tone, silence, tone])

    vad = compute_vad_and_pauses(audio, sr, min_pause_s=0.250)
    assert vad["pause_count"] >= 1
    assert vad["mean_pause_s"] >= 0.250
    assert vad["total_speech_duration_s"] > 1.5


def test_pitch_yin_extraction():
    sr = 16000
    t = np.linspace(0, 0.5, int(sr * 0.5), endpoint=False)
    # 180 Hz pure tone
    audio = 0.7 * np.sin(2 * np.pi * 180 * t)
    pitch = compute_f0_pitch_yin(audio, sr)
    assert abs(pitch["f0_mean_hz"] - 180) < 10.0


def test_full_voice_extraction(synthetic_wav: Path):
    res = extract_all_voice_features(synthetic_wav, transcript="word one word two")
    assert "voice_features" in res
    assert "audio_quality" in res
    vf = res["voice_features"]
    assert vf["pause_count"] >= 1
    assert vf["word_count"] == 4
    assert vf["speech_rate_wpm"] > 0
    assert res["exploratory_status"] == "exploratory_only_no_direct_triage"


def test_arabic_wer_cer_computation():
    ref = "يوم الجمعة ذهبت فاطمة الى السوق"
    # Minor orthographic variation: Alef without hamza, Taa marbuta as haa
    hyp_raw = "يوم الجمعه ذهبت فاطمه الي السوق"

    raw_wer = compute_wer(ref, hyp_raw, apply_norm=False)
    norm_wer = compute_wer(ref, hyp_raw, apply_norm=True)

    # Normalization should bridge the orthographic gap
    assert norm_wer <= raw_wer
    assert norm_wer == 0.0  # Perfect match under normalisation


def test_dialect_benchmark_runner():
    results = run_dialect_benchmark()
    assert "Emirati" in results
    assert "Egyptian" in results
    assert "Levantine" in results
    assert "MSA" in results
    # MSA should have lower or equal normalized WER compared to Egyptian under standard models
    assert results["MSA"]["normalized_wer_pct"] <= results["Egyptian"]["normalized_wer_pct"]
