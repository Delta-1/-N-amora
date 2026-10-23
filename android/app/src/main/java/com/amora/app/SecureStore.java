package com.amora.app;
import android.content.Context;
import android.security.keystore.*;
import javax.crypto.*;
import javax.crypto.spec.GCMParameterSpec;
import java.security.KeyStore;
import android.util.Base64;
final class SecureStore {
 static javax.crypto.SecretKey key() throws Exception{KeyStore s=KeyStore.getInstance("AndroidKeyStore");s.load(null);if(!s.containsAlias("amora-tracking")){KeyGenerator g=KeyGenerator.getInstance("AES","AndroidKeyStore");g.init(new KeyGenParameterSpec.Builder("amora-tracking",KeyProperties.PURPOSE_ENCRYPT|KeyProperties.PURPOSE_DECRYPT).setBlockModes(KeyProperties.BLOCK_MODE_GCM).setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE).build());g.generateKey();}return (javax.crypto.SecretKey)s.getKey("amora-tracking",null);}
 static synchronized void put(Context c,String json)throws Exception{Cipher cipher=Cipher.getInstance("AES/GCM/NoPadding");cipher.init(Cipher.ENCRYPT_MODE,key());String value=Base64.encodeToString(cipher.getIV(),2)+":"+Base64.encodeToString(cipher.doFinal(json.getBytes("UTF-8")),2);c.getSharedPreferences("amora",0).edit().putString("trackingSession",value).commit();}
 static synchronized String get(Context c){try{String[] v=c.getSharedPreferences("amora",0).getString("trackingSession","").split(":");if(v.length!=2)return "";Cipher cipher=Cipher.getInstance("AES/GCM/NoPadding");cipher.init(Cipher.DECRYPT_MODE,key(),new GCMParameterSpec(128,Base64.decode(v[0],2)));return new String(cipher.doFinal(Base64.decode(v[1],2)),"UTF-8");}catch(Exception e){return "";}}
 static synchronized String replace(Context c,String json,String user)throws Exception{String old=get(c);if(old.isEmpty()||!new org.json.JSONObject(old).optString("user").equals(user))throw new java.io.IOException("Session ended");if(new org.json.JSONObject(old).optLong("expires")>new org.json.JSONObject(json).optLong("expires"))return old;put(c,json);return json;}
 static synchronized void clear(Context c){c.getSharedPreferences("amora",0).edit().remove("trackingSession").apply();}
}
