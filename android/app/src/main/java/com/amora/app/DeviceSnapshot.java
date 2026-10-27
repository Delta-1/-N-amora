package com.amora.app;
import android.app.*;import android.app.usage.*;import android.content.*;import android.os.*;import android.net.*;import org.json.*;import java.util.*;
final class DeviceSnapshot {
 static boolean usageAllowed(Context c){try{AppOpsManager a=(AppOpsManager)c.getSystemService(Context.APP_OPS_SERVICE);return a.checkOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS,android.os.Process.myUid(),c.getPackageName())==AppOpsManager.MODE_ALLOWED;}catch(Exception e){return false;}}
 static String label(Context c,String name){try{return c.getPackageManager().getApplicationLabel(c.getPackageManager().getApplicationInfo(name,0)).toString();}catch(Exception e){return name;}}
 static JSONObject collect(Context c,boolean apps)throws Exception{
  PowerManager power=(PowerManager)c.getSystemService(Context.POWER_SERVICE);boolean screen=power.isInteractive(),locked=((KeyguardManager)c.getSystemService(Context.KEYGUARD_SERVICE)).isKeyguardLocked();
  Intent b=c.registerReceiver(null,new IntentFilter(Intent.ACTION_BATTERY_CHANGED));int level=b==null?-1:b.getIntExtra(BatteryManager.EXTRA_LEVEL,-1),scale=b==null?100:b.getIntExtra(BatteryManager.EXTRA_SCALE,100),status=b==null?0:b.getIntExtra(BatteryManager.EXTRA_STATUS,0);
  ConnectivityManager cm=(ConnectivityManager)c.getSystemService(Context.CONNECTIVITY_SERVICE);NetworkCapabilities cap=cm.getNetworkCapabilities(cm.getActiveNetwork());String connection=cap==null?"offline":cap.hasTransport(NetworkCapabilities.TRANSPORT_WIFI)?"wifi":cap.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR)?"mobile":cap.hasTransport(NetworkCapabilities.TRANSPORT_ETHERNET)?"ethernet":"other";
  JSONObject out=new JSONObject().put("action","device").put("platform","android").put("online",screen&&!locked).put("screen",screen).put("locked",locked).put("connection",connection).put("charging",status==BatteryManager.BATTERY_STATUS_CHARGING||status==BatteryManager.BATTERY_STATUS_FULL).put("usageAllowed",usageAllowed(c));if(level>=0&&scale>0)out.put("battery",Math.round(100f*level/scale));
  if(apps&&usageAllowed(c)){
   long now=System.currentTimeMillis();Calendar start=Calendar.getInstance();start.set(Calendar.HOUR_OF_DAY,0);start.set(Calendar.MINUTE,0);start.set(Calendar.SECOND,0);start.set(Calendar.MILLISECOND,0);UsageStatsManager manager=(UsageStatsManager)c.getSystemService(Context.USAGE_STATS_SERVICE);
   Map<String,Long> totals=new HashMap<>();for(UsageStats u:manager.queryUsageStats(UsageStatsManager.INTERVAL_DAILY,start.getTimeInMillis(),now)){long ms=Build.VERSION.SDK_INT>=29?u.getTotalTimeVisible():u.getTotalTimeInForeground();if(ms>0)totals.merge(u.getPackageName(),ms,Long::sum);}
   ArrayList<Map.Entry<String,Long>> rows=new ArrayList<>(totals.entrySet());rows.sort((a,d)->Long.compare(d.getValue(),a.getValue()));JSONArray usage=new JSONArray();for(int i=0;i<Math.min(12,rows.size());i++){Map.Entry<String,Long> r=rows.get(i);usage.put(new JSONObject().put("name",label(c,r.getKey())).put("minutes",Math.min(1440,r.getValue()/60000)));}
   String current="";UsageEvents events=manager.queryEvents(Math.max(start.getTimeInMillis(),now-3600000),now);UsageEvents.Event e=new UsageEvents.Event();while(events.hasNextEvent()){events.getNextEvent(e);if(e.getEventType()==UsageEvents.Event.MOVE_TO_FOREGROUND)current=e.getPackageName();else if(e.getEventType()==UsageEvents.Event.MOVE_TO_BACKGROUND&&current.equals(e.getPackageName()))current="";}
   out.put("app",screen&&!locked&&!current.isEmpty()?label(c,current):"").put("usage",usage).put("usageDay",new java.text.SimpleDateFormat("yyyy-MM-dd",Locale.US).format(new Date()));
  }
  return out;
 }
}
