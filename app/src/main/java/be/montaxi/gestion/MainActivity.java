package be.montaxi.gestion;
import android.app.Activity;
import android.os.Bundle;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.webkit.WebSettings;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceError;
import android.view.View;
import android.widget.TextView;
public class MainActivity extends Activity {
 private WebView web;
 private static final String APP_URL="https://mohamed-dahmane.github.io/Mon-taxi-/";
 @Override public void onCreate(Bundle state) {
  super.onCreate(state);
  web = new WebView(this);
  web.setWebViewClient(new WebViewClient(){
   @Override public void onReceivedError(WebView view, WebResourceRequest req, WebResourceError error) {
    if(req.isForMainFrame()) view.loadUrl("file:///android_asset/index.html");
   }
   @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest req) {
    return !req.getUrl().toString().startsWith(APP_URL);
   }
  });
  web.setWebChromeClient(new WebChromeClient());
  WebSettings s = web.getSettings();
  s.setJavaScriptEnabled(true);
  s.setDomStorageEnabled(true);
  s.setAllowFileAccess(false);
  s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
  setContentView(web);
  web.loadUrl(APP_URL);
 }
 @Override public void onBackPressed() { if(web.canGoBack()) web.goBack(); else super.onBackPressed(); }
}
