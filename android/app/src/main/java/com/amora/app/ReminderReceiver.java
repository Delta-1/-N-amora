package com.amora.app;
import android.app.*;
import android.content.*;
import android.os.Build;
import org.json.*;
public class ReminderReceiver extends BroadcastReceiver {
 static PendingIntent alarm(Context c,int id,String title){return PendingIntent.getBroadcast(c,id,new Intent(c,ReminderReceiver.class).setAction("amora.reminder").putExtra("title",title).putExtra("id",id),PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);}
 static void schedule(Context c,JSONArray rows)throws Exception{AlarmManager m=(AlarmManager)c.getSystemService(Context.ALARM_SERVICE);for(int i=0;i<60;i++)m.cancel(alarm(c,1000+i,""));c.getSharedPreferences("amora",0).edit().putString("reminders",rows.toString()).apply();for(int i=0;i<Math.min(60,rows.length());i++){JSONObject row=rows.getJSONObject(i);long time=row.getLong("time");if(time>System.currentTimeMillis())m.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP,time,alarm(c,1000+i,row.getString("title")));}}
 @Override public void onReceive(Context c,Intent i){if(Intent.ACTION_BOOT_COMPLETED.equals(i.getAction())){try{schedule(c,new JSONArray(c.getSharedPreferences("amora",0).getString("reminders","[]")));}catch(Exception ignored){}return;}
 NotificationManager m=c.getSystemService(NotificationManager.class);m.createNotificationChannel(new NotificationChannel("amora-reminders","Datas e planos",NotificationManager.IMPORTANCE_DEFAULT));PendingIntent open=PendingIntent.getActivity(c,2,new Intent(c,MainActivity.class).putExtra("route","agenda"),PendingIntent.FLAG_IMMUTABLE|PendingIntent.FLAG_UPDATE_CURRENT);Notification n=new Notification.Builder(c,"amora-reminders").setSmallIcon(R.drawable.amora_icon).setContentTitle("Amora · um lembrete para nós").setContentText(i.getStringExtra("title")).setContentIntent(open).setAutoCancel(true).build();try{m.notify(i.getIntExtra("id",1000),n);}catch(SecurityException ignored){}
 }
}
