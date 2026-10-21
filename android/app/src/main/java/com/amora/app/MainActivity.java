package com.amora.app;
import android.app.*;
import android.os.*;
import android.content.*;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.provider.Settings;
import android.speech.RecognizerIntent;
import android.media.projection.MediaProjectionManager;
import android.webkit.*;
import android.view.*;
import org.json.*;
public class MainActivity extends Activity {
 WebView web;String locationOrigin;GeolocationPermissions.Callback locationCallback;
 public static ValueCallback<Uri[]> fileCallback;
 @Override public void onCreate(Bundle state){super.onCreate(state);getWindow().setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE);web=AmoraWeb.create(this,"");setContentView(web);web.setOnApplyWindowInsetsListener((v,insets)->{v.setPadding(insets.getSystemWindowInsetLeft(),insets.getSystemWindowInsetTop(),insets.getSystemWindowInsetRight(),insets.getSystemWindowInsetBottom());return insets;});handle(getIntent());}
 @Override protected void onNewIntent(Intent intent){super.onNewIntent(intent);setIntent(intent);handle(intent);}
 void handle(Intent i){String a=i.getAction();if("amora.overlay".equals(a)){if(!Settings.canDrawOverlays(this))startActivityForResult(new Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION,Uri.parse("package:"+getPackageName())),40);else startForegroundService(new Intent(this,OverlayService.class));}
 else if("amora.capture".equals(a)){OverlayService.hidePanel();MediaProjectionManager m=(MediaProjectionManager)getSystemService(MEDIA_PROJECTION_SERVICE);startActivityForResult(m.createScreenCaptureIntent(),41);}
 else if("amora.voice".equals(a)){try{startActivityForResult(new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL,RecognizerIntent.LANGUAGE_MODEL_FREE_FORM).putExtra(RecognizerIntent.EXTRA_LANGUAGE,"pt-BR").putExtra(RecognizerIntent.EXTRA_PROMPT,"Fale com a Lilith"),42);}catch(Exception e){NativeBridge.event("error","Use o microfone do teclado para ditar.");}}
 else if("amora.file".equals(a)){startActivityForResult(new Intent(Intent.ACTION_OPEN_DOCUMENT).setType("image/*").addCategory(Intent.CATEGORY_OPENABLE),43);}
 else if("amora.permissions".equals(a)&&Build.VERSION.SDK_INT>=33)requestPermissions(new String[]{"android.permission.POST_NOTIFICATIONS"},45);
 else if(i.hasExtra("route"))NativeBridge.event("route",i.getStringExtra("route"));}
 @Override protected void onActivityResult(int request,int result,Intent data){super.onActivityResult(request,result,data);
 if(request==40){if(Settings.canDrawOverlays(this))startForegroundService(new Intent(this,OverlayService.class));else NativeBridge.event("error","Permissão da bolinha não foi concedida.");}
 if(request==41){if(result==RESULT_OK&&data!=null){startForegroundService(new Intent(this,CaptureService.class).putExtra("result",result).putExtra("data",data));moveTaskToBack(true);}else{NativeBridge.event("error","Captura de tela cancelada.");OverlayService.showPanel();}}
 if(request==42){if(result==RESULT_OK&&data!=null){java.util.ArrayList<String> words=data.getStringArrayListExtra(RecognizerIntent.EXTRA_RESULTS);if(words!=null&&!words.isEmpty())NativeBridge.event("text",words.get(0));}if(OverlayService.active!=null){moveTaskToBack(true);OverlayService.showPanel();}}
 if(request==43&&fileCallback!=null){fileCallback.onReceiveValue(result==RESULT_OK&&data!=null?new Uri[]{data.getData()}:null);fileCallback=null;}
 }
 public void askLocation(String origin,GeolocationPermissions.Callback callback){if(checkSelfPermission("android.permission.ACCESS_FINE_LOCATION")==PackageManager.PERMISSION_GRANTED||checkSelfPermission("android.permission.ACCESS_COARSE_LOCATION")==PackageManager.PERMISSION_GRANTED){callback.invoke(origin,true,false);return;}locationOrigin=origin;locationCallback=callback;requestPermissions(new String[]{"android.permission.ACCESS_FINE_LOCATION","android.permission.ACCESS_COARSE_LOCATION"},44);}
 @Override public void onRequestPermissionsResult(int request,String[] permissions,int[] granted){super.onRequestPermissionsResult(request,permissions,granted);if(request==44&&locationCallback!=null){boolean yes=false;for(int x:granted)yes|=x==PackageManager.PERMISSION_GRANTED;locationCallback.invoke(locationOrigin,yes,false);locationCallback=null;}}
 @Override public void onBackPressed(){web.evaluateJavascript("window.dispatchEvent(new CustomEvent('amora-native',{detail:{route:'home'}}))",null);}
 @Override protected void onDestroy(){if(web!=null)AmoraWeb.destroy(web);super.onDestroy();}
}
