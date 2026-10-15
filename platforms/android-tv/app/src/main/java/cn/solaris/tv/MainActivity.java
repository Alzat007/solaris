package cn.solaris.tv;

import android.app.Activity;
import android.net.Uri;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.KeyEvent;
import android.view.ViewGroup;
import android.view.WindowManager;
import android.webkit.PermissionRequest;
import android.webkit.RenderProcessGoneDetail;
import android.webkit.SslErrorHandler;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.net.http.SslError;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.Toast;
import androidx.webkit.WebViewAssetLoader;
import java.io.ByteArrayInputStream;
import java.util.Collections;

public final class MainActivity extends Activity {
    private static final String HOST = "appassets.androidplatform.net";
    private static final String APP_URL = "https://" + HOST + "/index.html?tv=1&lang=en";
    private WebView webView;
    private boolean backPending;
    private boolean confirmHeld;
    private final Handler handler = new Handler(Looper.getMainLooper());
    private final Runnable backTimeout = () -> {
        if (backPending) {
            backPending = false;
            finish();
        }
    };

    private static boolean localUrl(Uri uri) {
        return "https".equals(uri.getScheme()) && HOST.equals(uri.getHost()) &&
            uri.getUserInfo() == null && uri.getPort() == -1;
    }

    private static boolean relayRequest(WebResourceRequest request) {
        if (BuildConfig.TV_RELAY_ORIGIN.isEmpty()) return false;
        final Uri expected = Uri.parse(BuildConfig.TV_RELAY_ORIGIN);
        final Uri uri = request.getUrl();
        if (uri.getUserInfo() != null || uri.getQuery() != null || uri.getFragment() != null ||
                !expected.getHost().equalsIgnoreCase(uri.getHost()) ||
                (expected.getPort() == -1 ? 443 : expected.getPort()) !=
                    (uri.getPort() == -1 ? 443 : uri.getPort())) return false;
        return ("https".equals(uri.getScheme()) && "/v1/sessions".equals(uri.getEncodedPath()) &&
                    ("POST".equals(request.getMethod()) || "OPTIONS".equals(request.getMethod()))) ||
            ("wss".equals(uri.getScheme()) && "/v1/ws".equals(uri.getEncodedPath()) &&
                    "GET".equals(request.getMethod()));
    }

