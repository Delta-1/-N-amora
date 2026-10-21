package com.amora.app;
import android.content.*;
import android.net.Uri;
import android.webkit.*;
import android.view.View;
import android.graphics.Color;
import java.io.*;
import java.util.*;
public final class AmoraWeb {
 public static final String ORIGIN="https://amora.local";
 public static final List<WebView> views=new ArrayList<>();
 public static WebView create(Context context,String query){
  WebView v=new WebView(context);v.setBackgroundColor(Color.rgb(251,248,248));WebSettings s=v.getSettings();s.setJavaScriptEnabled(true);s.setDomStorageEnabled(true);s.setAllowFileAccess(false);s.setAllowContentAccess(false);s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);s.setMediaPlaybackRequiresUserGesture(true);s.setGeolocationEnabled(true);
  v.addJavascriptInterface(new NativeBridge(context,v),"AmoraAndroid");v.setWebViewClient(new WebViewClient(){
   @Override public WebResourceResponse shouldInterceptRequest(WebView view,WebResourceRequest req){Uri u=req.getUrl();if(!ORIGIN.equals(u.getScheme()+"://"+u.getHost()))return null;String path=u.getPath();if(path==null||path.equals("/"))path="/index.html";if(path.contains(".."))return new WebResourceResponse("text/plain","UTF-8",new ByteArrayInputStream(new byte[0]));try{String mime=path.endsWith(".js")?"text/javascript":path.endsWith(".css")?"text/css":path.endsWith(".json")||path.endsWith(".webmanifest")?"application/json":path.endsWith(".svg")?"image/svg+xml":path.endsWith(".png")?"image/png":path.endsWith(".woff2")?"font/woff2":"text/html";return new WebResourceResponse(mime,"UTF-8",context.getAssets().open("web"+path));}catch(IOException e){return new WebResourceResponse("text/plain","UTF-8",404,"Not found",Collections.emptyMap(),new ByteArrayInputStream(new byte[0]));}}
   @Override public boolean shouldOverrideUrlLoading(WebView view,WebResourceRequest req){Uri u=req.getUrl();if(u.getScheme().equals("https")&&u.getHost().equals("amora.local"))return false;if(req.isForMainFrame()&&("https".equals(u.getScheme())||"http".equals(u.getScheme()))){try{context.startActivity(new Intent(Intent.ACTION_VIEW,u).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));}catch(Exception ignored){}}return true;}
   @Override public void onPageFinished(WebView view,String url){NativeBridge.flush(view);}
  });
  v.setWebChromeClient(new WebChromeClient(){
   @Override public void onGeolocationPermissionsShowPrompt(String origin,GeolocationPermissions.Callback callback){if(context instanceof MainActivity&&origin.startsWith(ORIGIN))((MainActivity)context).askLocation(origin,callback);else callback.invoke(origin,false,false);}
   @Override public boolean onShowFileChooser(WebView web,ValueCallback<Uri[]> callback,FileChooserParams params){MainActivity.fileCallback=callback;Intent i=new Intent(context,MainActivity.class).setAction("amora.file").addFlags(Intent.FLAG_ACTIVITY_NEW_TASK|Intent.FLAG_ACTIVITY_SINGLE_TOP);context.startActivity(i);return true;}
   void show(android.app.AlertDialog dialog){if(!(context instanceof android.app.Activity))dialog.getWindow().setType(android.view.WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY);dialog.show();}
   @Override public boolean onJsAlert(WebView w,String url,String message,JsResult result){android.app.AlertDialog d=new android.app.AlertDialog.Builder(new android.view.ContextThemeWrapper(context,R.style.AmoraTheme)).setMessage(message).setPositiveButton("OK",(x,y)->result.confirm()).setOnCancelListener(x->result.cancel()).create();show(d);return true;}
   @Override public boolean onJsConfirm(WebView w,String url,String message,JsResult result){android.app.AlertDialog d=new android.app.AlertDialog.Builder(new android.view.ContextThemeWrapper(context,R.style.AmoraTheme)).setMessage(message).setPositiveButton("Confirmar",(x,y)->result.confirm()).setNegativeButton("Cancelar",(x,y)->result.cancel()).setOnCancelListener(x->result.cancel()).create();show(d);return true;}
   @Override public boolean onJsPrompt(WebView w,String url,String message,String value,JsPromptResult result){android.widget.EditText input=new android.widget.EditText(context);input.setText(value);android.app.AlertDialog d=new android.app.AlertDialog.Builder(new android.view.ContextThemeWrapper(context,R.style.AmoraTheme)).setMessage(message).setView(input).setPositiveButton("Salvar",(x,y)->result.confirm(input.getText().toString())).setNegativeButton("Cancelar",(x,y)->result.cancel()).setOnCancelListener(x->result.cancel()).create();show(d);return true;}

  });
  views.add(v);v.loadUrl(ORIGIN+"/index.html"+query);return v;
 }
 public static void destroy(WebView view){views.remove(view);view.removeJavascriptInterface("AmoraAndroid");view.destroy();}
}
