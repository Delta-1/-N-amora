package com.amora.app;
import android.app.*;
import android.content.*;
import android.os.*;
import android.graphics.*;
import android.media.*;
import android.media.projection.*;
import android.hardware.display.*;
import android.util.Base64;
import java.io.*;
import java.nio.ByteBuffer;
/** Explicit, visible MediaProjection session. No recording and no persisted frames. */
public class CinemaCaptureService extends Service {
 MediaProjection projection;VirtualDisplay display;ImageReader reader;
 HandlerThread worker;Handler frames;final Handler main=new Handler(Looper.getMainLooper());
 volatile boolean stopped=false;long lastFrame=0;
 @Override public int onStartCommand(Intent intent,int flags,int startId){
 if(intent==null||"stop".equals(intent.getAction())){stopSelf();return START_NOT_STICKY;}
 if(projection!=null)return START_NOT_STICKY;
 PendingIntent stop=PendingIntent.getService(this,150,new Intent(this,CinemaCaptureService.class).setAction("stop"),PendingIntent.FLAG_IMMUTABLE|PendingIntent.FLAG_UPDATE_CURRENT);
 Notification n=NativeBridge.notification(this,"amora-cinema","Amora · Cinema ao vivo","Sua tela está sendo compartilhada na sala. Toque em Parar para encerrar.",stop);
 if(Build.VERSION.SDK_INT>=29)startForeground(105,n,android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PROJECTION);else startForeground(105,n);
 try{
 MediaProjectionManager manager=(MediaProjectionManager)getSystemService(MEDIA_PROJECTION_SERVICE);
 projection=manager.getMediaProjection(intent.getIntExtra("result",0),intent.getParcelableExtra("data"));
 projection.registerCallback(new MediaProjection.Callback(){@Override public void onStop(){stopSelf();}},main);
 android.util.DisplayMetrics metrics=getResources().getDisplayMetrics();
 float ratio=Math.min(1f,1280f/Math.max(metrics.widthPixels,metrics.heightPixels));
 int width=Math.max(2,((int)(metrics.widthPixels*ratio))/2*2),height=Math.max(2,((int)(metrics.heightPixels*ratio))/2*2);
 worker=new HandlerThread("amora-cinema-frames");worker.start();frames=new Handler(worker.getLooper());
 reader=ImageReader.newInstance(width,height,PixelFormat.RGBA_8888,2);
 reader.setOnImageAvailableListener(r->capture(),frames);
 display=projection.createVirtualDisplay("Amora Cinema",width,height,metrics.densityDpi,DisplayManager.VIRTUAL_DISPLAY_FLAG_AUTO_MIRROR,reader.getSurface(),null,main);
 }catch(Exception e){NativeBridge.event("cinemaError","Não foi possível compartilhar. Autorize uma nova sessão no Android.");stopSelf();}
 return START_NOT_STICKY;
 }
 void capture(){
 if(stopped||reader==null)return;Image image=null;Bitmap padded=null,bitmap=null;
 try{
 image=reader.acquireLatestImage();if(image==null)return;
 long now=SystemClock.elapsedRealtime();if(now-lastFrame<83)return;lastFrame=now;
 int w=image.getWidth(),h=image.getHeight();Image.Plane plane=image.getPlanes()[0];ByteBuffer bytes=plane.getBuffer();
 int paddedWidth=w+(plane.getRowStride()-plane.getPixelStride()*w)/plane.getPixelStride();
 padded=Bitmap.createBitmap(paddedWidth,h,Bitmap.Config.ARGB_8888);padded.copyPixelsFromBuffer(bytes);
 bitmap=Bitmap.createBitmap(padded,0,0,w,h);ByteArrayOutputStream out=new ByteArrayOutputStream();bitmap.compress(Bitmap.CompressFormat.JPEG,72,out);
 if(!stopped)NativeBridge.event("cinemaFrame",Base64.encodeToString(out.toByteArray(),Base64.NO_WRAP));
 }catch(Exception e){if(!stopped){NativeBridge.event("cinemaError","A tela não pôde continuar sendo transmitida.");main.post(this::stopSelf);}}
 finally{if(image!=null)image.close();if(bitmap!=null&&bitmap!=padded)bitmap.recycle();if(padded!=null)padded.recycle();}
 }
 @Override public void onDestroy(){
 stopped=true;
 if(reader!=null)reader.setOnImageAvailableListener(null,null);
 if(frames!=null)frames.post(()->{if(display!=null)display.release();if(reader!=null)reader.close();if(worker!=null)worker.quitSafely();});
 if(projection!=null){MediaProjection p=projection;projection=null;p.stop();}
 NativeBridge.event("cinemaStopped",true);super.onDestroy();
 }
 @Override public IBinder onBind(Intent i){return null;}
}
