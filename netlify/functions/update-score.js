const pg = require('pg');
const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.NETLIFY_DATABASE_URL });

exports.handler = async (event) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        // Perlu cara untuk mendapatkan user_id, idealnya dari token JWT.
        // Untuk sementara, kita asumsikan frontend mengirim username.
        const { username, mode, score, stars } = JSON.parse(event.body);

        // Ambil user_id dari username
        const userRes = await pool.query('SELECT id FROM users WHERE username = $1', [username]);
        if (userRes.rowCount === 0) {
            return { statusCode: 404, body: JSON.stringify({ message: "User tidak ditemukan." })};
        }
        const userId = userRes.rows[0].id;

        // Gunakan query UPSERT (UPDATE atau INSERT jika belum ada)
        const query = `
            INSERT INTO scores (user_id, game_mode, high_score, total_stars)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (user_id, game_mode)
            DO UPDATE SET
                high_score = GREATEST(scores.high_score, EXCLUDED.high_score),
                total_stars = GREATEST(scores.total_stars, EXCLUDED.total_stars);
        `;
        await pool.query(query, [userId, mode, score, stars]);

        return { statusCode: 200, body: JSON.stringify({ message: "Skor berhasil diperbarui." }) };

    } catch (error) {
        console.error(error);
        return { statusCode: 500, body: JSON.stringify({ message: "Gagal memperbarui skor." }) };
    }
};