const pg = require('pg');
const bcrypt = require('bcryptjs');

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.NETLIFY_DATABASE_URL,
});

exports.handler = async (event) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: JSON.stringify({ message: 'Method Not Allowed' }) };
    }

    const { action, username, waNumber, code, newPassword } = JSON.parse(event.body);

    try {
        if (action === 'initiate') {
            const userResult = await pool.query('SELECT id FROM users WHERE username = $1', [username]);
            if (userResult.rowCount === 0) {
                return { statusCode: 404, body: JSON.stringify({ message: 'Username tidak ditemukan.' }) };
            }
            await pool.query('UPDATE users SET wa_number = $1 WHERE username = $2', [waNumber, username]);

            const resetCode = Math.floor(100000 + Math.random() * 900000).toString();
            const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 menit
            const hashedCode = await bcrypt.hash(resetCode, 10);

            await pool.query(
                'UPDATE users SET reset_code_hash = $1, reset_expires_at = $2 WHERE username = $3',
                [hashedCode, expiresAt, username]
            );

            return { statusCode: 200, body: JSON.stringify({ resetCode }) };
        }

        if (action === 'verify') {
            const userResult = await pool.query(
                'SELECT reset_code_hash, reset_expires_at FROM users WHERE username = $1',
                [username]
            );

            if (userResult.rowCount === 0) {
                return { statusCode: 400, body: JSON.stringify({ message: 'Permintaan reset tidak valid.' }) };
            }

            const { reset_code_hash, reset_expires_at } = userResult.rows[0];

            if (new Date() > new Date(reset_expires_at)) {
                return { statusCode: 400, body: JSON.stringify({ message: 'Kode verifikasi sudah kedaluwarsa.' }) };
            }

            const isMatch = await bcrypt.compare(code, reset_code_hash);
            if (!isMatch) {
                return { statusCode: 400, body: JSON.stringify({ message: 'Kode verifikasi salah.' }) };
            }

            const newPasswordHash = await bcrypt.hash(newPassword, 10);
            await pool.query(
                'UPDATE users SET password_hash = $1, reset_code_hash = NULL, reset_expires_at = NULL WHERE username = $2',
                [newPasswordHash, username]
            );

            return { statusCode: 200, body: JSON.stringify({ message: 'Password berhasil direset! Silakan login.' }) };
        }

        return { statusCode: 400, body: JSON.stringify({ message: 'Aksi tidak valid.' }) };

    } catch (error) {
        console.error('Password reset error:', error);
        return { statusCode: 500, body: JSON.stringify({ message: 'Terjadi kesalahan pada server.' }) };
    }
};