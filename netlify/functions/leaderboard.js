const pg = require('pg');
const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.NETLIFY_DATABASE_URL });

exports.handler = async (event) => {
    try {
        const { mode } = event.queryStringParameters;
        if (!mode) {
            return { statusCode: 400, body: JSON.stringify({ message: "Mode game harus disertakan." })};
        }

        const query = `
            SELECT u.username, s.high_score
            FROM scores s
            JOIN users u ON s.user_id = u.id
            WHERE s.game_mode = $1
            ORDER BY s.high_score DESC
            LIMIT 10;
        `;
        const result = await pool.query(query, [mode]);

        return {
            statusCode: 200,
            body: JSON.stringify({ leaderboard: result.rows })
        };

    } catch (error) {
        console.error(error);
        return { statusCode: 500, body: JSON.stringify({ message: "Gagal memuat leaderboard." }) };
    }
};