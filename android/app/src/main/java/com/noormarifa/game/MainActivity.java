package com.noormarifa.game;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.graphics.Insets;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.Window;
import android.view.WindowInsets;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;

/**
 * Hosts the game (HTML/JS bundled in assets) in a full-screen WebView.
 * The app is fully offline: it loads only local files and declares no INTERNET permission.
 */
public class MainActivity extends Activity {
    private static final String START_URL = "file:///android_asset/index.html";
    private static final int NAVY = 0xFF0C1F3F;
    private WebView web;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        Window window = getWindow();
        drawEdgeToEdge(window);

        web = new WebView(this);
        web.setBackgroundColor(NAVY);
        web.setOverScrollMode(View.OVER_SCROLL_NEVER);
        web.setVerticalScrollBarEnabled(false);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true); // حفظ التقدم (localStorage)
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setSupportZoom(false);
        s.setBuiltInZoomControls(false);
        s.setDisplayZoomControls(false);
        s.setTextZoom(100); // تجاهل تكبير خط النظام حتى لا يختل تصميم اللوحة
        s.setAllowContentAccess(false);
        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                // لا يُسمح بالتنقل خارج ملفات اللعبة المحلية
                return !request.getUrl().toString().startsWith("file:///android_asset/");
            }
        });

        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(NAVY);
        root.addView(web, new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT));
        root.setOnApplyWindowInsetsListener((v, insets) -> {
            if (Build.VERSION.SDK_INT >= 30) {
                Insets i = insets.getInsets(WindowInsets.Type.systemBars() | WindowInsets.Type.displayCutout());
                v.setPadding(i.left, i.top, i.right, i.bottom);
            } else {
                v.setPadding(insets.getSystemWindowInsetLeft(), insets.getSystemWindowInsetTop(),
                        insets.getSystemWindowInsetRight(), insets.getSystemWindowInsetBottom());
            }
            return insets;
        });
        setContentView(root);

        if (savedInstanceState != null) web.restoreState(savedInstanceState);
        else web.loadUrl(START_URL);
    }

    /** Draw behind the system bars on every Android version, then pad the content by the insets. */
    @SuppressWarnings("deprecation")
    private void drawEdgeToEdge(Window window) {
        window.setStatusBarColor(NAVY);
        window.setNavigationBarColor(NAVY);
        if (Build.VERSION.SDK_INT >= 30) {
            window.setDecorFitsSystemWindows(false);
        } else {
            window.getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                    | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION);
        }
    }

    @SuppressWarnings("deprecation")
    @Override
    public void onBackPressed() {
        // نسأل اللعبة أولاً: تغلق النافذة أو تعود للشاشة السابقة، ومن الشاشة الرئيسية نخرج
        web.evaluateJavascript(
                "(window.Noor && Noor.App && Noor.App.onBack) ? Noor.App.onBack() : false",
                value -> {
                    if (!"true".equals(value)) finish();
                });
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        super.onSaveInstanceState(outState);
        web.saveState(outState);
    }

    @Override
    protected void onPause() {
        // إيقاف الموسيقى والمؤثرات عند مغادرة التطبيق أو قفل الشاشة
        web.evaluateJavascript("window.Noor && Noor.music && Noor.music.pauseAll()", null);
        web.onPause();
        super.onPause();
    }

    @Override
    protected void onResume() {
        super.onResume();
        web.onResume();
        web.evaluateJavascript("window.Noor && Noor.music && Noor.music.resumeAll()", null);
    }

    @Override
    protected void onDestroy() {
        web.destroy();
        super.onDestroy();
    }
}
