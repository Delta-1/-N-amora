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
public class CaptureService extends Service {
 MediaProjection projection;VirtualDisplay display;ImageReader reader;Handler handler=new Handler(Looper.getMainLooper());boolean finished=false;
 @Override public int onStartCommand(Intent intent,int flags,int id){if(intent==null){stopSelf();return START_NOT_STICKY;}if(projection!=null)return START_NOT_STICKY;
 Notification n=NativeBridge.notification(this,"lilith-screen","Lilith · captura de tela","Capturando uma imagem para você revisar.",null);if(Build.VERSION.SDK_INT>=29)startForeground(102,n,android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PROJECTION);else startForeground(102,n);
 try{MediaProjectionManager manager=(MediaProjectionManager)getSystemService(MEDIA_PROJECTION_SERVICE);projection=manager.getMediaProjection(intent.getIntExtra("result",0),intent.getParcelableExtra("data"));projection.registerCallback(new MediaProjection.Callback(){@Override public void onStop(){stopSelf();}},handler);
 android.util.DisplayMetrics metrics=getResources().getDisplayMetrics();int width=metrics.widthPixels,height=metrics.heightPixels;reader=ImageReader.newInstance(width,height,PixelFormat.RGBA_8888,2);

 display=projection.createVirtualDisplay("Amora capture",width,height,metrics.densityDpi,DisplayManager.VIRTUAL_DISPLAY_FLAG_AUTO_MIRROR,reader.getSurface(),null,handler);handler.postDelayed(this::captureFrame,1200);handler.postDelayed(()->{if(!finished){finished=true;NativeBridge.event("error","A tela não forneceu imagem. Tente novamente.");OverlayService.showPanel();stopSelf();}},12000);
 }catch(Exception e){NativeBridge.event("error","Captura indisponível. Autorize uma nova sessão.");stopSelf();}return START_NOT_STICKY;}
 // Read the queued frame after the permission UI has disappeared. Static screens
 // may supply only one frame, so do not discard it while waiting for the delay.
 void captureFrame(){
 if(finished||reader==null)return;
 Image image=null;
 try{
 image=reader.acquireLatestImage();
 if(image==null){handler.postDelayed(this::captureFrame,200);return;}
 finished=true;
 int width=image.getWidth(),height=image.getHeight();
 Image.Plane plane=image.getPlanes()[0];ByteBuffer bytes=plane.getBuffer();
 int paddedWidth=width+(plane.getRowStride()-plane.getPixelStride()*width)/plane.getPixelStride();
 Bitmap padded=Bitmap.createBitmap(paddedWidth,height,Bitmap.Config.ARGB_8888);padded.copyPixelsFromBuffer(bytes);
 Bitmap bitmap=Bitmap.createBitmap(padded,0,0,width,height);
 float ratio=Math.min(1f,1600f/Math.max(width,height));
 Bitmap small=Bitmap.createScaledBitmap(bitmap,(int)(width*ratio),(int)(height*ratio),true);
 ByteArrayOutputStream out=new ByteArrayOutputStream();small.compress(Bitmap.CompressFormat.JPEG,80,out);
 NativeBridge.event("image",Base64.encodeToString(out.toByteArray(),Base64.NO_WRAP));
 if(small!=bitmap&&small!=padded)small.recycle();if(bitmap!=padded)bitmap.recycle();padded.recycle();
 handler.post(()->{OverlayService.showPanel();stopSelf();});
 }catch(Exception e){finished=true;NativeBridge.event("error","Não foi possível capturar esta tela.");OverlayService.showPanel();stopSelf();}
 finally{if(image!=null)image.close();}
 }
 @Override public void onDestroy(){finished=true;handler.removeCallbacksAndMessages(null);if(display!=null)display.release();if(reader!=null)reader.close();if(projection!=null){projection.stop();projection=null;}super.onDestroy();}
 @Override public IBinder onBind(Intent i){return null;}
}
