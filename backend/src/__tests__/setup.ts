/**
 * Jest test environment setup.
 * Runs before every test file.
 * Point the DB at in-memory SQLite so tests don't touch the real database.
 */
process.env.DB_PATH = ':memory:';
process.env.ROAD_ROCK_COUNT = '20'; // small count for fast generation tests
