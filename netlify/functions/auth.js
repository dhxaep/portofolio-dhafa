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

  const { action, username, password } = JSON.parse(event.body);
  const clientIp = event.headers['x-nf-client-connection-ip'];

  try {
    if (action === 'register') {
      const ipCheck = await pool.query('SELECT id FROM users WHERE last_ip = $1', [clientIp]);
      if (ipCheck.rowCount > 0) {
        return { statusCode: 400, body: JSON.stringify({ message: 'Satu akun per alamat IP telah terdaftar.' }) };
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      await pool.query(
        'INSERT INTO users(username, password_hash, last_ip) VALUES($1, $2, $3)',
        [username, hashedPassword, clientIp]
      );

      return { statusCode: 201, body: JSON.stringify({ message: 'Registrasi berhasil! Silakan login.' }) };

    } else if (action === 'login') {
      const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
      if (result.rowCount === 0) {
        return { statusCode: 404, body: JSON.stringify({ message: 'Username tidak ditemukan.' }) };
      }

      const user = result.rows[0];
      const isMatch = await bcrypt.compare(password, user.password_hash);

      if (!isMatch) {
        return { statusCode: 401, body: JSON.stringify({ message: 'Password salah.' }) };
      }

      const scoresResult = await pool.query('SELECT * FROM scores WHERE user_id = $1', [user.id]);

      const userData = {
        id: user.id,
        username: user.username,
        scores: scoresResult.rows.reduce((acc, score) => {
            acc[score.game_mode] = score;
            return acc;
        }, {})
      };

      return { statusCode: 200, body: JSON.stringify({ message: 'Login berhasil!', userData }) };
    }

    return { statusCode: 400, body: JSON.stringify({ message: 'Aksi tidak valid.' }) };

  } catch (error) {
    console.error(error);
    if (error.code === '23505') {
       return { statusCode: 409, body: JSON.stringify({ message: 'Username sudah digunakan.' }) };
    }
    return { statusCode: 500, body: JSON.stringify({ message: 'Terjadi kesalahan pada server.' }) };
  }
};