# MemBrain for Android

The Android app is the site's mobile build (`NEXT_PUBLIC_MOBILE=1`: the home screen is the app in
`site/components/app/`) packaged with [Capacitor](https://capacitorjs.com) 6. The same app runs in a browser at `/app/`.

- Works against the live MemBrain server only (`MEMBRAIN_API_URL`, default the Hugging Face Space). The splash waits for a
  server that is waking up; if it cannot be reached the app says so and offers to retry, and never shows an offline copy.
- Clinicians: home dashboard, map of the emirates, alert queue, written programme reports, case screen, new concerns by
  voice or typing. People and families: next check-in, the spoken check-in, report a change, the family questionnaire.
- Microphone: asked for the first time it is used (spoken check-in, dictation).

## Build the APK

Needs Node 22, JDK 17 and the Android SDK (platform 34).

```bash
cd mobile
npm ci
npm run apk        # builds the web bundle, syncs it into android/, then ./gradlew assembleDebug
# -> android/app/build/outputs/apk/debug/app-debug.apk
```

On macOS with Homebrew: `export JAVA_HOME=/opt/homebrew/opt/openjdk@17 ANDROID_HOME=$HOME/Library/Android/sdk`.

`.github/workflows/android.yml` builds it on every push to main and publishes `MemBrain.apk` on the
[android-latest release](https://github.com/teamcerebrospark/membrain/releases/tag/android-latest); the landing
page's download button links there. It is a debug-signed build for the demo; a store release needs a signing key.

The launcher icons and splash screens in `android/app/src/main/res` are generated from `site/public/brand/membrain-mark-white.png`.
