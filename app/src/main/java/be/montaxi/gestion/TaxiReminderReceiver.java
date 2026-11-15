package be.montaxi.gestion;

import android.Manifest;
import android.app.AlarmManager;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.media.AudioAttributes;
import android.net.Uri;
import android.os.Build;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

public final class TaxiReminderReceiver extends BroadcastReceiver {
    private static final String STORAGE = "taxi_pickup_reminders";
    private static final String CHANNEL = "taxi_pickup_ring_ring";
    private static final String URGENT_CHANNEL = "taxi_pickup_urgent_30_v1";
    private static final String ACTION = "be.montaxi.gestion.PICKUP_REMINDER";

    private static SharedPreferences preferences(Context context) {
        return context.getSharedPreferences(STORAGE, Context.MODE_PRIVATE);
    }

    private static PendingIntent alarm(Context context, String id) {
        Intent intent = new Intent(context, TaxiReminderReceiver.class)
                .setAction(ACTION).setData(Uri.parse("montaxi-reminder:" + Uri.encode(id)));
        return PendingIntent.getBroadcast(context, 0, intent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    static void schedule(Context context, String json) {
        schedule(context, json, false);
    }

    static void restore(Context context) {
        schedule(context, preferences(context).getString("schedule", "[]"), true);
    }

    private static void schedule(Context context, String json, boolean force) {
        try {
            SharedPreferences store = preferences(context);
            String previous = store.getString("schedule", "[]");
            if (!force && previous.equals(json)) return;
            JSONArray old = new JSONArray(previous);
            JSONArray reminders = new JSONArray(json);
            if (reminders.length() > 1000) return;
            AlarmManager manager = context.getSystemService(AlarmManager.class);
            for (int i = 0; i < old.length(); i++) {
                manager.cancel(alarm(context, old.getJSONObject(i).getString("id")));
            }
            store.edit().putString("schedule", reminders.toString()).apply();
            long now = System.currentTimeMillis();
            for (int i = 0; i < reminders.length(); i++) {
                JSONObject item = reminders.getJSONObject(i);
                String id = item.getString("id");
                long pickup = item.getLong("pickup");
                if (pickup <= now || store.getLong("notified:" + id, 0L) == pickup) continue;
                long when = Math.max(now, item.getLong("at"));
                PendingIntent pending = alarm(context, id);
                if (Build.VERSION.SDK_INT < 31 || manager.canScheduleExactAlarms()) {
                    try {
                        manager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, when, pending);
                        continue;
                    } catch (SecurityException ignored) {
                        // Exact-alarm access can change between the check and scheduling.
                    }
                }
                manager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, when, pending);
            }
        } catch (JSONException ignored) {
            // Keep the last valid schedule when the web page has incomplete data.
        }
    }

    @Override public void onReceive(Context context, Intent intent) {
        SharedPreferences store = preferences(context);
        String json = store.getString("schedule", "[]");
        if (Intent.ACTION_BOOT_COMPLETED.equals(intent.getAction()) ||
                AlarmManager.ACTION_SCHEDULE_EXACT_ALARM_PERMISSION_STATE_CHANGED.equals(intent.getAction())) {
            restore(context);
            return;
        }
        if (!ACTION.equals(intent.getAction()) || intent.getData() == null) return;
        if (Build.VERSION.SDK_INT >= 33 &&
                context.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) return;
        try {
            JSONArray reminders = new JSONArray(json);
            String id = Uri.decode(intent.getData().getSchemeSpecificPart());
            long now = System.currentTimeMillis();
            for (int i = 0; i < reminders.length(); i++) {
                JSONObject item = reminders.getJSONObject(i);
                if (!id.equals(item.getString("id"))) continue;
                long pickup = item.getLong("pickup");
                if (now < item.getLong("at") || now >= pickup || store.getLong("notified:" + id, 0L) == pickup) return;
                notifyPickup(context, item, id);
                store.edit().putLong("notified:" + id, pickup).apply();
                return;
            }
        } catch (JSONException ignored) {}
    }

    private void notifyPickup(Context context, JSONObject item, String id) {
        NotificationManager manager = context.getSystemService(NotificationManager.class);
        boolean urgent = id.endsWith(":30");
        String channelId = urgent ? URGENT_CHANNEL : CHANNEL;
        NotificationChannel channel = new NotificationChannel(channelId, urgent ? "Courses dans 30 minutes" : "Courses dans une heure",
                NotificationManager.IMPORTANCE_HIGH);
        AudioAttributes audio = new AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_NOTIFICATION)
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .build();
        Uri ring = new Uri.Builder()
                .scheme("android.resource")
                .authority(context.getPackageName())
                .appendPath("raw")
                .appendPath("taxi_ring_ring")
                .build();
        channel.setSound(urgent ? android.media.RingtoneManager.getDefaultUri(android.media.RingtoneManager.TYPE_ALARM) : ring, audio);
        channel.enableVibration(true);
        if (urgent) channel.setVibrationPattern(new long[]{0, 600, 250, 600, 250, 900});
        manager.createNotificationChannel(channel);
        PendingIntent open = PendingIntent.getActivity(context, 0, new Intent(context, MainActivity.class),
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        String route = item.optString("hotel");
        if (!item.optString("destination").isEmpty()) route += " → " + item.optString("destination");
        Notification notice = new Notification.Builder(context, channelId)
                .setSmallIcon(android.R.drawable.ic_dialog_info)
                .setContentTitle((urgent ? "Départ dans 30 min · " : "Départ dans 1 h · ") + item.optString("time"))
                .setContentText(route)
                .setVisibility(Notification.VISIBILITY_PRIVATE)
                .setContentIntent(open)
                .setAutoCancel(true)
                .build();
        manager.notify(id, urgent ? 30 : 60, notice);
    }
}
