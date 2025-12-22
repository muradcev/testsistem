package com.nakliyeo.nakliyeo_mobil

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.util.Log
import androidx.work.Constraints
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.NetworkType
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import java.util.concurrent.TimeUnit

/**
 * Boot Receiver - Telefon yeniden başladığında WorkManager görevlerini başlatır
 * Bu sayede uygulama açılmasa bile konum takibi devam eder
 */
class BootReceiver : BroadcastReceiver() {
    companion object {
        private const val TAG = "NakliyeoBootReceiver"
        private const val WORK_NAME = "nakliyeo_location_task"
        private const val PREFS_NAME = "FlutterSharedPreferences"
        private const val KEY_IS_LOGGED_IN = "flutter.is_logged_in"
        private const val KEY_HEARTBEAT_INTERVAL = "flutter.config_heartbeat_interval"
        private const val DEFAULT_INTERVAL_MINUTES = 15L
    }

    override fun onReceive(context: Context, intent: Intent) {
        val action = intent.action ?: return

        if (action == Intent.ACTION_BOOT_COMPLETED ||
            action == Intent.ACTION_LOCKED_BOOT_COMPLETED ||
            action == "android.intent.action.QUICKBOOT_POWERON" ||
            action == "com.htc.intent.action.QUICKBOOT_POWERON") {

            Log.d(TAG, "Boot completed, checking login status...")

            // Kullanıcı giriş yapmış mı kontrol et
            val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            val isLoggedIn = prefs.getBoolean(KEY_IS_LOGGED_IN, false)

            if (isLoggedIn) {
                Log.d(TAG, "User is logged in, scheduling WorkManager tasks...")
                try {
                    scheduleLocationWork(context, prefs)
                    Log.d(TAG, "WorkManager tasks scheduled successfully after boot")
                } catch (e: Exception) {
                    Log.e(TAG, "Failed to schedule WorkManager tasks: ${e.message}")
                }
            } else {
                Log.d(TAG, "User is not logged in, skipping WorkManager scheduling")
            }
        }
    }

    private fun scheduleLocationWork(context: Context, prefs: SharedPreferences) {
        // Config'den interval al
        val intervalMinutes = prefs.getInt(KEY_HEARTBEAT_INTERVAL, DEFAULT_INTERVAL_MINUTES.toInt()).toLong()

        val constraints = Constraints.Builder()
            .setRequiredNetworkType(NetworkType.NOT_REQUIRED)
            .setRequiresBatteryNotLow(false)
            .setRequiresCharging(false)
            .setRequiresDeviceIdle(false)
            .build()

        val locationWorkRequest = PeriodicWorkRequestBuilder<DummyWorker>(
            intervalMinutes, TimeUnit.MINUTES
        )
            .setConstraints(constraints)
            .addTag("location")
            .build()

        WorkManager.getInstance(context).enqueueUniquePeriodicWork(
            WORK_NAME,
            ExistingPeriodicWorkPolicy.REPLACE,
            locationWorkRequest
        )

        Log.d(TAG, "Location work scheduled every $intervalMinutes minutes")
    }
}

/**
 * Dummy Worker - Flutter WorkManager paketi kendi worker'ını kullanır
 * Bu sadece WorkManager'ın boot sonrası başlaması için gerekli
 */
class DummyWorker(context: Context, params: androidx.work.WorkerParameters) :
    androidx.work.Worker(context, params) {

    override fun doWork(): Result {
        // Flutter WorkManager bunu override edecek
        Log.d("DummyWorker", "Work executed - Flutter WorkManager should handle this")
        return Result.success()
    }
}
