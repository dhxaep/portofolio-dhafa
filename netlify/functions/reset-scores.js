const fs = require('fs').promises;
const path = require('path');

const dbPath = path.resolve(__dirname, '../../database/users.json');

// Helper function to read the database
const readDB = async () => {
    try {
        const data = await fs.readFile(dbPath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        if (error.code === 'ENOENT') return {}; // Return empty object if file doesn't exist
        throw error;
    }
};

// Helper function to write to the database
const writeDB = async (data) => {
    await fs.writeFile(dbPath, JSON.stringify(data, null, 2));
};

exports.handler = async function(event, context) {
    console.log("Starting weekly score reset job...");
    try {
        const users = await readDB();
        let usersModified = false;

        for (const username in users) {
            if (users[username].scores) {
                console.log(`Resetting scores for user: ${username}`);
                usersModified = true;
                // Reset scores for all game modes
                Object.keys(users[username].scores).forEach(mode => {
                    users[username].scores[mode].high_score = 0;
                    users[username].scores[mode].total_stars = 0;
                });
            }
        }

        if (usersModified) {
            await writeDB(users);
            console.log("Score reset successful for all users.");
            return {
                statusCode: 200,
                body: JSON.stringify({ message: "Weekly scores reset successfully." }),
            };
        } else {
            console.log("No users found or no scores to reset.");
            return {
                statusCode: 200,
                body: JSON.stringify({ message: "No scores needed resetting." }),
            };
        }
    } catch (error) {
        console.error("Error during score reset:", error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: "Failed to reset scores." }),
        };
    }
};