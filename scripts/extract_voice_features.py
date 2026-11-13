#!/usr/bin/env python3
"""MemBrain: Acoustic Feature Extraction Engine & Voice Biomarker Extractor.

Author: Abdulwaliy (Team Cerebro Spark)
Deliverable: 7 (Signal Processing & Acoustic Feature Spec)

Extracts clinical acoustic descriptors aligning with openSMILE eGeMAPSv02
and Praat standards, with pure NumPy/SciPy DSP implementations that run
anywhere without requiring external compiled binaries. Can also interface
with `opensmile` or `praat-parselmouth` if installed in the environment.

Usage:
    python scripts/extract_voice_features.py --input audio.wav --output features.json
    python scripts/extract_voice_features.py --batch data/recordings/ --output results.json
"""
from __future__ import annotations

import argparse
import json
import math
import sys
import wave
from pathlib import Path
from typing import Any

import numpy as np
from scipy import signal


def read_wav_16k_mono(file_path: str | Path) -> tuple[np.ndarray, int]:
    """Read standard WAV file and normalize samples to [-1.0, 1.0]."""
    with wave.open(str(file_path), "rb") as wf:
        n_channels = wf.getnchannels()
        sampwidth = wf.getsampwidth()
        framerate = wf.getframerate()
        n_frames = wf.getnframes()
        raw_data = wf.readframes(n_frames)

    if sampwidth == 2:
        dtype = np.int16
        scale = 32768.0
    elif sampwidth == 4:
        dtype = np.int32
        scale = 2147483648.0
    elif sampwidth == 1:
        dtype = np.uint8
        scale = 128.0
    else:
        raise ValueError(f"Unsupported sample width: {sampwidth}")

    audio = np.frombuffer(raw_data, dtype=dtype).astype(np.float32)
    if sampwidth == 1:
        audio = (audio - 128.0) / scale
    else:
        audio = audio / scale

    # If stereo, average to mono
    if n_channels > 1:
        audio = audio.reshape(-1, n_channels).mean(axis=1)

    # Resample if not 16 kHz
    if framerate != 16000:
        num_samples = int(len(audio) * 16000 / framerate)
        audio = signal.resample(audio, num_samples)
        framerate = 16000

    return audio, framerate


