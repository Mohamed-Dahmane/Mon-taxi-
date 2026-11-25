package be.montaxi.gestion;
import android.content.Context;
import android.content.SharedPreferences;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;
import java.security.KeyStore;
import java.nio.charset.StandardCharsets;
import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;
final class TaxiReceiptCredentials {
 private static final String ALIAS="taxi-receipt-oauth-device-v1";
 private final SharedPreferences prefs;
 TaxiReceiptCredentials(Context context){prefs=context.getSharedPreferences(ALIAS,Context.MODE_PRIVATE);}
 private SecretKey key()throws Exception{
  KeyStore ks=KeyStore.getInstance("AndroidKeyStore");ks.load(null);
  if(!ks.containsAlias(ALIAS)){
   KeyGenerator kg=KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES,"AndroidKeyStore");
   kg.init(new KeyGenParameterSpec.Builder(ALIAS,KeyProperties.PURPOSE_ENCRYPT|KeyProperties.PURPOSE_DECRYPT).setBlockModes(KeyProperties.BLOCK_MODE_GCM).setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE).build());kg.generateKey();
  }
  return (SecretKey)ks.getKey(ALIAS,null);
 }
 void save(String value)throws Exception{
  Cipher c=Cipher.getInstance("AES/GCM/NoPadding");c.init(Cipher.ENCRYPT_MODE,key());
  String encrypted=Base64.encodeToString(c.getIV(),Base64.NO_WRAP)+":"+Base64.encodeToString(c.doFinal(value.getBytes(StandardCharsets.UTF_8)),Base64.NO_WRAP);
  if(!prefs.edit().putString("credential",encrypted).commit())throw new Exception("Storage unavailable");
 }
 String load()throws Exception{
  String raw=prefs.getString("credential","");if(raw.isEmpty())return "";
  String[] parts=raw.split(":",2);if(parts.length!=2)throw new Exception("Invalid encrypted credential");
  Cipher c=Cipher.getInstance("AES/GCM/NoPadding");c.init(Cipher.DECRYPT_MODE,key(),new GCMParameterSpec(128,Base64.decode(parts[0],Base64.NO_WRAP)));
  return new String(c.doFinal(Base64.decode(parts[1],Base64.NO_WRAP)),StandardCharsets.UTF_8);
 }
 void clear(){prefs.edit().remove("credential").commit();}
}
