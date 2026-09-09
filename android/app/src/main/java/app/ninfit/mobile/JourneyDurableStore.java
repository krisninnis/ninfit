package app.ninfit.mobile;

import android.content.ContentValues;
import android.content.Context;
import android.database.Cursor;
import android.database.sqlite.SQLiteDatabase;
import android.database.sqlite.SQLiteOpenHelper;

import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Crash-safe local transport store for raw background Journey fixes.
 *
 * This class deliberately owns no GPS trust, distance, pause or reward logic. It only
 * preserves ordered provider observations until the React Journey runtime acknowledges
 * them after processing.
 */
final class JourneyDurableStore extends SQLiteOpenHelper {
    private static final String DATABASE_NAME = "ninfit_journey_native.db";
    private static final int DATABASE_VERSION = 1;
    private static final int MAX_PENDING_POSITIONS = 10_000;

    JourneyDurableStore(Context context) {
        super(context.getApplicationContext(), DATABASE_NAME, null, DATABASE_VERSION);
    }

    @Override
    public void onCreate(SQLiteDatabase db) {
        db.execSQL(
            "CREATE TABLE journey_cursor (" +
                "journey_id TEXT PRIMARY KEY NOT NULL," +
                "next_sequence INTEGER NOT NULL" +
            ")"
        );
        db.execSQL(
            "CREATE TABLE journey_position (" +
                "journey_id TEXT NOT NULL," +
                "sequence INTEGER NOT NULL," +
                "latitude REAL NOT NULL," +
                "longitude REAL NOT NULL," +
                "accuracy_m REAL NOT NULL," +
                "timestamp_ms INTEGER NOT NULL," +
                "PRIMARY KEY (journey_id, sequence)" +
            ")"
        );
        db.execSQL(
            "CREATE INDEX journey_position_pending_idx " +
            "ON journey_position(journey_id, sequence)"
        );
    }

    @Override
    public void onUpgrade(SQLiteDatabase db, int oldVersion, int newVersion) {
        throw new IllegalStateException("No Journey native store migration exists from version " + oldVersion);
    }

    private static void requireJourneyId(String journeyId) {
        if (journeyId == null || journeyId.trim().isEmpty() || journeyId.length() > 128) {
            throw new IllegalArgumentException("Invalid Journey id");
        }
    }

    private static void requirePosition(double latitude, double longitude, double accuracyM, long timestampMs) {
        if (!Double.isFinite(latitude) || latitude < -90d || latitude > 90d) {
            throw new IllegalArgumentException("Invalid latitude");
        }
        if (!Double.isFinite(longitude) || longitude < -180d || longitude > 180d) {
            throw new IllegalArgumentException("Invalid longitude");
        }
        if (!Double.isFinite(accuracyM) || accuracyM < 0d) {
            throw new IllegalArgumentException("Invalid accuracy");
        }
        if (timestampMs <= 0L) {
            throw new IllegalArgumentException("Invalid timestamp");
        }
    }

    private static long readNextSequence(SQLiteDatabase db, String journeyId) {
        try (Cursor cursor = db.query(
            "journey_cursor",
            new String[] { "next_sequence" },
            "journey_id = ?",
            new String[] { journeyId },
            null,
            null,
            null,
            "1"
        )) {
            if (!cursor.moveToFirst()) return 1L;
            long next = cursor.getLong(0);
            if (next < 1L) throw new IllegalStateException("Invalid persisted Journey sequence");
            return next;
        }
    }

    private static int pendingCount(SQLiteDatabase db, String journeyId) {
        try (Cursor cursor = db.rawQuery(
            "SELECT COUNT(*) FROM journey_position WHERE journey_id = ?",
            new String[] { journeyId }
        )) {
            if (!cursor.moveToFirst()) return 0;
            return cursor.getInt(0);
        }
    }