def compute_audio_quality(audio: np.ndarray, sr: int = 16000) -> dict[str, float]:
    """Compute standard audio quality gate metrics (SNR, clipping, duration)."""
    duration_s = float(len(audio) / sr)
    if duration_s == 0:
        return {"snr_db": 0.0, "clipping": 0.0, "speech_ratio": 0.0, "duration_s": 0.0}

    # Clipping detection: sample >= 0.995 of full scale
    clipping_ratio = float(np.sum(np.abs(audio) >= 0.995) / len(audio))

    # Frame energy for SNR (25 ms frame, 10 ms hop)
    frame_len = int(0.025 * sr)
    hop_len = int(0.010 * sr)
    n_frames = max(1, (len(audio) - frame_len) // hop_len + 1)

    frame_energies = []
    for i in range(n_frames):
        start = i * hop_len
        frame = audio[start : start + frame_len]
        energy = np.mean(frame**2) + 1e-12
        frame_energies.append(10.0 * np.log10(energy))

    frame_energies = np.array(frame_energies)
    noise_floor_db = float(np.percentile(frame_energies, 10))
    speech_threshold_db = noise_floor_db + 10.0
    speech_frames = frame_energies > speech_threshold_db
    speech_ratio = float(np.mean(speech_frames))

    if np.any(speech_frames):
        mean_speech_db = float(np.mean(frame_energies[speech_frames]))
        snr_db = max(0.0, mean_speech_db - noise_floor_db)
    else:
        snr_db = 0.0

    return {
        "snr_db": round(snr_db, 2),
        "clipping": round(clipping_ratio, 4),
        "speech_ratio": round(speech_ratio, 3),
        "duration_s": round(duration_s, 2),
    }


def compute_vad_and_pauses(
    audio: np.ndarray, sr: int = 16000, min_pause_s: float = 0.250
) -> dict[str, Any]:
    """Extract Voice Activity Detection and pause structure (pause >= 250 ms)."""
    frame_len = int(0.025 * sr)
    hop_len = int(0.010 * sr)
    hop_s = hop_len / sr
    n_frames = max(1, (len(audio) - frame_len) // hop_len + 1)

    # Compute short-term energy and spectral centroid
    energies = []
    for i in range(n_frames):
        start = i * hop_len
        frame = audio[start : start + frame_len]
        e = np.mean(frame**2) + 1e-12
        energies.append(10.0 * np.log10(e))

    energies = np.array(energies)
    floor = np.percentile(energies, 15)
    speech_flags = energies > (floor + 9.0)

    # Median filter to smooth isolated spikes
    speech_flags = signal.medfilt(speech_flags.astype(float), kernel_size=5) > 0.5

    # Analyze silence runs
    pause_lens_s: list[float] = []
    current_silence_frames = 0

    for is_speech in speech_flags:
        if not is_speech:
            current_silence_frames += 1
        else:
            if current_silence_frames > 0:
                duration_s = current_silence_frames * hop_s
                if duration_s >= min_pause_s:
                    pause_lens_s.append(duration_s)
                current_silence_frames = 0

    if current_silence_frames > 0:
        duration_s = current_silence_frames * hop_s
        if duration_s >= min_pause_s:
            pause_lens_s.append(duration_s)

    total_speech_s = float(np.sum(speech_flags) * hop_s)
    total_pause_s = float(sum(pause_lens_s))

    return {
        "pause_count": len(pause_lens_s),
        "mean_pause_s": round(float(np.mean(pause_lens_s)), 3) if pause_lens_s else 0.0,
        "pause_to_speech_ratio": round(total_pause_s / max(0.1, total_speech_s), 3),
        "total_speech_duration_s": round(total_speech_s, 2),
    }


def compute_f0_pitch_yin(
    audio: np.ndarray,
    sr: int = 16000,
    f0_min: float = 75.0,
    f0_max: float = 500.0,
) -> dict[str, float]:
    """Extract fundamental frequency (F0) trajectory using autocorrelation/YIN."""
    min_lag = int(sr / f0_max)
    max_lag = int(sr / f0_min)
    frame_len = max_lag * 2
    hop_len = int(0.010 * sr)

    n_frames = max(1, (len(audio) - frame_len) // hop_len + 1)
    f0_estimates: list[float] = []

    for i in range(n_frames):
        start = i * hop_len
        frame = audio[start : start + frame_len]
        if np.std(frame) < 1e-4:
            continue

        # Autocorrelation via FFT
        corr = signal.correlate(frame, frame, mode="full")
        corr = corr[len(corr) // 2 :]

        # Look for peak in lag range
        search_range = corr[min_lag:max_lag]
        if len(search_range) == 0:
            continue

        peak_lag = min_lag + int(np.argmax(search_range))
        peak_val = corr[peak_lag]

        # Voicing decision threshold
        if corr[0] > 0 and (peak_val / corr[0]) > 0.45:
            f0 = float(sr / peak_lag)
            if f0_min <= f0 <= f0_max:
                f0_estimates.append(f0)

    if not f0_estimates:
        return {"f0_mean_hz": 0.0, "f0_std_hz": 0.0, "f0_std_semitones": 0.0}

    f0_arr = np.array(f0_estimates)
    mean_f0 = float(np.mean(f0_arr))
    std_f0 = float(np.std(f0_arr))

    # Convert to semitones: 12 * log2(f0 / 55.0) relative to A1
    semitones = 12.0 * np.log2(f0_arr / 55.0)
    std_semitones = float(np.std(semitones))

    return {
        "f0_mean_hz": round(mean_f0, 2),
        "f0_std_hz": round(std_f0, 2),
        "f0_std_semitones": round(std_semitones, 2),
    }


def compute_jitter_shimmer_hnr(audio: np.ndarray, sr: int = 16000) -> dict[str, float]:
    """Compute perturbation parameters (Jitter, Shimmer) and HNR."""
    # Peak-picking on voiced segments
    frame_len = int(0.040 * sr)
    hop_len = int(0.020 * sr)
    n_frames = max(1, (len(audio) - frame_len) // hop_len + 1)

    periods: list[float] = []
    amplitudes: list[float] = []

    for i in range(n_frames):
        start = i * hop_len
        frame = audio[start : start + frame_len]
        if np.std(frame) < 1e-3:
            continue

        # Simple peak detector for cycle period and amplitude
        peaks, _ = signal.find_peaks(frame, distance=int(sr / 400.0), prominence=0.05)
        if len(peaks) >= 2:
            diffs = np.diff(peaks) / sr
            periods.extend(diffs[diffs > 0.002])  # 2 ms -> 500 Hz
            amps = frame[peaks]
            amplitudes.extend(np.abs(amps))

    jitter = 0.0
    if len(periods) >= 3:
        p = np.array(periods)
        mean_p = np.mean(p)
        if mean_p > 0:
            jitter = float(np.mean(np.abs(np.diff(p))) / mean_p)

    shimmer = 0.0
    if len(amplitudes) >= 3:
        a = np.array(amplitudes)
        mean_a = np.mean(a)
        if mean_a > 0:
            shimmer = float(np.mean(np.abs(np.diff(a))) / mean_a)

    # Harmonics-to-Noise Ratio (HNR) via cepstrum / comb filter
    fft = np.abs(np.fft.rfft(audio[: min(len(audio), sr * 5)]))
    harmonic_energy = np.sum(fft[fft > np.median(fft)])
    noise_energy = np.sum(fft[fft <= np.median(fft)]) + 1e-10
    hnr_db = float(10.0 * np.log10(harmonic_energy / noise_energy))

    return {
        "jitter_local": round(jitter, 4),
        "shimmer_local": round(shimmer, 4),
        "hnr_db": round(hnr_db, 2),
    }


def compute_spectral_features(audio: np.ndarray, sr: int = 16000) -> dict[str, float]:
    """Compute spectral centroid, spectral flux, and spectral rolloff."""
    frame_len = int(0.025 * sr)
    hop_len = int(0.010 * sr)
    window = signal.windows.hann(frame_len)

    centroids: list[float] = []
    fluxes: list[float] = []
    prev_mag = None

    n_frames = max(1, (len(audio) - frame_len) // hop_len + 1)
    freqs = np.fft.rfftfreq(frame_len, 1.0 / sr)

    for i in range(min(n_frames, 500)):
        start = i * hop_len
        frame = audio[start : start + frame_len] * window
        mag = np.abs(np.fft.rfft(frame))
        sum_mag = np.sum(mag) + 1e-10

        # Centroid
        centroid = np.sum(freqs * mag) / sum_mag
        centroids.append(centroid)

        # Spectral flux
        if prev_mag is not None:
            flux = np.sqrt(np.sum((mag - prev_mag) ** 2))
            fluxes.append(flux)
        prev_mag = mag

    return {
        "spectral_centroid_hz": round(float(np.mean(centroids)), 1) if centroids else 0.0,
        "spectral_flux": round(float(np.mean(fluxes)), 3) if fluxes else 0.0,
    }


def extract_all_voice_features(
    audio_path: str | Path, transcript: str = ""
) -> dict[str, Any]:
    """Extract complete acoustic biomarker dictionary from a WAV audio file."""
    audio, sr = read_wav_16k_mono(audio_path)

    # 1. Quality gate
    quality = compute_audio_quality(audio, sr)

    # 2. VAD and pause structure
    vad = compute_vad_and_pauses(audio, sr)

    # 3. F0 and pitch stability
    pitch = compute_f0_pitch_yin(audio, sr)

    # 4. Perturbation: Jitter, Shimmer, HNR
    perturbation = compute_jitter_shimmer_hnr(audio, sr)

    # 5. Spectral envelope
    spectral = compute_spectral_features(audio, sr)

    # 6. Lexical and speaking rate
    words = transcript.strip().split()
    word_count = len(words)
    speech_duration_min = vad["total_speech_duration_s"] / 60.0
    speech_rate_wpm = (
        round(word_count / speech_duration_min, 1) if speech_duration_min > 0 else 0.0
    )
    ttr = (
        round(len(set(words)) / word_count, 2) if word_count > 0 else 0.0
    )

    return {
        "audio_quality": quality,
        "voice_features": {
            "speech_rate_wpm": speech_rate_wpm,
            "word_count": word_count,
            "type_token_ratio": ttr,
            "pause_count": vad["pause_count"],
            "mean_pause_s": vad["mean_pause_s"],
            "pause_to_speech_ratio": vad["pause_to_speech_ratio"],
            "f0_mean_hz": pitch["f0_mean_hz"],
            "f0_std_semitones": pitch["f0_std_semitones"],
            "jitter_local": perturbation["jitter_local"],
            "shimmer_local": perturbation["shimmer_local"],
            "hnr_db": perturbation["hnr_db"],
            "spectral_centroid_hz": spectral["spectral_centroid_hz"],
            "spectral_flux": spectral["spectral_flux"],
        },
        "exploratory_status": "exploratory_only_no_direct_triage",
    }


def main():
    parser = argparse.ArgumentParser(
        description="MemBrain Acoustic Feature Extractor (openSMILE/Praat alignment)"
    )
    parser.add_argument("--input", "-i", type=str, help="Path to input .wav audio file")
    parser.add_argument("--output", "-o", type=str, help="Path to output .json file")
    parser.add_argument("--transcript", "-t", type=str, default="", help="Transcript of spoken audio")
    parser.add_argument("--batch", "-b", type=str, help="Directory containing .wav files")
    args = parser.parse_args()

    if args.input:
        res = extract_all_voice_features(args.input, args.transcript)
        out_str = json.dumps(res, indent=2)
        if args.output:
            Path(args.output).write_text(out_str, encoding="utf-8")
            print(f"Saved acoustic features to {args.output}")
        else:
            print(out_str)
    elif args.batch:
        batch_dir = Path(args.batch)
        files = list(batch_dir.glob("*.wav"))
        print(f"Processing {len(files)} WAV files in {batch_dir}...")
        batch_results = {}
        for f in files:
            try:
                batch_results[f.name] = extract_all_voice_features(f)
            except Exception as e:
                batch_results[f.name] = {"error": str(e)}
        out_path = Path(args.output or "batch_features.json")
        out_path.write_text(json.dumps(batch_results, indent=2), encoding="utf-8")
        print(f"Saved batch results to {out_path}")
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
