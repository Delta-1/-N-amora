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
 final java.util.Set<Integer> overlayRequests=new java.util.HashSet<>();
 WebView web;PermissionRequest cameraRequest;String locationOrigin;GeolocationPermissions.Callback locationCallback;
 public static ValueCallback<Uri[]> fileCallback;
 @Override public void onCreate(Bundle state){super.onCreate(state);if(state!=null){int[] requests=state.getIntArray("overlayRequests");if(requests!=null)for(int request:requests)overlayRequests.add(request);}getWindow().setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE);web=AmoraWeb.create(this,"");setContentView(web);web.setOnApplyWindowInsetsListener((v,insets)->{v.setPadding(insets.getSystemWindowInsetLeft(),insets.getSystemWindowInsetTop(),insets.getSystemWindowInsetRight(),insets.getSystemWindowInsetBottom());return insets;});handle(getIntent());}
 @Override protected void onNewIntent(Intent intent){super.onNewIntent(intent);setIntent(intent);handle(intent);}
 void returnToOverlay(int request){if(overlayRequests.remove(request)&&OverlayService.active!=null){moveTaskToBack(true);OverlayService.showPanel();}}
 void startSystemActivity(Intent intent,int request,Intent source){if(source.getBooleanExtra("fromOverlay",false))overlayRequests.add(request);OverlayService.hidePanel();try{startActivityForResult(intent,request);}catch(ActivityNotFoundException e){if(request==46)NativeBridge.exportBytes=null;if(request==43&&fileCallback!=null){fileCallback.onReceiveValue(null);fileCallback=null;}NativeBridge.event("error","Este recurso não está disponível no aparelho.");returnToOverlay(request);}}
 @Override protected void onSaveInstanceState(Bundle state){state.putIntArray("overlayRequests",overlayRequests.stream().mapToInt(Integer::intValue).toArray());super.onSaveInstanceState(state);}
 void handle(Intent i){String a=i.getAction();Uri uri=i.getData();if(uri!=null&&"amora".equals(uri.getScheme())&&"drive-callback".equals(uri.getHost())){String code=uri.getQueryParameter("code"),state=uri.getQueryParameter("state");if(code!=null&&code.length()<=4000&&state!=null&&state.matches("[a-f0-9]{64}")){try{NativeBridge.event("driveCallback",new JSONObject().put("code",code).put("state",state));}catch(Exception ignored){}}}if("amora.overlay".equals(a)){if(!Settings.canDrawOverlays(this))startSystemActivity(new Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION,Uri.parse("package:"+getPackageName())),40,i);else startForegroundService(new Intent(this,OverlayService.class));}
 else if("amora.capture".equals(a)){OverlayService.hidePanel();MediaProjectionManager m=(MediaProjectionManager)getSystemService(MEDIA_PROJECTION_SERVICE);startSystemActivity(m.createScreenCaptureIntent(),41,i);}
 else if("amora.voice".equals(a)){try{startSystemActivity(new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL,RecognizerIntent.LANGUAGE_MODEL_FREE_FORM).putExtra(RecognizerIntent.EXTRA_LANGUAGE,"pt-BR").putExtra(RecognizerIntent.EXTRA_PROMPT,"Fale com a Lilith"),42,i);}catch(Exception e){NativeBridge.event("error","Use o microfone do teclado para ditar.");}}
 else if("amora.save".equals(a)&&NativeBridge.exportBytes!=null){startSystemActivity(new Intent(Intent.ACTION_CREATE_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE).setType(NativeBridge.exportMime).putExtra(Intent.EXTRA_TITLE,NativeBridge.exportName),46,i);}
 else if("amora.file".equals(a)){startSystemActivity(new Intent(Intent.ACTION_OPEN_DOCUMENT).setType(i.getStringExtra("fileType")==null?"*/*":i.getStringExtra("fileType")).putExtra(Intent.EXTRA_ALLOW_MULTIPLE,i.getBooleanExtra("multiple",false)).addCategory(Intent.CATEGORY_OPENABLE),43,i);}
 else if("amora.permissions".equals(a)&&Build.VERSION.SDK_INT>=33)requestPermissions(new String[]{"android.permission.POST_NOTIFICATIONS"},45);
 else if(i.hasExtra("route"))NativeBridge.event("route",i.getStringExtra("route"));setIntent(new Intent(this,MainActivity.class));}
 @Override protected void onActivityResult(int request,int result,Intent data){super.onActivityResult(request,result,data);
 if(request==40){if(Settings.canDrawOverlays(this))startForegroundService(new Intent(this,OverlayService.class));else NativeBridge.event("error","Permissão da bolinha não foi concedida.");}
 if(request==41){if(result==RESULT_OK&&data!=null){startForegroundService(new Intent(this,CaptureService.class).putExtra("result",result).putExtra("data",data));moveTaskToBack(true);}else{NativeBridge.event("error","Captura de tela cancelada.");OverlayService.showPanel();}}
 if(request==42){if(result==RESULT_OK&&data!=null){java.util.ArrayList<String> words=data.getStringArrayListExtra(RecognizerIntent.EXTRA_RESULTS);if(words!=null&&!words.isEmpty())NativeBridge.event("text",words.get(0));}returnToOverlay(42);}
 if(request==46){byte[] bytes=NativeBridge.exportBytes;NativeBridge.exportBytes=null;if(result==RESULT_OK&&data!=null&&bytes!=null){try(java.io.OutputStream out=getContentResolver().openOutputStream(data.getData())){out.write(bytes);NativeBridge.event("info","Arquivo salvo no local escolhido.");}catch(Exception e){NativeBridge.event("error","Não foi possível salvar o arquivo.");}}returnToOverlay(46);}
 if(request==43&&fileCallback!=null){Uri[] selected=null;if(result==RESULT_OK&&data!=null){if(data.getClipData()!=null){int count=Math.min(10,data.getClipData().getItemCount());selected=new Uri[count];for(int j=0;j<count;j++)selected[j]=data.getClipData().getItemAt(j).getUri();}else if(data.getData()!=null)selected=new Uri[]{data.getData()};}fileCallback.onReceiveValue(selected);fileCallback=null;}if(request==43)returnToOverlay(43);
 }
 public void askCamera(PermissionRequest request){if(cameraRequest!=null)cameraRequest.deny();cameraRequest=request;if(checkSelfPermission("android.permission.CAMERA")==PackageManager.PERMISSION_GRANTED){request.grant(new String[]{PermissionRequest.RESOURCE_VIDEO_CAPTURE});cameraRequest=null;}else requestPermissions(new String[]{"android.permission.CAMERA"},47);}
 public void askLocation(String origin,GeolocationPermissions.Callback callback){if(checkSelfPermission("android.permission.ACCESS_FINE_LOCATION")==PackageManager.PERMISSION_GRANTED||checkSelfPermission("android.permission.ACCESS_COARSE_LOCATION")==PackageManager.PERMISSION_GRANTED){callback.invoke(origin,true,false);return;}locationOrigin=origin;locationCallback=callback;requestPermissions(new String[]{"android.permission.ACCESS_FINE_LOCATION","android.permission.ACCESS_COARSE_LOCATION"},44);}
 @Override public void onRequestPermissionsResult(int request,String[] permissions,int[] granted){super.onRequestPermissionsResult(request,permissions,granted);if(request==47&&cameraRequest!=null){if(granted.length>0&&granted[0]==PackageManager.PERMISSION_GRANTED)cameraRequest.grant(new String[]{PermissionRequest.RESOURCE_VIDEO_CAPTURE});else cameraRequest.deny();cameraRequest=null;}if(request==44&&locationCallback!=null){boolean yes=false;for(int x:granted)yes|=x==PackageManager.PERMISSION_GRANTED;locationCallback.invoke(locationOrigin,yes,false);locationCallback=null;}}
 @Override public void onBackPressed(){web.evaluateJavascript("window.dispatchEvent(new CustomEvent('amora-native',{detail:{route:'home'}}))",null);}
 @Override protected void onDestroy(){if(web!=null)AmoraWeb.destroy(web);super.onDestroy();}
}