    /**
     * Append-before-delivery primitive for the future background location service.
     * The caller may emit the fix to JavaScript only after this transaction commits.
     */
    long append(String journeyId, double latitude, double longitude, double accuracyM, long timestampMs) {
        requireJourneyId(journeyId);
        requirePosition(latitude, longitude, accuracyM, timestampMs);

        SQLiteDatabase db = getWritableDatabase();
        db.beginTransaction();
        try {
            if (pendingCount(db, journeyId) >= MAX_PENDING_POSITIONS) {
                throw new IllegalStateException("Journey native queue capacity reached");
            }

            long sequence = readNextSequence(db, journeyId);

            ContentValues position = new ContentValues();
            position.put("journey_id", journeyId);
            position.put("sequence", sequence);
            position.put("latitude", latitude);
            position.put("longitude", longitude);
            position.put("accuracy_m", accuracyM);
            position.put("timestamp_ms", timestampMs);
            long inserted = db.insertOrThrow("journey_position", null, position);
            if (inserted < 0L) throw new IllegalStateException("Failed to persist Journey position");

            ContentValues cursor = new ContentValues();
            cursor.put("journey_id", journeyId);
            cursor.put("next_sequence", sequence + 1L);
            long cursorRow = db.insertWithOnConflict(
                "journey_cursor",
                null,
                cursor,
                SQLiteDatabase.CONFLICT_REPLACE
            );
            if (cursorRow < 0L) throw new IllegalStateException("Failed to persist Journey sequence");

            db.setTransactionSuccessful();
            return sequence;
        } finally {
            db.endTransaction();
        }
    }

    JSONArray readPending(String journeyId) {
        requireJourneyId(journeyId);
        JSONArray positions = new JSONArray();
        SQLiteDatabase db = getReadableDatabase();

        try (Cursor cursor = db.query(
            "journey_position",
            new String[] { "sequence", "latitude", "longitude", "accuracy_m", "timestamp_ms" },
            "journey_id = ?",
            new String[] { journeyId },
            null,
            null,
            "sequence ASC"
        )) {
            while (cursor.moveToNext()) {
                JSONObject position = new JSONObject();
                try {
                    position.put("sequence", cursor.getLong(0));
                    position.put("latitude", cursor.getDouble(1));
                    position.put("longitude", cursor.getDouble(2));
                    position.put("accuracyM", cursor.getDouble(3));
                    position.put("timestampMs", cursor.getLong(4));
                } catch (Exception error) {
                    throw new IllegalStateException("Failed to serialize Journey position", error);
                }
                positions.put(position);
            }
        }
        return positions;
    }

    /**
     * Delete the acknowledged prefix and report the pending depth that survived it.
     *
     * The count is taken inside the same transaction as the delete, so the number the
     * caller receives can only describe state that then committed. It is a depth, never
     * a position. Acknowledging a prefix that is already gone deletes nothing and
     * succeeds: retry after a lost receipt must be safe, and it must not disturb the
     * unacknowledged suffix.
     *
     * @return pending positions remaining for this Journey after the acknowledged prefix
     *     was removed.
     */
    int acknowledgeThrough(String journeyId, long sequence) {
        requireJourneyId(journeyId);
        if (sequence < 1L) throw new IllegalArgumentException("Invalid Journey acknowledgement sequence");

        SQLiteDatabase db = getWritableDatabase();
        db.beginTransaction();
        try {
            db.delete(
                "journey_position",
                "journey_id = ? AND sequence <= ?",
                new String[] { journeyId, Long.toString(sequence) }
            );
            int remaining = pendingCount(db, journeyId);
            // Do not delete journey_cursor here. Its monotonic next_sequence must survive
            // even when every pending row has been acknowledged.
            db.setTransactionSuccessful();
            return remaining;
        } finally {
            db.endTransaction();
        }
    }

    void clear(String journeyId) {
        requireJourneyId(journeyId);
        SQLiteDatabase db = getWritableDatabase();
        db.beginTransaction();
        try {
            db.delete("journey_position", "journey_id = ?", new String[] { journeyId });
            db.delete("journey_cursor", "journey_id = ?", new String[] { journeyId });
            db.setTransactionSuccessful();
        } finally {
            db.endTransaction();
        }
    }
}
