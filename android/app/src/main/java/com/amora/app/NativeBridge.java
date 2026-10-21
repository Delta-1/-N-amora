package com.amora.app;
import android.content.*;
import android.app.*;
import android.webkit.*;
import android.os.*;
import android.speech.tts.*;
import org.json.*;
import java.util.*;
public class NativeBridge {
 final Context context;final WebView web;static TextToSpeech tts;static String pending="";static final Handler main=new Handler(Looper.getMainLooper());
 NativeBridge(Context c,WebView w){context=c;web=w;}
 static void event(String key,Object value){try{JSONObject d=new JSONObject().put(key,value);pending=d.toString();main.post(()->{if("speaking".equals(key))OverlayService.speaking(Boolean.TRUE.equals(value));for(WebView w:new ArrayList<>(AmoraWeb.views))flush(w);});}catch(Exception ignored){}}
 static void flush(WebView w){if(pending.isEmpty())return;String data=pending;w.evaluateJavascript("window.__amoraPending="+data+";window.dispatchEvent(new CustomEvent('amora-native',{detail:"+data+"}))",null);}
 void launch(String action){main.post(()->context.startActivity(new Intent(context,MainActivity.class).setAction(action).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK|Intent.FLAG_ACTIVITY_SINGLE_TOP)));}
 @JavascriptInterface public void overlay(boolean on){if(on)launch("amora.overlay");else context.stopService(new Intent(context,OverlayService.class));}
 @JavascriptInterface public void openApp(String route){if(!java.util.Arrays.asList("home","chat","expenses","games","paint","notes","agenda","history","ideas","lists","map").contains(route))return;main.post(()->{context.startActivity(new Intent(context,MainActivity.class).putExtra("route",route).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK|Intent.FLAG_ACTIVITY_SINGLE_TOP));OverlayService.hidePanel();});}
 @JavascriptInterface public void closeOverlay(){main.post(()->OverlayService.hidePanel());}
 @JavascriptInterface public void capture(){launch("amora.capture");}
 @JavascriptInterface public void listen(){launch("amora.voice");}
 @JavascriptInterface public void stopAudio(){main.post(()->{if(tts!=null)tts.stop();event("speaking",false);});}
 @JavascriptInterface public void speak(String text){if(text==null||text.length()>15000)return;main.post(()->{if(tts==null){tts=new TextToSpeech(context.getApplicationContext(),status->{if(status==TextToSpeech.SUCCESS){tts.setLanguage(new Locale("pt","BR"));say(text);}});}else say(text);});}
 static void say(String text){tts.setOnUtteranceProgressListener(new UtteranceProgressListener(){public void onStart(String id){event("speaking",true);}public void onDone(String id){event("speaking",false);}public void onError(String id){event("speaking",false);}});tts.speak(text,TextToSpeech.QUEUE_FLUSH,null,"lilith");}
 @JavascriptInterface public void reminders(String json){try{if(json.length()>40000)return;ReminderReceiver.schedule(context,new JSONArray(json));if(Build.VERSION.SDK_INT>=33&&context.checkSelfPermission("android.permission.POST_NOTIFICATIONS")!=android.content.pm.PackageManager.PERMISSION_GRANTED)launch("amora.permissions");}catch(Exception e){event("error","Não foi possível agendar os lembretes.");}}
 @JavascriptInterface public void clearSession(){main.post(()->{context.stopService(new Intent(context,OverlayService.class));context.stopService(new Intent(context,CaptureService.class));stopAudio();pending="";try{ReminderReceiver.schedule(context,new JSONArray());}catch(Exception ignored){}});}
 public static Notification notification(Context c,String channel,String title,String text,PendingIntent stop){NotificationManager m=c.getSystemService(NotificationManager.class);m.createNotificationChannel(new NotificationChannel(channel,title,NotificationManager.IMPORTANCE_LOW));PendingIntent open=PendingIntent.getActivity(c,0,new Intent(c,MainActivity.class),PendingIntent.FLAG_IMMUTABLE|PendingIntent.FLAG_UPDATE_CURRENT);Notification.Builder b=new Notification.Builder(c,channel).setSmallIcon(R.drawable.amora_icon).setContentTitle(title).setContentText(text).setContentIntent(open).setOngoing(true);if(stop!=null)b.addAction(new Notification.Action.Builder(null,"Parar",stop).build());return b.build();}
}
