package ae.membrain.app;

import android.graphics.Color;
import android.os.Bundle;
import android.view.Window;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.WebViewListener;

/**
 * The app draws edge to edge: the screen's own header runs behind the clock and battery, as in any native app.
 * The status bar and navigation bar sizes are handed to the page as CSS variables (--mb-sat, --mb-sab), because
 * Android's WebView does not report env(safe-area-inset-*) on every version, and the page tells us whether the
 * icons up there should be white (over the green header) or dark (over a light screen).
 */
public class MainActivity extends BridgeActivity {
    private float density = 1f;
    private int topPx = 0;
    private int bottomPx = 0;
    private boolean edge = true;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        density = getResources().getDisplayMetrics().density;
        Window window = getWindow();
        WindowCompat.setDecorFitsSystemWindows(window, false);
        window.setStatusBarColor(Color.TRANSPARENT);
        window.setNavigationBarColor(Color.TRANSPARENT);
        setIcons(true);

        WebView web = getBridge().getWebView();
        // Spoken instructions are audio from the MemBrain server (Android's WebView has no speech synthesis):
        // let them play without a tap on each one.
        web.getSettings().setMediaPlaybackRequiresUserGesture(false);
        web.addJavascriptInterface(new NativeBars(), "MembrainNative");
        ViewCompat.setOnApplyWindowInsetsListener(web, (v, insets) -> {
            Insets bars = insets.getInsets(WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout());
            topPx = edge ? bars.top : 0;
            bottomPx = edge ? bars.bottom : 0;
            pushInsets();
            return insets;
        });
        getBridge().addWebViewListener(new WebViewListener() {
            @Override
            public void onPageLoaded(WebView webView) {
                pushInsets();
                webView.postDelayed(MainActivity.this::pushInsets, 1200);
            }
        });
    }

    private void pushInsets() {
        WebView web = getBridge() == null ? null : getBridge().getWebView();
        if (web == null) return;
        int top = Math.round(topPx / density);
        int bottom = Math.round(bottomPx / density);
        String js = "(function(){var s=document.getElementById('mb-native-insets');if(!s){s=document.createElement('style');s.id='mb-native-insets';(document.head||document.documentElement).appendChild(s);}"
            + "s.textContent=':root{--mb-sat:" + top + "px !important;--mb-sab:" + bottom + "px !important}';})();";
        web.post(() -> web.evaluateJavascript(js, null));
    }

    /** light = white icons, for the green header; otherwise dark icons for light screens. */
    private void setIcons(boolean light) {
        Window window = getWindow();
        WindowInsetsControllerCompat c = WindowCompat.getInsetsController(window, window.getDecorView());
        c.setAppearanceLightStatusBars(!light);
        c.setAppearanceLightNavigationBars(true);
    }

    /** The app's own screens draw edge to edge; other pages sit below a status bar in their own top colour. */
    private void setEdge(boolean on, int color) {
        Window window = getWindow();
        window.getDecorView().setBackgroundColor(color);
        if (on == edge) return;
        edge = on;
        WindowCompat.setDecorFitsSystemWindows(window, !on);
        if (!on) setIcons(false);
        getBridge().getWebView().requestApplyInsets();
    }

    private static int parseCss(String css) {
        try {
            String[] p = css.replaceAll("[^0-9.,]", "").split(",");
            return Color.rgb(Math.round(Float.parseFloat(p[0])), Math.round(Float.parseFloat(p[1])), Math.round(Float.parseFloat(p[2])));
        } catch (Exception e) {
            return Color.WHITE;
        }
    }

    private class NativeBars {
        @JavascriptInterface
        public void setEdgeToEdge(boolean on, String color) {
            int c = parseCss(color == null ? "" : color);
            runOnUiThread(() -> setEdge(on, c));
        }

        @JavascriptInterface
        public void setStatusBarStyle(String style) {
            runOnUiThread(() -> setIcons("light".equals(style)));
        }
    }
}
