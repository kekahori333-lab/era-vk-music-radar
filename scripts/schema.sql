CREATE TABLE IF NOT EXISTS tracks (
 id text PRIMARY KEY, artist text NOT NULL, title text NOT NULL
);
CREATE TABLE IF NOT EXISTS posts (
 id text PRIMARY KEY, owner_id bigint NOT NULL, author_id bigint NOT NULL,
 published_at timestamptz NOT NULL, is_repost boolean NOT NULL, url text NOT NULL
);
CREATE INDEX IF NOT EXISTS posts_date ON posts(published_at);
CREATE TABLE IF NOT EXISTS post_tracks (
 post_id text REFERENCES posts(id) ON DELETE CASCADE,
 track_id text REFERENCES tracks(id) ON DELETE CASCADE,
 PRIMARY KEY(post_id,track_id)
);
CREATE TABLE IF NOT EXISTS collection_runs (
 id bigserial PRIMARY KEY, started_at timestamptz NOT NULL DEFAULT now(), finished_at timestamptz,
 status text NOT NULL DEFAULT 'running', walls integer NOT NULL, posts integer NOT NULL DEFAULT 0,
 coverage text NOT NULL DEFAULT 'Выборка настроенных публичных стен', error text,
 truncated boolean NOT NULL DEFAULT false
);
CREATE TABLE IF NOT EXISTS snapshots (
 day date NOT NULL, track_id text REFERENCES tracks(id), period integer NOT NULL,
 position integer NOT NULL, publications integer NOT NULL, originals integer NOT NULL,
 reposts integer NOT NULL, authors integer NOT NULL, PRIMARY KEY(day,track_id,period)
);
CREATE TABLE IF NOT EXISTS login_attempts (
 key text PRIMARY KEY, attempts integer NOT NULL DEFAULT 0, window_start timestamptz NOT NULL DEFAULT now()
);
