# Team recording protocol (task-word test set)

This gives us a small, consented test set built from the **actual MemBrain task words**, so we can measure what matters: does the recogniser hear the words the scoring engine listens for?

## Who and how many
- 6–12 speakers from the team's network, covering Emirati or other Gulf, Levantine and Egyptian speakers, ideally including people aged 50+. Adults only.
- Each speaker reads 4 short items per form (A, B, C):
  1. the 10-word list at a natural pace
  2. the 10 words in a different order
  3. 6–10 fluency words from the category
  4. a retelling of the story in their own words, in dialect
- That is 12 clips per speaker, about 5 minutes in total.

## Consent (required before recording)
- Each speaker signs or records a short consent statement covering: research use for testing speech recognition; storage on the team's drive for the challenge period; deletion on request; no publication of the audio.
- Give each speaker a `consent_id`. **Clips without a `consent_id` are skipped by the code.**
- Never record patients or anyone who cannot consent for themselves.

## Recording
- Use a phone's voice-memo app in a quiet room, held about 20 cm from the mouth. Save or convert to WAV (16 kHz mono if possible; the code resamples anyway).
- Name files `spk01_formA_words.wav` and so on, and fill in `metadata.csv` using `team_recordings_template.csv`. In the `text` column, write what was **actually said**, in the dialect spelling the speaker used.
- Record each speaker's age band and education band, so results can be broken down by subgroup.

## Storage
- Keep the audio in a private team drive, **not** in the GitHub repo (the repo is public).
- Only the metrics and 5 example lines end up in `docs/asr/`.