    @Override
    public void onCreate(Bundle state) {
        super.onCreate(state);
        getWindow().setFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN,
            WindowManager.LayoutParams.FLAG_FULLSCREEN);
        final WebViewAssetLoader assets = new WebViewAssetLoader.Builder()
            .addPathHandler("/", new WebViewAssetLoader.AssetsPathHandler(this))
            .build();
        webView = new WebView(this);
        WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG);
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setAllowFileAccessFromFileURLs(false);
        settings.setAllowUniversalAccessFromFileURLs(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setMediaPlaybackRequiresUserGesture(true);
        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onPermissionRequest(PermissionRequest request) {
                request.deny();
            }
        });
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view,
                    WebResourceRequest request) {
                if (localUrl(request.getUrl())) {
                    WebResourceResponse response = assets.shouldInterceptRequest(request.getUrl());
                    if (response != null) return response;
                }
                if (relayRequest(request)) return null;
                return new WebResourceResponse("text/plain", "UTF-8", 404, "Not Found",
                    Collections.emptyMap(), new ByteArrayInputStream(new byte[0]));
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                return shouldOverrideUrlLoading(view, request.getUrl().toString());
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, String url) {
                if (localUrl(Uri.parse(url))) return false;
                Toast.makeText(MainActivity.this,
                    "External page navigation is unavailable in this TV build.", Toast.LENGTH_SHORT).show();
                return true;
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                view.requestFocus();
            }

            @Override
            public boolean onRenderProcessGone(WebView view, RenderProcessGoneDetail detail) {
                webView = null;
                if (view.getParent() instanceof ViewGroup) ((ViewGroup) view.getParent()).removeView(view);
                view.destroy();
                confirmHeld = false;
                backPending = false;
                handler.removeCallbacks(backTimeout);
                LinearLayout recovery = new LinearLayout(MainActivity.this);
                recovery.setOrientation(LinearLayout.VERTICAL);
                recovery.setGravity(android.view.Gravity.CENTER);
                TextView message = new TextView(MainActivity.this);
                message.setText("The graphics renderer stopped. Restart SOLARIS or press Back to exit.");
                message.setTextSize(24);
                Button restart = new Button(MainActivity.this);
                restart.setText("Restart SOLARIS");
                restart.setOnClickListener(button -> recreate());
                recovery.addView(message);
                recovery.addView(restart);
                setContentView(recovery);
                restart.requestFocus();
                return true;
            }

            @Override
            public void onReceivedSslError(WebView view, SslErrorHandler sslHandler, SslError error) {
                sslHandler.cancel();
            }
        });
        setContentView(webView);
        webView.loadUrl(APP_URL);
    }

    @Override
    public boolean dispatchKeyEvent(KeyEvent event) {
        final int key = event.getKeyCode();
        if (key == KeyEvent.KEYCODE_BACK) {
            if (event.getAction() == KeyEvent.ACTION_DOWN && event.getRepeatCount() == 0) dispatchBack();
            return true;
        }
        if (webView != null && (key == KeyEvent.KEYCODE_DPAD_CENTER ||
                key == KeyEvent.KEYCODE_ENTER || key == KeyEvent.KEYCODE_NUMPAD_ENTER)) {
            if (event.getAction() == KeyEvent.ACTION_DOWN && !confirmHeld && event.getRepeatCount() == 0) {
                confirmHeld = true;
                dispatchConfirm("keydown");
            } else if (event.getAction() == KeyEvent.ACTION_UP && confirmHeld) {
                confirmHeld = false;
                dispatchConfirm("keyup");
            }
            // Consume native confirmation so WebView cannot also synthesize a click.
            return true;
        }
        return super.dispatchKeyEvent(event);
    }

    private void dispatchConfirm(String type) {
        if (webView == null) return;
        webView.evaluateJavascript("(() => { window.dispatchEvent(new CustomEvent('solaris-native-input')); " +
            "const target = document.activeElement || document.body; " +
            "target.dispatchEvent(new KeyboardEvent('" + type + "', {key:'Enter',code:'Enter'," +
            "keyCode:13,which:13,bubbles:true,cancelable:true,repeat:false})); })()", null);
    }

    private void platformEvent(String name) {
        if (webView != null) webView.evaluateJavascript(
            "window.dispatchEvent(new Event('" + name + "'))", null);
    }

    @Override
    public boolean onKeyDown(int keyCode, KeyEvent event) {
        if (keyCode == KeyEvent.KEYCODE_BACK) {
            if (event.getRepeatCount() == 0) dispatchBack();
            return true;
        }
        return super.onKeyDown(keyCode, event);
    }

    @Override
    public void onBackPressed() {
        dispatchBack();
    }

    private void dispatchBack() {
        if (webView == null) {
            finish();
            return;
        }
        if (backPending) return;
        backPending = true;
        handler.postDelayed(backTimeout, 1500);
        webView.evaluateJavascript(
            "(() => { const e = new CustomEvent('solaris-back', {cancelable:true}); " +
            "window.dispatchEvent(e); return e.defaultPrevented; })()",
            result -> {
                handler.removeCallbacks(backTimeout);
                if (!backPending) return;
                backPending = false;
                if (!"true".equals(result)) finish();
            });
    }

    @Override
    protected void onPause() {
        if (webView != null) {
            platformEvent("solaris-platform-pause");
            confirmHeld = false;
            webView.onPause();
            webView.pauseTimers();
        }
        super.onPause();
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (webView != null) {
            webView.resumeTimers();
            webView.onResume();
            platformEvent("solaris-platform-resume");
        }
    }

    @Override
    protected void onDestroy() {
        handler.removeCallbacks(backTimeout);
        if (webView != null) {
            platformEvent("solaris-platform-pause");
            if (webView.getParent() instanceof ViewGroup) ((ViewGroup) webView.getParent()).removeView(webView);
            webView.destroy();
            webView = null;
        }
        super.onDestroy();
    }
}
