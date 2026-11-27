package be.montaxi.gestion;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.SharedPreferences;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.text.InputType;
import android.util.Base64;
import android.webkit.JavascriptInterface;
import android.widget.EditText;
import org.json.JSONObject;
import java.io.*;
import java.net.*;
import java.nio.charset.StandardCharsets;
import java.security.KeyStore;
import java.util.function.BooleanSupplier;
import javax.crypto.*;
import javax.crypto.spec.GCMParameterSpec;

final class GmailTestBridge {
    private static final String BASE = "https://uenyvsiturkihectolxp.supabase.co";
    private static final String PUBLIC_KEY = "sb_publishable_mJNDNx8M1y6p1KYy_zaWyA_fsb8tFnv";
    private static final String ACCOUNT = "dbs.maral@gmail.com";
    private static final String RECIPIENT = "dbs.dahmane@gmail.com";
    private static final String ALIAS = "taxi-gmail-session";
    private final Activity activity;
    private final BooleanSupplier unlocked;
    private final SharedPreferences prefs;
    private boolean busy;
    GmailTestBridge(Activity activity, BooleanSupplier unlocked) {
        this.activity = activity;
        this.unlocked = unlocked;
        prefs = activity.getSharedPreferences(ALIAS, 0);
    }
    @JavascriptInterface public void open() {
        activity.runOnUiThread(() -> {
            if (busy || !unlocked.getAsBoolean()) return;
            boolean login = !prefs.contains("session");
            EditText password = new EditText(activity);
            password.setSingleLine();
            password.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_PASSWORD);
            AlertDialog.Builder dialog = new AlertDialog.Builder(activity).setTitle("Tester Gmail")
                .setMessage("Envoyer un message de test depuis Maral vers " + RECIPIENT + " ?"
                    + (login ? "\n\nMot de passe Mon Taxi Pro du compte " + ACCOUNT : ""));
            if (login) dialog.setView(password);
            dialog.setNegativeButton("Annuler", null).setPositiveButton("Envoyer", (d, which) -> {
                if (busy || !unlocked.getAsBoolean()) return;
                busy = true;
                String input = password.getText().toString();
                password.setText("");
                new Thread(() -> runTest(login, input)).start();
            }).show();
        });
    }
    private void runTest(boolean login, String password) {
        String message;
        try {
            JSONObject credentials = new JSONObject();
            if (login) credentials.put("email", ACCOUNT).put("password", password);
            else credentials.put("refresh_token", readSession());
            JSONObject session = post("/auth/v1/token?grant_type=" + (login ? "password" : "refresh_token"), credentials, null);
            saveSession(session.getString("refresh_token"));
            JSONObject mail = new JSONObject().put("to", RECIPIENT).put("subject", "Mon Taxi Pro — test Gmail")
                .put("text", "Message de test envoyé depuis Mon Taxi Pro sur Android.");
            JSONObject result = post("/functions/v1/taxi-gmail-send-v1", mail, session.getString("access_token"));
            message = "sent".equals(result.optString("code")) ? "Message envoyé à " + RECIPIENT : "Envoi non confirmé.";
        } catch (Exception e) {
            message = e instanceof UserError ? e.getMessage() : "Connexion indisponible ou session illisible. Vérifie ta boîte avant de réessayer.";
        }
        final String status = message;
        activity.runOnUiThread(() -> {
            busy = false;
            if (!activity.isFinishing() && !activity.isDestroyed() && unlocked.getAsBoolean())
                new AlertDialog.Builder(activity).setTitle("Tester Gmail").setMessage(status).setPositiveButton("OK", null).show();
        });
    }
    private JSONObject post(String path, JSONObject body, String token) throws Exception {
        HttpURLConnection connection = (HttpURLConnection)new URL(BASE + path).openConnection();
        try {
            connection.setInstanceFollowRedirects(false);
            connection.setConnectTimeout(12000);
            connection.setReadTimeout(30000);
            connection.setRequestMethod("POST");
            connection.setDoOutput(true);
            connection.setRequestProperty("Content-Type", "application/json");
            connection.setRequestProperty("apikey", PUBLIC_KEY);
            if (token != null) connection.setRequestProperty("Authorization", "Bearer " + token);
            try (OutputStream out = connection.getOutputStream()) { out.write(body.toString().getBytes(StandardCharsets.UTF_8)); }
            int code = connection.getResponseCode();
            if (code < 200 || code >= 300) {
                if (token == null && (code == 400 || code == 401 || code == 403)) {
                    prefs.edit().remove("session").commit();
                    throw new UserError("Connexion refusée. Vérifie le mot de passe Mon Taxi Pro du compte Maral.");
                }
                throw new UserError("Le service a répondu avec le code " + code + ".");
            }
            try (BufferedReader in = new BufferedReader(new InputStreamReader(connection.getInputStream(), StandardCharsets.UTF_8))) {
                StringBuilder data = new StringBuilder();
                String line;
                while ((line = in.readLine()) != null) data.append(line);
                return new JSONObject(data.toString());
            }
        } finally { connection.disconnect(); }
    }
    private SecretKey key() throws Exception {
        KeyStore store = KeyStore.getInstance("AndroidKeyStore");
        store.load(null);
        if (store.containsAlias(ALIAS)) return (SecretKey)store.getKey(ALIAS, null);
        KeyGenerator generator = KeyGenerator.getInstance("AES", "AndroidKeyStore");
        generator.init(new KeyGenParameterSpec.Builder(ALIAS, KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT)
            .setBlockModes(KeyProperties.BLOCK_MODE_GCM).setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE).build());
        return generator.generateKey();
    }
    private void saveSession(String refresh) throws Exception {
        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(Cipher.ENCRYPT_MODE, key());
        String packed = Base64.encodeToString(cipher.getIV(), Base64.NO_WRAP) + "." +
            Base64.encodeToString(cipher.doFinal(refresh.getBytes(StandardCharsets.UTF_8)), Base64.NO_WRAP);
        if (!prefs.edit().putString("session", packed).commit()) throw new IOException();
    }
    private String readSession() throws Exception {
        try {
            String[] parts = prefs.getString("session", "").split("[.]");
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.DECRYPT_MODE, key(), new GCMParameterSpec(128, Base64.decode(parts[0], Base64.NO_WRAP)));
            return new String(cipher.doFinal(Base64.decode(parts[1], Base64.NO_WRAP)), StandardCharsets.UTF_8);
        } catch (Exception e) {
            prefs.edit().remove("session").commit();
            throw new UserError("Rouvre Tester Gmail pour te reconnecter.");
        }
    }
    private static final class UserError extends Exception {
        UserError(String message) { super(message); }
    }
}
